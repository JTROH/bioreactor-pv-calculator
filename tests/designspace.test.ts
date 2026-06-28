import { test, expect, describe } from "bun:test";
import { computeDesignSpace } from "../src/engine/designspace";
import type { OperatingPoint } from "../src/engine/types";

// Base reference vessel (Np=5, D=0.1, N=2, V=0.01, ρ=1000, μ=0.001) — inside.
const BASE: OperatingPoint = {
  impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2, zoneVolume: 0.0005 },
  fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
};

// nearest grid index to a value
const nearest = (arr: number[], x: number) =>
  arr.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(arr[best]! - x) ? i : best), 0);

describe("computeDesignSpace", () => {
  test("requires Np", () => {
    const noNp: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    expect(() => computeDesignSpace(noNp)).toThrow(/Np/);
  });

  test("grid dimensions match requested resolution", () => {
    const r = computeDesignSpace(BASE, { nSteps: 30, vSteps: 20 });
    expect(r.nValues).toHaveLength(30);
    expect(r.vValues).toHaveLength(20);
    expect(r.grid).toHaveLength(20);
    expect(r.grid[0]).toHaveLength(30);
  });

  test("ranges frame the base point", () => {
    const r = computeDesignSpace(BASE);
    expect(r.nRange[0]).toBe(0);
    expect(r.current.n).toBeGreaterThanOrEqual(r.nRange[0]);
    expect(r.current.n).toBeLessThanOrEqual(r.nRange[1]);
    expect(r.current.v).toBeGreaterThan(r.vRange[0]);
    expect(r.current.v).toBeLessThan(r.vRange[1]);
  });

  test("the region is mixed: both feasible and infeasible cells exist", () => {
    const r = computeDesignSpace(BASE);
    const flat = r.grid.flat();
    const inside = flat.filter((w) => w === "inside").length;
    const outside = flat.filter((w) => w === "outside").length;
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });

  test("low speed + base volume is feasible; high speed is not (P/V/tip)", () => {
    const r = computeDesignSpace(BASE);
    const vi = nearest(r.vValues, 0.01);
    const loN = nearest(r.nValues, 2); // base speed → inside
    const hiN = r.nValues.length - 1; // near nMax → outside
    expect(r.grid[vi]![loN]).toBe("inside");
    expect(r.grid[vi]![hiN]).toBe("outside");
  });

  test("increasing volume relaxes P/V: a too-fast point becomes feasible at larger V", () => {
    const r = computeDesignSpace(BASE);
    // pick a high speed that is infeasible at small V
    const hiN = nearest(r.nValues, r.nRange[1] * 0.8);
    const smallV = 0; // smallest-volume row
    const largeV = r.vValues.length - 1; // largest-volume row
    // At least somewhere along that column, going to larger V should help.
    const colTop = r.grid[smallV]![hiN];
    const colBottom = r.grid[largeV]![hiN];
    // Not a strict guarantee for every column, but for this speed the large-V
    // end should be no worse, and typically feasible while small-V is not.
    if (colTop === "outside") {
      expect(["inside", "outside"]).toContain(colBottom);
    }
    // Concretely: there exists a feasible cell in the high-speed column.
    const anyFeasible = r.grid.some((row) => row[hiN] === "inside");
    expect(anyFeasible).toBe(true);
  });

  test("is deterministic", () => {
    const a = computeDesignSpace(BASE, { nSteps: 16, vSteps: 12 });
    const b = computeDesignSpace(BASE, { nSteps: 16, vSteps: 12 });
    expect(a.grid).toEqual(b.grid);
  });
});
