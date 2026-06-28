// Impeller-side physics (M3).
//
// Pure functions, SI units throughout. Each corresponds to a row of the
// engineering spec in PROJECT_PLAN.md §2.1 / the guidance PDF §2. No DOM, no
// React, no unit conversion here — callers pass SI values (the UI converts at
// its boundary via units.ts).
//
// Sign/validity conventions:
//  - Physical inputs that must be positive (D, ρ, μ, V) throw on ≤ 0.
//  - Impeller speed N may be 0 (a stopped impeller is valid: zero power/shear).

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

/**
 * Impeller power input.  P = Np · ρ · N³ · D⁵   [W]
 *
 * @param powerNumber Np — dimensionless, REQUIRED user input (bioreactor/impeller
 *   specific; empirical or vendor-supplied). The engine never defaults it.
 * @param density     ρ  [kg/m³]
 * @param speed       N  [rev/s]
 * @param diameter    D  [m]
 */
export function powerInput(
  powerNumber: number,
  density: number,
  speed: number,
  diameter: number,
): number {
  requireNonNegative("Power number (Np)", powerNumber);
  requirePositive("Density (ρ)", density);
  requireNonNegative("Impeller speed (N)", speed);
  requirePositive("Impeller diameter (D)", diameter);
  return powerNumber * density * speed ** 3 * diameter ** 5;
}

/**
 * Power per unit volume.  P/V   [W/m³]
 *
 * @param power          P [W]
 * @param workingVolume  V [m³]
 */
export function powerPerVolume(power: number, workingVolume: number): number {
  requireNonNegative("Power (P)", power);
  requirePositive("Working volume (V)", workingVolume);
  return power / workingVolume;
}

/**
 * Impeller Reynolds number.  N_Re = ρ · N · D² / μ   [dimensionless]
 *
 * Must exceed 10,000 (fully turbulent) for P/V scaling to be valid — that
 * threshold is checked in constraints.ts, not here.
 *
 * @param density   ρ [kg/m³]
 * @param speed     N [rev/s]
 * @param diameter  D [m]
 * @param viscosity μ [Pa·s]
 */
export function impellerReynolds(
  density: number,
  speed: number,
  diameter: number,
  viscosity: number,
): number {
  requirePositive("Density (ρ)", density);
  requireNonNegative("Impeller speed (N)", speed);
  requirePositive("Impeller diameter (D)", diameter);
  requirePositive("Viscosity (μ)", viscosity);
  return (density * speed * diameter ** 2) / viscosity;
}

/**
 * Impeller tip speed.  v_tip = π · N · D   [m/s]
 *
 * Depends only on N and D — independent of Np — so this is computable (and its
 * < 1.5 m/s alert is live) before a power number is entered.
 *
 * @param speed    N [rev/s]
 * @param diameter D [m]
 */
export function tipSpeed(speed: number, diameter: number): number {
  requireNonNegative("Impeller speed (N)", speed);
  requirePositive("Impeller diameter (D)", diameter);
  return Math.PI * speed * diameter;
}

/** Default fraction of total impeller power dissipated in the impeller zone,
 *  for a pitched-blade impeller (guidance PDF §2.3: ≈ 70.5%). */
export const PITCHED_BLADE_ZONE_FRACTION = 0.705;

/**
 * Localized impeller-zone power density.  (f · P) / V_zone   [W/m³]
 *
 * Average P/V hides shear heterogeneity; most power dissipates near the
 * impeller. This is the conservative metric compared against the 1×10⁵ W/m³
 * bound.
 *
 * @param power          P        [W] — total impeller power
 * @param zoneVolume     V_zone   [m³] — liquid volume swept by the impeller
 * @param zoneFraction   f        [–] — power fraction in the zone (default
 *   pitched-blade 0.705). See estimateSweptVolume for V_zone guidance.
 */
export function impellerZonePowerDensity(
  power: number,
  zoneVolume: number,
  zoneFraction: number = PITCHED_BLADE_ZONE_FRACTION,
): number {
  requireNonNegative("Power (P)", power);
  requirePositive("Impeller-zone volume (V_zone)", zoneVolume);
  if (!(zoneFraction > 0 && zoneFraction <= 1)) {
    throw new Error(`Zone fraction must be in (0, 1] (got ${zoneFraction})`);
  }
  return (zoneFraction * power) / zoneVolume;
}

/**
 * Energy dissipation rate from a power density.  ε = (P/V) / ρ   [m²/s³]
 *
 * Converts a W/m³ power density into the specific EDR used by the Kolmogorov
 * length. Use the impeller-zone power density for local microeddy assessment,
 * or the average P/V for a bulk estimate.
 *
 * @param powerDensity [W/m³]
 * @param density      ρ [kg/m³]
 */
export function energyDissipationRate(powerDensity: number, density: number): number {
  requireNonNegative("Power density", powerDensity);
  requirePositive("Density (ρ)", density);
  return powerDensity / density;
}

/**
 * Kolmogorov (microeddy) length.  λ = (ν³ / ε)^(1/4)   [m]
 * with kinematic viscosity ν = μ / ρ.
 *
 * Keep λ > 20 µm for mammalian cells (checked in constraints.ts).
 *
 * @param edr       ε [m²/s³] — local energy dissipation rate
 * @param viscosity μ [Pa·s]
 * @param density   ρ [kg/m³]
 */
export function kolmogorovLength(edr: number, viscosity: number, density: number): number {
  requirePositive("Energy dissipation rate (ε)", edr);
  requirePositive("Viscosity (μ)", viscosity);
  requirePositive("Density (ρ)", density);
  const kinematicViscosity = viscosity / density; // ν [m²/s]
  return (kinematicViscosity ** 3 / edr) ** 0.25;
}

/**
 * Rough estimate of the impeller swept (zone) volume, as a thin cylindrical
 * disc swept by the blades.  V_zone ≈ (π/4) · D² · w   [m³]
 *
 * This is a convenience default only — see PROJECT_PLAN.md §7 open item #1. The
 * user can always supply a measured/known V_zone directly to
 * impellerZonePowerDensity.
 *
 * @param diameter   D [m]
 * @param bladeWidth w [m] — axial height of the swept region
 */
export function estimateSweptVolume(diameter: number, bladeWidth: number): number {
  requirePositive("Impeller diameter (D)", diameter);
  requirePositive("Blade width (w)", bladeWidth);
  return (Math.PI / 4) * diameter ** 2 * bladeWidth;
}
