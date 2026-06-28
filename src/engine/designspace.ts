// Design-space feasibility map (feature/design-space-plot).
//
// Sweeps impeller speed (N, x-axis) against working volume (V, y-axis) for a
// fixed vessel geometry/fluid/sparger, and reports the window verdict at each
// grid cell. This reuses evaluateOperatingPoint as the single source of truth,
// so the shaded region always agrees with the single-vessel tab.
//
// Pure, SI units. Np is required (the P/V-driven boundary is the whole point);
// the caller should gate on its presence.

import { evaluateOperatingPoint } from "./constraints";
import type { OperatingPoint, WindowStatus } from "./types";

export interface DesignSpaceOptions {
  /** Number of impeller-speed samples (x). */
  nSteps?: number;
  /** Number of working-volume samples (y). */
  vSteps?: number;
}

export interface DesignSpaceResult {
  /** Cell-center impeller speeds [rev/s], length nSteps. */
  nValues: number[];
  /** Cell-center working volumes [m³], length vSteps. */
  vValues: number[];
  /** Window verdict per cell, indexed [vIndex][nIndex]. */
  grid: WindowStatus[][];
  /** Axis extents [min, max] in SI. */
  nRange: [number, number];
  vRange: [number, number];
  /** The base operating point's (N, V), for marking "you are here". */
  current: { n: number; v: number };
}

/**
 * Compute the feasibility grid around a base operating point.
 *
 * The axis ranges are framed around the binding impeller limits so the feasible
 * boundary is visible: impeller speed spans 0 to ~1.4× the more restrictive of
 * the tip-speed and P/V critical speeds; working volume spans 0.2×–5× the base
 * volume.
 *
 * @throws if the base point has no power number (Np).
 */
export function computeDesignSpace(
  base: OperatingPoint,
  opts: DesignSpaceOptions = {},
): DesignSpaceResult {
  const Np = base.impeller.powerNumber;
  if (Np === undefined) {
    throw new Error("Power number (Np) is required to compute the design space.");
  }
  const nSteps = opts.nSteps ?? 64;
  const vSteps = opts.vSteps ?? 44;

  const D = base.impeller.impellerDiameter;
  const rho = base.fluid.liquidDensity;
  const currentN = base.impeller.impellerSpeed;
  const currentV = base.fluid.workingVolume;

  // Critical speeds at the base volume.
  const nTip = 1.5 / (Math.PI * D); // tip speed = 1.5 m/s
  const nPv = Math.cbrt((50 * currentV) / (Np * rho * D ** 5)); // P/V = 50 W/m³
  const nCrit = Math.min(nTip, nPv);

  const nMin = 0;
  const nMax = Math.max(1.4 * nCrit, 1.25 * currentN, nCrit > 0 ? nCrit : 1);
  const vMin = 0.2 * currentV;
  const vMax = 5 * currentV;

  const nValues = centers(nMin, nMax, nSteps);
  const vValues = centers(vMin, vMax, vSteps);

  const grid: WindowStatus[][] = vValues.map((v) =>
    nValues.map((n) => {
      const cell: OperatingPoint = {
        impeller: { ...base.impeller, impellerSpeed: n },
        fluid: { ...base.fluid, workingVolume: v },
        ...(base.gas ? { gas: base.gas } : {}),
      };
      return evaluateOperatingPoint(cell).window;
    }),
  );

  return {
    nValues,
    vValues,
    grid,
    nRange: [nMin, nMax],
    vRange: [vMin, vMax],
    current: { n: currentN, v: currentV },
  };
}

/** Evenly spaced cell-center values across [min, max]. */
function centers(min: number, max: number, steps: number): number[] {
  const span = max - min;
  const out: number[] = new Array(steps);
  for (let i = 0; i < steps; i++) {
    out[i] = min + ((i + 0.5) / steps) * span;
  }
  return out;
}
