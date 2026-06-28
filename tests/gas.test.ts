import { test, expect, describe } from "bun:test";
import {
  holeArea,
  vvm,
  gasEntranceVelocity,
  orificeReynolds,
  bubbleWakeEddyLength,
} from "../src/engine/gas";
import { kolmogorovLength } from "../src/engine/impeller";

const approx = (a: number, b: number, rel = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe("holeArea  A = (π/4)·d²", () => {
  test("d = 0.002 m → 3.1416e-6 m²", () => {
    approx(holeArea(0.002), (Math.PI / 4) * 0.002 ** 2);
  });
  test("rejects non-positive diameter", () => {
    expect(() => holeArea(0)).toThrow();
  });
});

describe("vvm  (gas vol / liquid vol / minute)", () => {
  // Q = 1e-4 m³/s = 6 L/min; V = 0.1 m³ = 100 L → 6/100 = 0.06 vvm
  test("1e-4 m³/s into 0.1 m³ → 0.06 min⁻¹", () => {
    approx(vvm(1e-4, 0.1), 0.06);
  });
  test("matches the L/min ÷ L definition", () => {
    // 0.1 L/min into 10 L → 0.01 vvm.  0.1 L/min = 0.1e-3/60 m³/s; 10 L = 0.01 m³
    approx(vvm(0.1e-3 / 60, 0.01), 0.01);
  });
  test("zero flow → zero vvm", () => {
    expect(vvm(0, 0.1)).toBe(0);
  });
  test("rejects zero liquid volume", () => {
    expect(() => vvm(1e-4, 0)).toThrow();
  });
});

describe("gasEntranceVelocity  v = Q/(n·A)", () => {
  // Q = 6e-5 m³/s, n = 10, d = 0.002 m → A_tot = 10·3.1416e-6 = 3.1416e-5
  // v = 6e-5 / 3.1416e-5 = 1.9099 m/s
  test("reference case → ≈ 1.9099 m/s", () => {
    approx(gasEntranceVelocity(6e-5, 10, 0.002), 6e-5 / (10 * holeArea(0.002)));
    approx(gasEntranceVelocity(6e-5, 10, 0.002), 1.90986, 1e-4);
  });

  test("fewer/smaller holes → higher velocity", () => {
    const many = gasEntranceVelocity(6e-5, 20, 0.002);
    const few = gasEntranceVelocity(6e-5, 5, 0.002);
    expect(few).toBeGreaterThan(many);
  });

  test("can exceed the 30 m/s alert threshold", () => {
    // single 1 mm hole, Q chosen to give ~30 m/s: Q = 30·A, A=(π/4)1e-6
    const A = holeArea(0.001);
    expect(gasEntranceVelocity(30 * A * 1.001, 1, 0.001)).toBeGreaterThan(30);
    expect(gasEntranceVelocity(30 * A * 0.999, 1, 0.001)).toBeLessThan(30);
  });

  test("rejects non-integer hole count", () => {
    expect(() => gasEntranceVelocity(6e-5, 2.5, 0.002)).toThrow();
    expect(() => gasEntranceVelocity(6e-5, 0, 0.002)).toThrow();
  });
});

describe("orificeReynolds  Re = ρ_gas·v·d/μ_gas", () => {
  // air: ρ=1.2, μ=1.8e-5; v=1.9099, d=0.002 → 1.2·1.9099·0.002/1.8e-5 = 254.65
  test("air reference case → ≈ 254.6 (well below 2000)", () => {
    const re = orificeReynolds(1.2, 1.9098593, 0.002, 1.8e-5);
    approx(re, (1.2 * 1.9098593 * 0.002) / 1.8e-5, 1e-7);
    expect(re).toBeLessThan(2000);
  });

  test("crosses the 2000 jetting threshold at high velocity", () => {
    // Re = 2000 when v = 2000·μ/(ρ·d) = 2000·1.8e-5/(1.2·0.002) = 15 m/s
    expect(orificeReynolds(1.2, 15.0, 0.002, 1.8e-5)).toBeCloseTo(2000, 6);
    expect(orificeReynolds(1.2, 16.0, 0.002, 1.8e-5)).toBeGreaterThan(2000);
  });

  test("rejects zero gas viscosity", () => {
    expect(() => orificeReynolds(1.2, 10, 0.002, 0)).toThrow();
  });
});

describe("bubbleWakeEddyLength", () => {
  test("equals the Kolmogorov length for the same EDR/fluid", () => {
    const edr = 0.04;
    approx(bubbleWakeEddyLength(edr, 0.001, 1000), kolmogorovLength(edr, 0.001, 1000));
  });
  test("typical low-EDR wake stays above the 20 µm threshold", () => {
    // ε = 0.04 m²/s³, water → λ ≈ 70.7 µm
    expect(bubbleWakeEddyLength(0.04, 0.001, 1000)).toBeGreaterThan(20e-6);
  });
  test("rejects non-positive EDR", () => {
    expect(() => bubbleWakeEddyLength(0, 0.001, 1000)).toThrow();
  });
});
