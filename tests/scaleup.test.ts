import { test, expect, describe } from "bun:test";
import {
  scaleUp,
  solveSpeedForPowerPerVolume,
  solveSpeedForTipSpeed,
  type TargetGeometry,
} from "../src/engine/scaleup";
import { powerPerVolume, powerInput, tipSpeed } from "../src/engine/impeller";
import type { OperatingPoint } from "../src/engine/types";

const approx = (a: number, b: number, rel = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

// Reference: Np=5, D=0.1, N=2, ρ=1000, μ=0.001, V=0.01
//   → P/V = 40 W/m³, v_tip = 0.6283 m/s, N_Re = 20000
const REF: OperatingPoint = {
  impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2, zoneVolume: 0.0005 },
  fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
};

describe("closed-form solvers", () => {
  test("solveSpeedForPowerPerVolume inverts P = Np·ρ·N³·D⁵", () => {
    // target P/V = 40, D₂ = 0.2, V₂ = 0.08, Np=5, ρ=1000 → N₂ = cbrt(2) ≈ 1.2599
    const n = solveSpeedForPowerPerVolume(40, 5, 1000, 0.2, 0.08);
    approx(n, Math.cbrt(2));
    // forward-check: recompute P/V at solved speed equals 40
    approx(powerPerVolume(powerInput(5, 1000, n, 0.2), 0.08), 40);
  });

  test("solveSpeedForTipSpeed inverts π·N·D", () => {
    const vtip = tipSpeed(2, 0.1); // 0.6283
    const n = solveSpeedForTipSpeed(vtip, 0.2);
    approx(n, 1.0); // π·1·0.2 = π·2·0.1
    approx(tipSpeed(n, 0.2), vtip);
  });

  test("solvers reject bad inputs", () => {
    expect(() => solveSpeedForPowerPerVolume(40, 0, 1000, 0.2, 0.08)).toThrow(/Np/);
    expect(() => solveSpeedForTipSpeed(1, 0)).toThrow();
  });
});

describe("scaleUp holding P/V constant", () => {
  const target: TargetGeometry = { impellerDiameter: 0.2, workingVolume: 0.08, zoneVolume: 0.004 };
  const r = scaleUp(REF, target, "pv");

  test("held value is the reference P/V (40 W/m³)", () => {
    approx(r.heldValue, 40);
  });

  test("solved speed ≈ cbrt(2) rev/s", () => {
    approx(r.solvedSpeed, Math.cbrt(2));
  });

  test("P/V at target equals reference P/V by construction", () => {
    const pv = r.evaluation.constraints.find((c) => c.id === "pv")!;
    approx(pv.value, 40, 1e-9);
    expect(pv.status).toBe("ok");
  });

  test("target Np carried from reference", () => {
    expect(r.target.impeller.powerNumber).toBe(5);
  });

  test("target evaluation is inside the window", () => {
    expect(r.evaluation.window).toBe("inside");
    expect(r.warnings).toEqual([]);
  });
});

describe("scaleUp holding tip speed constant", () => {
  const target: TargetGeometry = { impellerDiameter: 0.2, workingVolume: 0.08, zoneVolume: 0.004 };
  const r = scaleUp(REF, target, "tipSpeed");

  test("held value is the reference tip speed", () => {
    approx(r.heldValue, tipSpeed(2, 0.1));
  });

  test("solved speed gives the same tip speed at D₂", () => {
    approx(r.solvedSpeed, 1.0);
    const ts = r.evaluation.constraints.find((c) => c.id === "tipSpeed")!;
    approx(ts.value, r.heldValue);
  });

  test("holding tip speed yields LOWER P/V at larger scale (here 20 vs 40)", () => {
    const pv = r.evaluation.constraints.find((c) => c.id === "pv")!;
    approx(pv.value, 20, 1e-9);
  });
});

describe("scale-up surfaces a constraint that becomes binding", () => {
  test("aggressive target P/V pushes tip speed over the limit → warning", () => {
    // Hold a high P/V by scaling DOWN to a tiny vessel: forces high N, high tip speed.
    const hot: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 8 }, // P/V large
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const target: TargetGeometry = { impellerDiameter: 0.05, workingVolume: 0.001 };
    const r = scaleUp(hot, target, "pv");
    expect(r.evaluation.window).toBe("outside");
    expect(r.warnings.some((w) => /OUTSIDE/.test(w))).toBe(true);
  });
});

describe("validity gates", () => {
  test("low-Reynolds reference warns when holding P/V", () => {
    const viscous: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 0.05 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 1 }, // Re = 0.5
    };
    const r = scaleUp(viscous, { impellerDiameter: 0.2, workingVolume: 0.08 }, "pv");
    expect(r.warnings.some((w) => /turbulent/.test(w))).toBe(true);
  });

  test("missing reference Np throws when holding P/V", () => {
    const noNp: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    expect(() => scaleUp(noNp, { impellerDiameter: 0.2, workingVolume: 0.08 }, "pv")).toThrow(/Np/);
  });

  test("missing reference Np is fine when holding tip speed", () => {
    const noNp: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = scaleUp(noNp, { impellerDiameter: 0.2, workingVolume: 0.08 }, "tipSpeed");
    approx(r.solvedSpeed, 1.0);
  });
});
