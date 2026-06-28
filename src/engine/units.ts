// Unit conversion layer (M2).
//
// The calculation engine works exclusively in SI. The UI lets the user enter
// and read values in either SI or "practical" bench units (RPM, L, cP, ...).
// This module is the single boundary where conversions happen, so the engine
// itself never sees a non-SI value.
//
// Design: every supported unit maps to its dimension and a linear factor to the
// SI base unit (no offsets are needed — there are no temperature-like units
// here). `convert` goes unit→unit within a dimension; `toSI`/`fromSI` are the
// thin wrappers the UI uses around the engine.

export type Dimension =
  | "length"
  | "volume"
  | "rotationalSpeed"
  | "density"
  | "dynamicViscosity"
  | "volumetricFlow"
  | "velocity"
  | "power"
  | "powerPerVolume"
  | "frequency"
  | "concentration"
  | "concentrationRate"
  | "cellDensity"
  | "specificRate"
  | "dimensionless";

export interface UnitDef {
  dim: Dimension;
  /** Multiply a value in this unit by `toSI` to get the SI base-unit value. */
  toSI: number;
  /** Label for display, defaults to the key. */
  label?: string;
}

/**
 * Registry of every supported unit symbol. Keys are the canonical symbols used
 * throughout the app. SI base unit of each dimension has `toSI: 1`.
 */
export const UNITS = {
  // length — SI base: m
  m: { dim: "length", toSI: 1 },
  cm: { dim: "length", toSI: 0.01 },
  mm: { dim: "length", toSI: 1e-3 },
  "µm": { dim: "length", toSI: 1e-6, label: "µm" },

  // volume — SI base: m³
  "m³": { dim: "volume", toSI: 1, label: "m³" },
  L: { dim: "volume", toSI: 1e-3 },
  mL: { dim: "volume", toSI: 1e-6 },

  // rotational speed — SI base: rev/s
  "rev/s": { dim: "rotationalSpeed", toSI: 1 },
  rpm: { dim: "rotationalSpeed", toSI: 1 / 60 },

  // density — SI base: kg/m³  (note: g/L is numerically identical to kg/m³)
  "kg/m³": { dim: "density", toSI: 1, label: "kg/m³" },
  "g/L": { dim: "density", toSI: 1, label: "g/L" },
  "g/mL": { dim: "density", toSI: 1000, label: "g/mL" },

  // dynamic viscosity — SI base: Pa·s
  "Pa·s": { dim: "dynamicViscosity", toSI: 1, label: "Pa·s" },
  "mPa·s": { dim: "dynamicViscosity", toSI: 1e-3, label: "mPa·s" },
  cP: { dim: "dynamicViscosity", toSI: 1e-3, label: "cP" }, // 1 cP = 1 mPa·s

  // volumetric flow — SI base: m³/s
  "m³/s": { dim: "volumetricFlow", toSI: 1, label: "m³/s" },
  "L/min": { dim: "volumetricFlow", toSI: 1e-3 / 60, label: "L/min" },
  "L/h": { dim: "volumetricFlow", toSI: 1e-3 / 3600, label: "L/h" },
  "mL/min": { dim: "volumetricFlow", toSI: 1e-6 / 60, label: "mL/min" },

  // velocity — SI base: m/s
  "m/s": { dim: "velocity", toSI: 1, label: "m/s" },

  // power — SI base: W
  W: { dim: "power", toSI: 1 },
  kW: { dim: "power", toSI: 1000 },

  // power per unit volume — SI base: W/m³
  "W/m³": { dim: "powerPerVolume", toSI: 1, label: "W/m³" },
  "W/L": { dim: "powerPerVolume", toSI: 1000, label: "W/L" },

  // mass-transfer coefficient kLa — SI base: 1/s
  "1/s": { dim: "frequency", toSI: 1, label: "1/s" },
  "1/h": { dim: "frequency", toSI: 1 / 3600, label: "1/h" },

  // dissolved-oxygen concentration — SI base: mol/m³ (≡ mmol/L numerically)
  "mol/m³": { dim: "concentration", toSI: 1, label: "mol/m³" },
  "mmol/L": { dim: "concentration", toSI: 1, label: "mmol/L" },

  // oxygen transfer/uptake rate — SI base: mol/(m³·s)
  "mol/(m³·s)": { dim: "concentrationRate", toSI: 1, label: "mol/(m³·s)" },
  "mmol/(L·h)": { dim: "concentrationRate", toSI: 1 / 3600, label: "mmol/(L·h)" },

  // viable cell density — SI base: cells/m³
  "cells/m³": { dim: "cellDensity", toSI: 1, label: "cells/m³" },
  "10⁶ cells/mL": { dim: "cellDensity", toSI: 1e12, label: "10⁶ cells/mL" },

  // specific oxygen uptake rate qO2 — SI base: mol/(cell·s)
  "mol/(cell·s)": { dim: "specificRate", toSI: 1, label: "mol/(cell·s)" },
  // 1 mmol/(10⁹ cells·h) = 1e-3 mol / (1e9 cells · 3600 s)
  "mmol/(10⁹ cells·h)": { dim: "specificRate", toSI: 1e-3 / (1e9 * 3600), label: "mmol/(10⁹ cells·h)" },

  // dimensionless (Reynolds, power number, ...)
  "": { dim: "dimensionless", toSI: 1, label: "" },
} satisfies Record<string, UnitDef>;

export type UnitSymbol = keyof typeof UNITS;

function def(unit: UnitSymbol): UnitDef {
  const d = UNITS[unit];
  if (!d) throw new Error(`Unknown unit: "${String(unit)}"`);
  return d;
}

/** Convert a value from one unit to another within the same dimension. */
export function convert(value: number, from: UnitSymbol, to: UnitSymbol): number {
  const f = def(from);
  const t = def(to);
  if (f.dim !== t.dim) {
    throw new Error(
      `Cannot convert "${String(from)}" (${f.dim}) to "${String(to)}" (${t.dim}): dimension mismatch`,
    );
  }
  return (value * f.toSI) / t.toSI;
}

/** Convert a value expressed in `unit` into its SI base-unit value. */
export function toSI(value: number, unit: UnitSymbol): number {
  return value * def(unit).toSI;
}

/** Convert an SI base-unit value into `unit`. */
export function fromSI(value: number, unit: UnitSymbol): number {
  return value / def(unit).toSI;
}

/** Display label for a unit symbol. */
export function unitLabel(unit: UnitSymbol): string {
  return def(unit).label ?? String(unit);
}

// ---------------------------------------------------------------------------
// Per-quantity unit presets for the SI ↔ practical toggle.
// `engineUnit` is the SI unit the engine expects; the UI converts to/from
// `displayUnit[system]` at the boundary.
// ---------------------------------------------------------------------------

export type UnitSystem = "SI" | "practical";

export type Quantity =
  | "impellerDiameter"
  | "impellerSpeed"
  | "workingVolume"
  | "liquidDensity"
  | "liquidViscosity"
  | "gasFlow"
  | "holeDiameter"
  | "power"
  | "powerPerVolume"
  | "tipSpeed"
  | "eddyLength"
  | "reynolds"
  | "tankDiameter"
  | "kLa"
  | "oxygenConc"
  | "oxygenRate"
  | "cellDensity"
  | "specificOUR";

interface QuantityUnits {
  /** SI unit the engine reads/writes for this quantity. */
  engineUnit: UnitSymbol;
  /** Unit shown in each UI system. */
  display: Record<UnitSystem, UnitSymbol>;
}

export const QUANTITY_UNITS: Record<Quantity, QuantityUnits> = {
  impellerDiameter: { engineUnit: "m", display: { SI: "m", practical: "mm" } },
  impellerSpeed: { engineUnit: "rev/s", display: { SI: "rev/s", practical: "rpm" } },
  workingVolume: { engineUnit: "m³", display: { SI: "m³", practical: "L" } },
  liquidDensity: { engineUnit: "kg/m³", display: { SI: "kg/m³", practical: "g/L" } },
  liquidViscosity: { engineUnit: "Pa·s", display: { SI: "Pa·s", practical: "cP" } },
  gasFlow: { engineUnit: "m³/s", display: { SI: "m³/s", practical: "L/min" } },
  holeDiameter: { engineUnit: "m", display: { SI: "m", practical: "mm" } },
  power: { engineUnit: "W", display: { SI: "W", practical: "W" } },
  powerPerVolume: { engineUnit: "W/m³", display: { SI: "W/m³", practical: "W/m³" } },
  tipSpeed: { engineUnit: "m/s", display: { SI: "m/s", practical: "m/s" } },
  eddyLength: { engineUnit: "m", display: { SI: "µm", practical: "µm" } },
  reynolds: { engineUnit: "", display: { SI: "", practical: "" } },
  // Tank diameter follows the same length units as the impeller.
  tankDiameter: { engineUnit: "m", display: { SI: "m", practical: "mm" } },
  // Oxygen/mass-transfer quantities use bioprocess-conventional units in BOTH
  // systems (1/h, mmol/L, 10⁶ cells/mL, ...) — these conventions are universal,
  // so they do not flip with the SI ↔ practical toggle.
  kLa: { engineUnit: "1/s", display: { SI: "1/h", practical: "1/h" } },
  oxygenConc: { engineUnit: "mol/m³", display: { SI: "mmol/L", practical: "mmol/L" } },
  oxygenRate: { engineUnit: "mol/(m³·s)", display: { SI: "mmol/(L·h)", practical: "mmol/(L·h)" } },
  cellDensity: { engineUnit: "cells/m³", display: { SI: "10⁶ cells/mL", practical: "10⁶ cells/mL" } },
  specificOUR: { engineUnit: "mol/(cell·s)", display: { SI: "mmol/(10⁹ cells·h)", practical: "mmol/(10⁹ cells·h)" } },
};

/** Engine (SI) unit for a quantity. */
export function engineUnit(q: Quantity): UnitSymbol {
  return QUANTITY_UNITS[q].engineUnit;
}

/** Display unit for a quantity under a given unit system. */
export function displayUnit(q: Quantity, system: UnitSystem): UnitSymbol {
  return QUANTITY_UNITS[q].display[system];
}

/** Take a user-entered value (in the display unit) and return the SI value. */
export function displayToEngine(value: number, q: Quantity, system: UnitSystem): number {
  return convert(value, displayUnit(q, system), engineUnit(q));
}

/** Take an SI value from the engine and return it in the display unit. */
export function engineToDisplay(value: number, q: Quantity, system: UnitSystem): number {
  return convert(value, engineUnit(q), displayUnit(q, system));
}
