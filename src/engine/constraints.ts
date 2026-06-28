// Constraint evaluation (M5).
//
// Orchestrates the pure impeller/gas functions for a full operating point and
// returns a pass/fail/advisory/unknown verdict per engineering quantity, plus
// an overall "is this inside the shear-proof window" summary.
//
// Thresholds are sourced from the guidance PDF §4 / PROJECT_PLAN.md.
//
// Np handling: tip speed and impeller Reynolds are evaluated without a power
// number; everything power-derived (P/V, local EDR, microeddy length) is marked
// "unknown" until Np is supplied. The tip-speed alert is therefore always live.

import {
  powerInput,
  powerPerVolume,
  impellerReynolds,
  tipSpeed,
  impellerZonePowerDensity,
  energyDissipationRate,
  kolmogorovLength,
  PITCHED_BLADE_ZONE_FRACTION,
} from "./impeller";
import {
  vvm,
  gasEntranceVelocity,
  orificeReynolds,
  bubbleWakeEddyLength,
} from "./gas";
import type {
  ConstraintResult,
  EvaluationResult,
  OperatingPoint,
  WindowStatus,
} from "./types";

/** Cell-culture safety thresholds (SI units). */
export const THRESHOLDS = {
  /** Average P/V upper guideline [W/m³]. */
  pvMax: 50,
  /** Localized impeller-zone power-density upper bound [W/m³]. */
  localEdrMax: 1e5,
  /** Impeller Reynolds lower bound for valid P/V scaling (fully turbulent). */
  reynoldsMin: 10_000,
  /** Tip-speed upper limit [m/s]. */
  tipSpeedMax: 1.5,
  /** Microeddy length lower limit [m] (20 µm). */
  eddyLengthMin: 20e-6,
  /** Gas-entrance velocity upper limit [m/s]. */
  gasVelocityMax: 30,
  /** Orifice Reynolds upper limit (avoid jetting). */
  orificeReynoldsMax: 2_000,
} as const;

/**
 * Constraint ids that are OPTIONAL/advanced: if their (optional) input is
 * absent they are "skipped" rather than blocking the window verdict.
 * - localEdr        needs the impeller swept volume V_zone
 * - bubbleWakeEddy  needs the bubble-wake EDR ε_wake
 */
const OPTIONAL_CONSTRAINTS = new Set(["localEdr", "bubbleWakeEddy"]);

// --- small helpers for building results -----------------------------------

function upperLimit(
  id: string,
  label: string,
  value: number,
  unit: string,
  limit: number,
  limitText: string,
): ConstraintResult {
  const ok = value <= limit;
  return {
    id,
    label,
    value,
    unit,
    status: ok ? "ok" : "violated",
    message: ok ? undefined : `${label} ${fmt(value)} ${unit} exceeds ${limitText}`,
  };
}

function lowerLimit(
  id: string,
  label: string,
  value: number,
  unit: string,
  limit: number,
  limitText: string,
): ConstraintResult {
  const ok = value >= limit;
  return {
    id,
    label,
    value,
    unit,
    status: ok ? "ok" : "violated",
    message: ok ? undefined : `${label} ${fmt(value)} ${unit} is below ${limitText}`,
  };
}

function unknown(id: string, label: string, unit: string, message: string): ConstraintResult {
  return { id, label, value: NaN, unit, status: "unknown", message };
}

function advisory(id: string, label: string, value: number, unit: string): ConstraintResult {
  return { id, label, value, unit, status: "advisory" };
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(3);
  return v.toPrecision(4).replace(/\.?0+$/, "");
}

// --- main evaluator ---------------------------------------------------------

/**
 * Evaluate a full operating point. Returns one ConstraintResult per quantity
 * (in display order) plus an overall window verdict.
 */
export function evaluateOperatingPoint(point: OperatingPoint): EvaluationResult {
  const { impeller, fluid, gas } = point;
  const { liquidDensity: rho, liquidViscosity: mu, workingVolume: V } = fluid;
  const { impellerDiameter: D, impellerSpeed: N, powerNumber: Np } = impeller;

  const out: ConstraintResult[] = [];

  // --- Np-independent impeller metrics (always live) ---
  out.push(
    upperLimit(
      "tipSpeed",
      "Tip speed",
      tipSpeed(N, D),
      "m/s",
      THRESHOLDS.tipSpeedMax,
      `${THRESHOLDS.tipSpeedMax} m/s`,
    ),
  );
  out.push(
    lowerLimit(
      "impellerReynolds",
      "Impeller Reynolds",
      impellerReynolds(rho, N, D, mu),
      "",
      THRESHOLDS.reynoldsMin,
      `${THRESHOLDS.reynoldsMin} (P/V scaling not valid below this)`,
    ),
  );

  // --- power-derived impeller metrics (need Np) ---
  if (Np === undefined) {
    const need = "Enter the power number (Np) — bioreactor/impeller specific — to evaluate this.";
    out.push(unknown("pv", "Power per volume (P/V)", "W/m³", need));
    out.push(unknown("localEdr", "Impeller-zone power density", "W/m³", need));
    out.push(unknown("eddyLength", "Microeddy length", "m", need));
  } else {
    const P = powerInput(Np, rho, N, D);
    const pv = powerPerVolume(P, V);
    out.push(
      upperLimit("pv", "Power per volume (P/V)", pv, "W/m³", THRESHOLDS.pvMax, `${THRESHOLDS.pvMax} W/m³`),
    );

    // Local impeller-zone power density (needs V_zone).
    const zoneFraction = impeller.zoneFraction ?? PITCHED_BLADE_ZONE_FRACTION;
    let edrForEddy = energyDissipationRate(pv, rho); // fall back to mean EDR
    let eddyBasis = "mean P/V";
    if (impeller.zoneVolume !== undefined) {
      const localDensity = impellerZonePowerDensity(P, impeller.zoneVolume, zoneFraction);
      out.push(
        upperLimit(
          "localEdr",
          "Impeller-zone power density",
          localDensity,
          "W/m³",
          THRESHOLDS.localEdrMax,
          `${THRESHOLDS.localEdrMax} W/m³`,
        ),
      );
      edrForEddy = energyDissipationRate(localDensity, rho); // conservative basis
      eddyBasis = "impeller-zone EDR";
    } else {
      out.push(
        unknown(
          "localEdr",
          "Impeller-zone power density",
          "W/m³",
          "Provide the impeller swept volume (V_zone) to evaluate localized EDR.",
        ),
      );
    }

    const eddy = lowerLimit(
      "eddyLength",
      "Microeddy length",
      kolmogorovLength(edrForEddy, mu, rho),
      "m",
      THRESHOLDS.eddyLengthMin,
      `${THRESHOLDS.eddyLengthMin * 1e6} µm`,
    );
    eddy.message = (eddy.message ? eddy.message + " " : "") + `(based on ${eddyBasis})`;
    out.push(eddy);
  }

  // --- gas / sparging metrics (optional section) ---
  if (gas) {
    out.push(advisory("vvm", "Gas rate (VVM)", vvm(gas.gasFlow, V), "min⁻¹"));

    const vGas = gasEntranceVelocity(gas.gasFlow, gas.holeCount, gas.holeDiameter);
    out.push(
      upperLimit(
        "gasVelocity",
        "Gas-entrance velocity",
        vGas,
        "m/s",
        THRESHOLDS.gasVelocityMax,
        `${THRESHOLDS.gasVelocityMax} m/s`,
      ),
    );

    out.push(
      upperLimit(
        "orificeReynolds",
        "Orifice Reynolds",
        orificeReynolds(gas.gasDensity, vGas, gas.holeDiameter, gas.gasViscosity),
        "",
        THRESHOLDS.orificeReynoldsMax,
        `${THRESHOLDS.orificeReynoldsMax} (jetting regime)`,
      ),
    );

    if (gas.wakeEdr !== undefined) {
      out.push(
        lowerLimit(
          "bubbleWakeEddy",
          "Bubble-wake eddy length",
          bubbleWakeEddyLength(gas.wakeEdr, mu, rho),
          "m",
          THRESHOLDS.eddyLengthMin,
          `${THRESHOLDS.eddyLengthMin * 1e6} µm`,
        ),
      );
    } else {
      out.push(
        unknown(
          "bubbleWakeEddy",
          "Bubble-wake eddy length",
          "m",
          "Provide the bubble-wake EDR (ε_wake) to evaluate this.",
        ),
      );
    }
  }

  // --- overall window verdict ---
  // Optional/advanced constraints become "unknown" only because an OPTIONAL
  // input (V_zone, bubble-wake EDR) was not supplied. Their absence is surfaced
  // as "skipped" and does NOT block an "inside" verdict. Only missing REQUIRED
  // inputs (Np → core P/V & microeddy) keep the window "indeterminate".
  const violated = out.filter((c) => c.status === "violated").map((c) => c.id);
  const allUnknown = out.filter((c) => c.status === "unknown").map((c) => c.id);
  const skipped = allUnknown.filter((id) => OPTIONAL_CONSTRAINTS.has(id));
  const blockingUnknown = allUnknown.filter((id) => !OPTIONAL_CONSTRAINTS.has(id));

  let window: WindowStatus;
  if (violated.length > 0) window = "outside";
  else if (blockingUnknown.length > 0) window = "indeterminate";
  else window = "inside";

  return { constraints: out, window, violated, unknown: blockingUnknown, skipped };
}
