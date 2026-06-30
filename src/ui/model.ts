// UI ↔ engine bridge.
//
// The form holds values as strings in the current DISPLAY unit system. This
// module parses them, converts to SI at the boundary (units.ts), and assembles
// the engine's OperatingPoint. Keeping this separate from the React components
// means the conversion/assembly logic is plain and testable.

import {
  displayToEngine,
  engineToDisplay,
  type Quantity,
  type UnitSystem,
} from "../engine/units";
import type { OperatingPoint } from "../engine/types";
import type { ScaleCriterion, TargetGeometry } from "../engine/scaleup";
import { powerInput, powerPerVolume, estimateSweptVolume } from "../engine/impeller";
import type { OxygenBalanceInputs } from "../engine/oxygen";

/** All form fields as raw strings (empty = not provided). */
export interface FormState {
  // impeller
  powerNumber: string; // Np — REQUIRED for power-derived metrics; no default
  impellerDiameter: string;
  impellerSpeed: string;
  // Impeller swept volume (V_zone): either entered directly, or computed from
  // blade width via V_zone = (π/4)·D²·w.
  zoneMode: "direct" | "bladeWidth";
  zoneVolume: string; // optional (direct mode)
  bladeWidth: string; // optional (bladeWidth mode)
  // fluid
  workingVolume: string;
  liquidDensity: string;
  liquidViscosity: string;
  // gas (optional section)
  gasEnabled: boolean;
  gasFlow: string;
  holeCount: string;
  holeDiameter: string;
  gasDensity: string;
  gasViscosity: string;
  wakeEdr: string; // optional, SI (m²/s³)
}

/**
 * Default example values, expressed in each unit system's display units.
 * Geometry/fluid are pre-filled as an editable starting example; `powerNumber`
 * is intentionally left blank — it must be entered by the user (bioreactor/
 * impeller specific). Fluid props default to water-like cell-culture medium.
 */
export const DEFAULTS: Record<UnitSystem, FormState> = {
  SI: {
    powerNumber: "",
    impellerDiameter: "0.1", // m
    impellerSpeed: "2", // rev/s
    zoneMode: "direct",
    zoneVolume: "", // m³ (optional)
    bladeWidth: "", // m (optional)
    workingVolume: "0.01", // m³
    liquidDensity: "1000", // kg/m³
    liquidViscosity: "0.001", // Pa·s
    gasEnabled: false,
    gasFlow: "0.00002", // m³/s
    holeCount: "20",
    holeDiameter: "0.001", // m
    gasDensity: "1.2", // kg/m³
    gasViscosity: "0.000018", // Pa·s
    wakeEdr: "",
  },
  practical: {
    powerNumber: "",
    impellerDiameter: "100", // mm
    impellerSpeed: "120", // rpm
    zoneMode: "direct",
    zoneVolume: "", // L (optional)
    bladeWidth: "", // mm (optional)
    workingVolume: "10", // L
    liquidDensity: "1000", // g/L
    liquidViscosity: "1", // cP
    gasEnabled: false,
    gasFlow: "1.2", // L/min
    holeCount: "20",
    holeDiameter: "1", // mm
    gasDensity: "1.2", // g/L
    gasViscosity: "0.018", // cP
    wakeEdr: "",
  },
};

function num(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a display-unit field into an SI value (undefined if blank/invalid). */
function si(s: string, q: Quantity, system: UnitSystem): number | undefined {
  const n = num(s);
  return n === undefined ? undefined : displayToEngine(n, q, system);
}

export interface BuildResult {
  point?: OperatingPoint;
  errors: string[];
}

/**
 * Build an OperatingPoint from form state. Returns errors (and no point) when a
 * core required field is missing/invalid. `powerNumber` and `zoneVolume` are
 * intentionally allowed to be absent — the engine reports those as "unknown".
 */
export function buildOperatingPoint(state: FormState, system: UnitSystem): BuildResult {
  const errors: string[] = [];

  const D = si(state.impellerDiameter, "impellerDiameter", system);
  const N = si(state.impellerSpeed, "impellerSpeed", system);
  const V = si(state.workingVolume, "workingVolume", system);
  const rho = si(state.liquidDensity, "liquidDensity", system);
  const mu = si(state.liquidViscosity, "liquidViscosity", system);

  if (D === undefined || D <= 0) errors.push("Impeller diameter (D) is required and must be > 0.");
  if (N === undefined || N < 0) errors.push("Impeller speed (N) is required and must be ≥ 0.");
  if (V === undefined || V <= 0) errors.push("Working volume (V) is required and must be > 0.");
  if (rho === undefined || rho <= 0) errors.push("Liquid density (ρ) is required and must be > 0.");
  if (mu === undefined || mu <= 0) errors.push("Liquid viscosity (μ) is required and must be > 0.");

  // Optional fields.
  const Np = num(state.powerNumber); // dimensionless, no conversion
  if (state.powerNumber.trim() !== "" && (Np === undefined || Np < 0)) {
    errors.push("Power number (Np) must be a non-negative number.");
  }
  // Impeller swept volume: direct entry, or computed from blade width.
  let zoneVolume: number | undefined;
  if (state.zoneMode === "bladeWidth") {
    const w = si(state.bladeWidth, "impellerDiameter", system); // length
    if (w !== undefined && w > 0 && D !== undefined && D > 0) {
      zoneVolume = estimateSweptVolume(D, w); // (π/4)·D²·w
    }
    if (state.bladeWidth.trim() !== "" && (w === undefined || w <= 0)) {
      errors.push("Blade width must be a positive number.");
    }
  } else {
    zoneVolume = si(state.zoneVolume, "workingVolume", system);
  }

  // Gas section (only when enabled).
  let gas: OperatingPoint["gas"];
  if (state.gasEnabled) {
    const Q = si(state.gasFlow, "gasFlow", system);
    const holeCount = num(state.holeCount);
    const dHole = si(state.holeDiameter, "holeDiameter", system);
    const rhoGas = si(state.gasDensity, "liquidDensity", system); // density quantity
    const muGas = si(state.gasViscosity, "liquidViscosity", system); // viscosity quantity
    const wakeEdr = num(state.wakeEdr); // SI m²/s³, no conversion

    if (Q === undefined || Q < 0) errors.push("Gas flow (Q) is required when gas is enabled.");
    if (holeCount === undefined || !Number.isInteger(holeCount) || holeCount <= 0)
      errors.push("Hole count must be a positive integer.");
    if (dHole === undefined || dHole <= 0) errors.push("Hole diameter is required and must be > 0.");
    if (rhoGas === undefined || rhoGas <= 0) errors.push("Gas density is required and must be > 0.");
    if (muGas === undefined || muGas <= 0) errors.push("Gas viscosity is required and must be > 0.");

    if (
      Q !== undefined &&
      holeCount !== undefined &&
      dHole !== undefined &&
      rhoGas !== undefined &&
      muGas !== undefined
    ) {
      gas = {
        gasFlow: Q,
        holeCount,
        holeDiameter: dHole,
        gasDensity: rhoGas,
        gasViscosity: muGas,
        ...(wakeEdr !== undefined ? { wakeEdr } : {}),
      };
    }
  }

  if (errors.length > 0) return { errors };

  const point: OperatingPoint = {
    impeller: {
      ...(Np !== undefined ? { powerNumber: Np } : {}),
      impellerDiameter: D!,
      impellerSpeed: N!,
      ...(zoneVolume !== undefined ? { zoneVolume } : {}),
    },
    fluid: { workingVolume: V!, liquidDensity: rho!, liquidViscosity: mu! },
    ...(gas ? { gas } : {}),
  };

  return { point, errors };
}

/** Convert all populated numeric fields from one unit system to another. */
export function convertFormState(
  state: FormState,
  from: UnitSystem,
  to: UnitSystem,
): FormState {
  const map: Array<[keyof FormState, Quantity]> = [
    ["impellerDiameter", "impellerDiameter"],
    ["impellerSpeed", "impellerSpeed"],
    ["zoneVolume", "workingVolume"],
    ["bladeWidth", "impellerDiameter"],
    ["workingVolume", "workingVolume"],
    ["liquidDensity", "liquidDensity"],
    ["liquidViscosity", "liquidViscosity"],
    ["gasFlow", "gasFlow"],
    ["holeDiameter", "holeDiameter"],
    ["gasDensity", "liquidDensity"],
    ["gasViscosity", "liquidViscosity"],
  ];
  const next: FormState = { ...state };
  for (const [key, q] of map) {
    const s = state[key] as string;
    const n = num(s);
    if (n === undefined) continue;
    // display(from) → SI → display(to)
    const siVal = displayToEngine(n, q, from);
    (next[key] as string) = trimNumber(engineToDisplay(siVal, q, to));
  }
  return next;
}

function trimNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  // up to 6 significant digits, no trailing zeros
  return parseFloat(n.toPrecision(6)).toString();
}

// ---------------------------------------------------------------------------
// Scale-up form state.
//
// The REFERENCE vessel is the single-vessel form (FormState). The scale-up tab
// only adds the TARGET geometry and the criterion to hold constant.
// ---------------------------------------------------------------------------

export interface ScaleFormState {
  targetDiameter: string; // D₂
  targetVolume: string; // V₂
  targetZoneVolume: string; // optional V_zone at target
  targetPowerNumber: string; // optional Np override (defaults to reference)
  criterion: ScaleCriterion; // "pv" | "tipSpeed"
}

export const SCALE_DEFAULTS: Record<UnitSystem, ScaleFormState> = {
  SI: { targetDiameter: "0.2", targetVolume: "0.08", targetZoneVolume: "", targetPowerNumber: "", criterion: "pv" },
  practical: { targetDiameter: "200", targetVolume: "80", targetZoneVolume: "", targetPowerNumber: "", criterion: "pv" },
};

export interface BuildTargetResult {
  target?: TargetGeometry;
  errors: string[];
}

/** Build a TargetGeometry (SI) from scale-up form state. */
export function buildTargetGeometry(state: ScaleFormState, system: UnitSystem): BuildTargetResult {
  const errors: string[] = [];
  const D = si(state.targetDiameter, "impellerDiameter", system);
  const V = si(state.targetVolume, "workingVolume", system);
  const zone = si(state.targetZoneVolume, "workingVolume", system);
  const Np = num(state.targetPowerNumber);

  if (D === undefined || D <= 0) errors.push("Target diameter (D₂) is required and must be > 0.");
  if (V === undefined || V <= 0) errors.push("Target working volume (V₂) is required and must be > 0.");
  if (state.targetPowerNumber.trim() !== "" && (Np === undefined || Np <= 0))
    errors.push("Target Np override must be > 0.");

  if (errors.length > 0) return { errors };

  const target: TargetGeometry = {
    impellerDiameter: D!,
    workingVolume: V!,
    ...(zone !== undefined ? { zoneVolume: zone } : {}),
    ...(Np !== undefined ? { powerNumber: Np } : {}),
  };
  return { target, errors };
}

// ---------------------------------------------------------------------------
// Oxygen-transfer (kLa/OTR) form state.
//
// The REFERENCE vessel (single-vessel form) supplies P/V; the OTR tab adds its
// own gas flow + tank diameter (so it works regardless of the gas toggle) plus
// the mass-transfer and cell-demand parameters.
// ---------------------------------------------------------------------------

export interface OtrFormState {
  gasFlow: string; // Q_gas (for superficial velocity)
  tankDiameter: string; // D_tank
  kLaA: string; // correlation A
  kLaAlpha: string; // correlation α
  kLaBeta: string; // correlation β
  saturation: string; // C* (mmol/L)
  doPercent: string; // DO setpoint, % of saturation
  specificOUR: string; // qO2 (mmol/(10⁹ cells·h))
  cellDensity: string; // X (10⁶ cells/mL)
}

export const OTR_DEFAULTS: Record<UnitSystem, OtrFormState> = {
  SI: {
    gasFlow: "0.00006", // m³/s (≈ 3.6 L/min)
    tankDiameter: "0.2", // m
    kLaA: "0.026",
    kLaAlpha: "0.4",
    kLaBeta: "0.5",
    saturation: "0.21", // mmol/L (air-saturated, ~37 °C)
    doPercent: "40",
    specificOUR: "0.3", // mmol/(10⁹ cells·h)
    cellDensity: "10", // 10⁶ cells/mL
  },
  practical: {
    gasFlow: "3.6", // L/min
    tankDiameter: "200", // mm
    kLaA: "0.026",
    kLaAlpha: "0.4",
    kLaBeta: "0.5",
    saturation: "0.21",
    doPercent: "40",
    specificOUR: "0.3",
    cellDensity: "10",
  },
};

export interface BuildOxygenResult {
  inputs?: OxygenBalanceInputs;
  /** P/V [W/m³] derived from the reference vessel (for display). */
  powerPerVolume?: number;
  errors: string[];
}

/**
 * Build OxygenBalanceInputs (SI) from the OTR form plus the reference vessel.
 * Requires the reference to have a power number (Np) so P/V can be computed.
 */
export function buildOxygenInputs(
  otr: OtrFormState,
  reference: FormState,
  system: UnitSystem,
): BuildOxygenResult {
  const errors: string[] = [];

  const ref = buildOperatingPoint(reference, system);
  if (!ref.point) {
    return { errors: ["Complete the reference vessel (Single Vessel tab) first."] };
  }
  const Np = ref.point.impeller.powerNumber;
  if (Np === undefined) {
    return { errors: ["Enter the power number (Np) on the Single Vessel tab to compute P/V."] };
  }
  const P = powerInput(Np, ref.point.fluid.liquidDensity, ref.point.impeller.impellerSpeed, ref.point.impeller.impellerDiameter);
  const pv = powerPerVolume(P, ref.point.fluid.workingVolume);

  const Q = si(otr.gasFlow, "gasFlow", system);
  const Dt = si(otr.tankDiameter, "tankDiameter", system);
  const A = num(otr.kLaA);
  const alpha = num(otr.kLaAlpha);
  const beta = num(otr.kLaBeta);
  const cStar = si(otr.saturation, "oxygenConc", system);
  const doPct = num(otr.doPercent);
  const qO2 = si(otr.specificOUR, "specificOUR", system);
  const X = si(otr.cellDensity, "cellDensity", system);

  if (Q === undefined || Q < 0) errors.push("Gas flow (Q) is required and must be ≥ 0.");
  if (Dt === undefined || Dt <= 0) errors.push("Tank diameter is required and must be > 0.");
  if (A === undefined || A <= 0) errors.push("kLa coefficient A must be > 0.");
  if (alpha === undefined) errors.push("kLa exponent α is required.");
  if (beta === undefined) errors.push("kLa exponent β is required.");
  if (cStar === undefined || cStar <= 0) errors.push("Saturation O₂ (C*) must be > 0.");
  if (doPct === undefined || doPct < 0 || doPct >= 100)
    errors.push("DO setpoint must be in [0, 100) %.");
  if (qO2 === undefined || qO2 < 0) errors.push("Specific OUR (qO2) must be ≥ 0.");
  if (X === undefined || X < 0) errors.push("Cell density (X) must be ≥ 0.");

  if (errors.length > 0) return { errors, powerPerVolume: pv };

  const inputs: OxygenBalanceInputs = {
    powerPerVolume: pv,
    gasFlow: Q!,
    tankDiameter: Dt!,
    kLaConstants: { A: A!, alpha: alpha!, beta: beta! },
    saturation: cStar!,
    doFraction: doPct! / 100,
    specificOUR: qO2!,
    cellDensity: X!,
  };
  return { inputs, powerPerVolume: pv, errors };
}

/** Convert OTR form fields that depend on the unit system (gas flow, tank diameter). */
export function convertOtrState(
  state: OtrFormState,
  from: UnitSystem,
  to: UnitSystem,
): OtrFormState {
  const map: Array<[keyof OtrFormState, Quantity]> = [
    ["gasFlow", "gasFlow"],
    ["tankDiameter", "tankDiameter"],
  ];
  const next: OtrFormState = { ...state };
  for (const [key, q] of map) {
    const n = num(state[key] as string);
    if (n === undefined) continue;
    (next[key] as string) = trimNumber(engineToDisplay(displayToEngine(n, q, from), q, to));
  }
  return next;
}

/** Convert scale-up form numeric fields between unit systems. */
export function convertScaleState(
  state: ScaleFormState,
  from: UnitSystem,
  to: UnitSystem,
): ScaleFormState {
  const map: Array<[keyof ScaleFormState, Quantity]> = [
    ["targetDiameter", "impellerDiameter"],
    ["targetVolume", "workingVolume"],
    ["targetZoneVolume", "workingVolume"],
  ];
  const next: ScaleFormState = { ...state };
  for (const [key, q] of map) {
    const n = num(state[key] as string);
    if (n === undefined) continue;
    (next[key] as string) = trimNumber(engineToDisplay(displayToEngine(n, q, from), q, to));
  }
  return next;
}
