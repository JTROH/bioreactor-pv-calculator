// Oxygen transfer / uptake modeling (feature/kla-otr-modeling).
//
// Pure functions, SI units throughout. Ties the tool's P/V into a standard
// kLa correlation and checks oxygen SUPPLY (OTR) against cell DEMAND (OUR).
//
// SI units used here:
//   P/V          W/m³
//   vs           m/s         superficial gas velocity
//   kLa          1/s
//   C* , C_L     mol/m³      dissolved-O₂ concentrations (≡ mmol/L numerically)
//   OTR, OUR     mol/(m³·s)
//   qO2          mol/(cell·s)
//   X            cells/m³
//
// HONESTY NOTE: the kLa correlation constants (A, α, β) are system-specific and
// MUST be supplied by the user. The Van't Riet (1979) presets below are common
// literature defaults for the form kLa = A·(P/V)^α·(vs)^β with P/V in W/m³ and
// vs in m/s giving kLa in 1/s; validate against your own gassing-out data.

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

/** Constants for kLa = A·(P/V)^α·(vs)^β  (SI: P/V in W/m³, vs in m/s → kLa in 1/s). */
export interface KLaConstants {
  A: number;
  alpha: number;
  beta: number;
}

/**
 * kLa correlation presets for kLa = A·(P/V)^α·(vs)^β (SI).
 *
 * - coalescing / nonCoalescing: classic Van't Riet (1979) water-based values.
 * - cellCulture: EXPONENTS from a cell-culture study (Xing et al. 2009, 5,000 L
 *   industrial bioreactor; P/V exponent 0.47, vs exponent 0.8 — vs dominates in
 *   cell culture). The coefficient A is not reported there, so the A below is an
 *   ILLUSTRATIVE calibration chosen to give kLa ≈ 10 1/h at typical cell-culture
 *   conditions (the magnitude cited by Hu & Wiltberger); calibrate A to your own
 *   gassing-out data.
 */
export const KLA_PRESETS = {
  /** Coalescing systems (pure water-like). */
  coalescing: { A: 0.026, alpha: 0.4, beta: 0.5 },
  /** Non-coalescing systems (salt/protein-containing media). */
  nonCoalescing: { A: 0.002, alpha: 0.7, beta: 0.2 },
  /** Cell-culture exponents (Xing 2009); A is an illustrative calibration. */
  cellCulture: { A: 0.075, alpha: 0.47, beta: 0.8 },
} as const satisfies Record<string, KLaConstants>;

/**
 * Superficial gas velocity.  vs = Q_gas / (π·D_tank²/4)   [m/s]
 *
 * @param gasFlow      Q_gas  [m³/s]
 * @param tankDiameter D_tank [m]
 */
export function superficialGasVelocity(gasFlow: number, tankDiameter: number): number {
  requireNonNegative("Gas flow (Q_gas)", gasFlow);
  requirePositive("Tank diameter (D_tank)", tankDiameter);
  const area = (Math.PI / 4) * tankDiameter ** 2;
  return gasFlow / area;
}

/**
 * Volumetric mass-transfer coefficient.  kLa = A·(P/V)^α·(vs)^β   [1/s]
 *
 * @param powerPerVolume P/V [W/m³]
 * @param superficialVel vs  [m/s]
 * @param k              correlation constants (user-supplied; see KLA_PRESETS)
 */
export function volumetricMassTransfer(
  powerPerVolume: number,
  superficialVel: number,
  k: KLaConstants,
): number {
  requireNonNegative("Power per volume (P/V)", powerPerVolume);
  requireNonNegative("Superficial gas velocity (vs)", superficialVel);
  requirePositive("kLa coefficient A", k.A);
  return k.A * powerPerVolume ** k.alpha * superficialVel ** k.beta;
}

/**
 * Maximum oxygen transfer rate at a DO setpoint.
 * OTR_max = kLa · C* · (1 − DO)   [mol/(m³·s)]
 *
 * The driving force is the gap between saturation C* and the controlled bulk
 * concentration C_L = DO·C*.
 *
 * @param kLa        [1/s]
 * @param saturation C*  [mol/m³]
 * @param doFraction DO setpoint as a fraction of saturation (0–1)
 */
export function oxygenTransferRate(kLa: number, saturation: number, doFraction: number): number {
  requireNonNegative("kLa", kLa);
  requirePositive("Saturation concentration (C*)", saturation);
  if (!(doFraction >= 0 && doFraction < 1)) {
    throw new Error(`DO setpoint fraction must be in [0, 1) (got ${doFraction})`);
  }
  return kLa * saturation * (1 - doFraction);
}

/**
 * Oxygen uptake rate (cell demand).  OUR = qO2 · X   [mol/(m³·s)]
 *
 * @param specificOUR qO2 [mol/(cell·s)]
 * @param cellDensity X   [cells/m³]
 */
export function oxygenUptakeRate(specificOUR: number, cellDensity: number): number {
  requireNonNegative("Specific OUR (qO2)", specificOUR);
  requireNonNegative("Cell density (X)", cellDensity);
  return specificOUR * cellDensity;
}

export interface OxygenBalanceInputs {
  powerPerVolume: number; // P/V [W/m³]
  gasFlow: number; // Q_gas [m³/s]
  tankDiameter: number; // D_tank [m]
  kLaConstants: KLaConstants;
  saturation: number; // C* [mol/m³]
  doFraction: number; // DO setpoint (0–1)
  specificOUR: number; // qO2 [mol/(cell·s)]
  cellDensity: number; // X [cells/m³]
}

export interface OxygenBalanceResult {
  superficialVel: number; // vs [m/s]
  kLa: number; // [1/s]
  otrMax: number; // [mol/(m³·s)]
  our: number; // [mol/(m³·s)]
  /** OTR_max ≥ OUR. */
  sufficient: boolean;
  /**
   * OTR_max / OUR. ≥ 1 means oxygen supply meets demand; the headroom (or
   * shortfall) is (ratio − 1). Infinity when OUR is zero.
   */
  ratio: number;
  /**
   * Maximum sustainable cell density at this OTR_max: X_max = OTR_max / qO2
   * [cells/m³]. Infinity when qO2 is zero.
   */
  maxCellDensity: number;
}

/** Full oxygen supply-vs-demand balance for an operating point. */
export function oxygenBalance(inp: OxygenBalanceInputs): OxygenBalanceResult {
  const superficialVel = superficialGasVelocity(inp.gasFlow, inp.tankDiameter);
  const kLa = volumetricMassTransfer(inp.powerPerVolume, superficialVel, inp.kLaConstants);
  const otrMax = oxygenTransferRate(kLa, inp.saturation, inp.doFraction);
  const our = oxygenUptakeRate(inp.specificOUR, inp.cellDensity);
  return {
    superficialVel,
    kLa,
    otrMax,
    our,
    sufficient: otrMax >= our,
    ratio: our > 0 ? otrMax / our : Infinity,
    maxCellDensity: inp.specificOUR > 0 ? otrMax / inp.specificOUR : Infinity,
  };
}
