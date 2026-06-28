// Gas / sparging-side physics (M4).
//
// Pure functions, SI units throughout. Corresponds to PROJECT_PLAN.md §2.2 /
// guidance PDF §3. Volumetric flow is in m³/s (the SI base used by units.ts);
// the UI converts from L/min etc. at its boundary.
//
// Most cell death in a bioreactor comes from bubble-burst shear, so these
// sparger constraints matter as much as the impeller ones.

import { kolmogorovLength } from "./impeller";

function requirePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number (got ${value})`);
  }
}

function requireNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number (got ${value})`);
  }
}

function requirePositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (got ${value})`);
  }
}

/** Cross-sectional area of one circular sparger hole.  A = (π/4)·d²   [m²] */
export function holeArea(holeDiameter: number): number {
  requirePositive("Hole diameter (d)", holeDiameter);
  return (Math.PI / 4) * holeDiameter ** 2;
}

/**
 * Gas volumetric rate as VVM (gas volume per liquid volume per minute).
 *
 * VVM = Q_gas / V_liquid, expressed per MINUTE. Engine flow is m³/s, so we
 * multiply by 60 s/min.   [min⁻¹]
 *
 * @param gasFlow       Q_gas    [m³/s]
 * @param liquidVolume  V_liquid [m³]
 */
export function vvm(gasFlow: number, liquidVolume: number): number {
  requireNonNegative("Gas flow (Q_gas)", gasFlow);
  requirePositive("Liquid volume (V)", liquidVolume);
  return (gasFlow / liquidVolume) * 60;
}

/**
 * Gas-entrance (sparger-hole) velocity.
 *
 * v_gas = Q_gas / (n_holes · A_hole)   [m/s]
 *
 * Keep < 30 m/s (checked in constraints.ts) to avoid loss of viability and
 * productivity.
 *
 * @param gasFlow      Q_gas       [m³/s]
 * @param holeCount    n_holes     [–] positive integer
 * @param holeDiameter d           [m]
 */
export function gasEntranceVelocity(
  gasFlow: number,
  holeCount: number,
  holeDiameter: number,
): number {
  requireNonNegative("Gas flow (Q_gas)", gasFlow);
  requirePositiveInt("Hole count (n_holes)", holeCount);
  return gasFlow / (holeCount * holeArea(holeDiameter));
}

/**
 * Orifice Reynolds number at a sparger hole.
 *
 * N_Re,orifice = ρ_gas · v_gas · d_hole / μ_gas   [dimensionless]
 *
 * Keep < 2,000 (checked in constraints.ts); near ~2,000 the system approaches
 * the jetting regime where bubbles are poorly dispersed.
 *
 * @param gasDensity   ρ_gas  [kg/m³]
 * @param gasVelocity  v_gas  [m/s]  (from gasEntranceVelocity)
 * @param holeDiameter d_hole [m]
 * @param gasViscosity μ_gas  [Pa·s]
 */
export function orificeReynolds(
  gasDensity: number,
  gasVelocity: number,
  holeDiameter: number,
  gasViscosity: number,
): number {
  requirePositive("Gas density (ρ_gas)", gasDensity);
  requireNonNegative("Gas velocity (v_gas)", gasVelocity);
  requirePositive("Hole diameter (d_hole)", holeDiameter);
  requirePositive("Gas viscosity (μ_gas)", gasViscosity);
  return (gasDensity * gasVelocity * holeDiameter) / gasViscosity;
}

/**
 * Bubble-wake microeddy length, from the wake energy dissipation rate, via the
 * same Kolmogorov relation as the impeller side:  λ = (ν³/ε)^(1/4)   [m]
 * with the LIQUID's kinematic viscosity ν = μ/ρ.
 *
 * Keep > 20 µm (checked in constraints.ts).
 *
 * NOTE: the wake EDR itself (ε_wake) is geometry/regime-dependent and is not
 * fully specified by the source article (PROJECT_PLAN.md §7). v1 therefore takes
 * ε_wake as an explicit input rather than deriving it; the eddy-length physics
 * here is exact given that input.
 *
 * @param wakeEdr         ε_wake [m²/s³]
 * @param liquidViscosity μ      [Pa·s]
 * @param liquidDensity   ρ      [kg/m³]
 */
export function bubbleWakeEddyLength(
  wakeEdr: number,
  liquidViscosity: number,
  liquidDensity: number,
): number {
  return kolmogorovLength(wakeEdr, liquidViscosity, liquidDensity);
}
