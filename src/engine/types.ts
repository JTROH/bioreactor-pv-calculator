// Core domain types for the P/V calculation engine.
//
// The engine is pure and works exclusively in SI. The UI converts to/from
// practical units at its boundary (units.ts) and never passes non-SI values in.

/**
 * Verdict for a single constraint check:
 *  - "ok"        within its safe limit (green)
 *  - "violated"  outside its limit (red alert)
 *  - "advisory"  reported value with no hard pass/fail limit (e.g. VVM)
 *  - "unknown"   cannot be evaluated yet (a required input is missing, e.g. Np)
 */
export type ConstraintStatus = "ok" | "violated" | "advisory" | "unknown";

/** Result of evaluating one engineering quantity against its threshold. */
export interface ConstraintResult {
  /** Stable identifier, e.g. "pv", "tipSpeed", "impellerReynolds". */
  id: string;
  /** Human-readable label, e.g. "Tip speed". */
  label: string;
  /** Computed value in SI units (NaN when status is "unknown"). */
  value: number;
  /** SI unit string for `value`, e.g. "m/s" (engine-side; UI converts). */
  unit: string;
  /** Pass/fail/advisory/unknown verdict. */
  status: ConstraintStatus;
  /** Short message shown to the user (especially when violated or unknown). */
  message?: string;
}

// ---------------------------------------------------------------------------
// Operating-point inputs (all SI).
// ---------------------------------------------------------------------------

/** Impeller geometry and operation. */
export interface ImpellerInputs {
  /**
   * Power number Np (dimensionless). REQUIRED end-user input for any
   * power-derived metric (P, P/V, local EDR, microeddy length). Bioreactor/
   * impeller specific — empirical or vendor-supplied. The engine NEVER defaults
   * it. Optional in the type only so Np-independent metrics (tip speed,
   * Reynolds) can be evaluated before it is entered.
   */
  powerNumber?: number;
  /** Impeller diameter D [m]. */
  impellerDiameter: number;
  /** Impeller rotational speed N [rev/s]. */
  impellerSpeed: number;
  /** Liquid volume swept by the impeller, V_zone [m³] (optional; for local EDR). */
  zoneVolume?: number;
  /** Fraction of power dissipated in the impeller zone (optional; default 0.705). */
  zoneFraction?: number;
}

/** Liquid (broth) properties and working volume. */
export interface FluidInputs {
  /** Working volume V [m³]. */
  workingVolume: number;
  /** Liquid density ρ [kg/m³]. */
  liquidDensity: number;
  /** Liquid dynamic viscosity μ [Pa·s]. */
  liquidViscosity: number;
}

/** Gas sparging configuration (optional — a vessel may be evaluated impeller-only). */
export interface GasInputs {
  /** Gas volumetric flow Q_gas [m³/s]. */
  gasFlow: number;
  /** Number of sparger holes n_holes [–]. */
  holeCount: number;
  /** Sparger hole diameter d_hole [m]. */
  holeDiameter: number;
  /** Gas density ρ_gas [kg/m³]. */
  gasDensity: number;
  /** Gas dynamic viscosity μ_gas [Pa·s]. */
  gasViscosity: number;
  /** Bubble-wake energy dissipation rate ε_wake [m²/s³] (optional; see §7). */
  wakeEdr?: number;
}

/** A complete operating point for one stirred-tank bioreactor. */
export interface OperatingPoint {
  impeller: ImpellerInputs;
  fluid: FluidInputs;
  gas?: GasInputs;
}

// ---------------------------------------------------------------------------
// Evaluation output.
// ---------------------------------------------------------------------------

/** Whether the operating point sits inside the shear-proof design space. */
export type WindowStatus = "inside" | "outside" | "indeterminate";

/** Aggregate result of evaluating an operating point. */
export interface EvaluationResult {
  /** One entry per engineering quantity, in display order. */
  constraints: ConstraintResult[];
  /** Overall verdict across all hard (pass/fail) constraints. */
  window: WindowStatus;
  /** ids of violated constraints (when window === "outside"). */
  violated: string[];
  /**
   * ids of CORE constraints that could not be evaluated because a REQUIRED
   * input is missing (e.g. Np). These keep the window "indeterminate".
   */
  unknown: string[];
  /**
   * ids of OPTIONAL/advanced constraints skipped because an optional input was
   * not provided (e.g. V_zone, bubble-wake EDR). These do NOT block an "inside"
   * verdict; they are surfaced as a note.
   */
  skipped: string[];
}
