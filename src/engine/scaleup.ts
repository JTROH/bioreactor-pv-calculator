// Scale-up solver (M6).
//
// Given a fully specified REFERENCE operating point and a TARGET vessel
// geometry, solve the target impeller speed N₂ that holds a chosen criterion
// constant (P/V or tip speed), build the full target operating point, and
// re-run the constraint set at the new scale so the user sees what becomes
// binding.
//
// Pure, SI units. Builds on impeller.ts and constraints.ts.

import { powerInput, powerPerVolume, tipSpeed, impellerReynolds } from "./impeller";
import { evaluateOperatingPoint, THRESHOLDS } from "./constraints";
import type {
  EvaluationResult,
  FluidInputs,
  GasInputs,
  OperatingPoint,
} from "./types";

/** Criterion held constant during scale-up. */
export type ScaleCriterion = "pv" | "tipSpeed";

/** Target vessel definition. Fluid properties and Np default to the reference. */
export interface TargetGeometry {
  /** Target impeller diameter D₂ [m]. */
  impellerDiameter: number;
  /** Target working volume V₂ [m³]. */
  workingVolume: number;
  /** Target impeller swept volume V_zone [m³] (optional; for local EDR). */
  zoneVolume?: number;
  /** Power-zone fraction (optional; default carries from impeller model). */
  zoneFraction?: number;
  /**
   * Power number Np at target. Defaults to the reference Np — appropriate when
   * the same impeller design is used at both scales (Np is ≈ constant in the
   * fully turbulent regime). Override if the target uses a different impeller.
   */
  powerNumber?: number;
  /** Override fluid properties at target (density/viscosity). Volume comes from `workingVolume`. */
  fluid?: Partial<Pick<FluidInputs, "liquidDensity" | "liquidViscosity">>;
  /** Target gas/sparging configuration (optional). */
  gas?: GasInputs;
}

export interface ScaleUpResult {
  criterion: ScaleCriterion;
  /** Solved target impeller speed N₂ [rev/s]. */
  solvedSpeed: number;
  /** The held quantity's value (SI): P/V [W/m³] or tip speed [m/s]. */
  heldValue: number;
  /** Fully built target operating point (with solvedSpeed applied). */
  target: OperatingPoint;
  /** Constraint evaluation at the target scale. */
  evaluation: EvaluationResult;
  /** Non-fatal advisories (e.g. invalid-regime warnings). */
  warnings: string[];
}

// --- closed-form speed solvers ---------------------------------------------

/**
 * Solve impeller speed to achieve a target P/V.
 * From P/V = Np·ρ·N³·D⁵ / V  →  N = ( (P/V)·V / (Np·ρ·D⁵) )^(1/3)
 */
export function solveSpeedForPowerPerVolume(
  targetPV: number,
  powerNumber: number,
  density: number,
  diameter: number,
  workingVolume: number,
): number {
  if (!(targetPV >= 0)) throw new Error(`Target P/V must be ≥ 0 (got ${targetPV})`);
  if (!(powerNumber > 0)) throw new Error(`Power number (Np) must be > 0 to solve for speed (got ${powerNumber})`);
  if (!(density > 0 && diameter > 0 && workingVolume > 0)) {
    throw new Error("density, diameter, and working volume must be positive");
  }
  return Math.cbrt((targetPV * workingVolume) / (powerNumber * density * diameter ** 5));
}

/**
 * Solve impeller speed to achieve a target tip speed.
 * From v_tip = π·N·D  →  N = v_tip / (π·D)
 */
export function solveSpeedForTipSpeed(targetTipSpeed: number, diameter: number): number {
  if (!(targetTipSpeed >= 0)) throw new Error(`Target tip speed must be ≥ 0 (got ${targetTipSpeed})`);
  if (!(diameter > 0)) throw new Error(`Diameter must be > 0 (got ${diameter})`);
  return targetTipSpeed / (Math.PI * diameter);
}

// --- main scale-up routine --------------------------------------------------

/**
 * Scale a reference operating point to a target geometry, holding `criterion`
 * constant, and re-evaluate all constraints at the new scale.
 */
export function scaleUp(
  reference: OperatingPoint,
  target: TargetGeometry,
  criterion: ScaleCriterion,
): ScaleUpResult {
  const warnings: string[] = [];
  const rho = reference.fluid.liquidDensity;
  const mu = reference.fluid.liquidViscosity;
  const refD = reference.impeller.impellerDiameter;
  const refN = reference.impeller.impellerSpeed;
  const refNp = reference.impeller.powerNumber;

  // Validity gate: P/V scaling requires a fully turbulent reference.
  const refReynolds = impellerReynolds(rho, refN, refD, mu);
  if (criterion === "pv" && refReynolds <= THRESHOLDS.reynoldsMin) {
    warnings.push(
      `Reference impeller Reynolds number is ${refReynolds.toFixed(0)} (≤ ${THRESHOLDS.reynoldsMin}); ` +
        `P/V is not a valid scale-up basis outside the fully turbulent regime.`,
    );
  }

  const targetNp = target.powerNumber ?? refNp;
  const targetFluid: FluidInputs = {
    workingVolume: target.workingVolume,
    liquidDensity: target.fluid?.liquidDensity ?? rho,
    liquidViscosity: target.fluid?.liquidViscosity ?? mu,
  };

  // Compute the held value and solve N₂.
  let solvedSpeed: number;
  let heldValue: number;
  if (criterion === "pv") {
    if (refNp === undefined) {
      throw new Error("Reference power number (Np) is required to hold P/V constant during scale-up.");
    }
    if (targetNp === undefined) {
      throw new Error("Target power number (Np) is required to hold P/V constant during scale-up.");
    }
    const refPower = powerInput(refNp, rho, refN, refD);
    heldValue = powerPerVolume(refPower, reference.fluid.workingVolume);
    solvedSpeed = solveSpeedForPowerPerVolume(
      heldValue,
      targetNp,
      targetFluid.liquidDensity,
      target.impellerDiameter,
      target.workingVolume,
    );
  } else {
    heldValue = tipSpeed(refN, refD);
    solvedSpeed = solveSpeedForTipSpeed(heldValue, target.impellerDiameter);
  }

  // Build the target operating point and evaluate it.
  const targetPoint: OperatingPoint = {
    impeller: {
      powerNumber: targetNp,
      impellerDiameter: target.impellerDiameter,
      impellerSpeed: solvedSpeed,
      zoneVolume: target.zoneVolume,
      zoneFraction: target.zoneFraction,
    },
    fluid: targetFluid,
    gas: target.gas,
  };
  const evaluation = evaluateOperatingPoint(targetPoint);

  if (evaluation.window === "outside") {
    warnings.push(
      `At target scale the operating point is OUTSIDE the shear-proof window ` +
        `(binding: ${evaluation.violated.join(", ")}).`,
    );
  }

  return { criterion, solvedSpeed, heldValue, target: targetPoint, evaluation, warnings };
}
