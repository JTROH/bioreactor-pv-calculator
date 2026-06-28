import { test, expect, describe } from "bun:test";
import {
  powerInput,
  powerPerVolume,
  impellerReynolds,
  tipSpeed,
  impellerZonePowerDensity,
  energyDissipationRate,
  kolmogorovLength,
  estimateSweptVolume,
  PITCHED_BLADE_ZONE_FRACTION,
} from "../src/engine/impeller";

// Helper: relative-tolerance compare.
const approx = (a: number, b: number, rel = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

// ---------------------------------------------------------------------------
// Reference vessel used across tests (clean hand-calc numbers):
//   Np = 5, ρ = 1000 kg/m³, N = 2 rev/s, D = 0.1 m, V = 0.01 m³, μ = 0.001 Pa·s
//   => P    = 5·1000·2³·0.1⁵ = 0.4 W
//      P/V  = 0.4 / 0.01     = 40 W/m³
//      N_Re = 1000·2·0.1²/0.001 = 20000
//      v_tip= π·2·0.1        = 0.6283185307 m/s
//      ν    = 1e-6 m²/s; mean ε = 40/1000 = 0.04 m²/s³
//      λ    = (1e-18/0.04)^0.25 = 7.0711e-5 m  (≈ 70.7 µm)
// ---------------------------------------------------------------------------
const REF = { Np: 5, rho: 1000, N: 2, D: 0.1, V: 0.01, mu: 0.001 };

describe("powerInput  P = Np·ρ·N³·D⁵", () => {
  test("reference vessel → 0.4 W", () => {
    approx(powerInput(REF.Np, REF.rho, REF.N, REF.D), 0.4);
  });

  test("scales with N³", () => {
    const p1 = powerInput(REF.Np, REF.rho, 1, REF.D);
    const p2 = powerInput(REF.Np, REF.rho, 2, REF.D);
    approx(p2 / p1, 8);
  });

  test("scales with D⁵", () => {
    const p1 = powerInput(REF.Np, REF.rho, REF.N, 0.1);
    const p2 = powerInput(REF.Np, REF.rho, REF.N, 0.2);
    approx(p2 / p1, 2 ** 5);
  });

  test("zero speed → zero power", () => {
    expect(powerInput(REF.Np, REF.rho, 0, REF.D)).toBe(0);
  });

  test("rejects non-positive diameter / density", () => {
    expect(() => powerInput(REF.Np, REF.rho, REF.N, 0)).toThrow();
    expect(() => powerInput(REF.Np, 0, REF.N, REF.D)).toThrow();
  });
});

describe("powerPerVolume  P/V", () => {
  test("0.4 W / 0.01 m³ → 40 W/m³", () => {
    approx(powerPerVolume(0.4, 0.01), 40);
  });
  test("rejects zero volume", () => {
    expect(() => powerPerVolume(0.4, 0)).toThrow();
  });
});

describe("impellerReynolds  N_Re = ρ·N·D²/μ", () => {
  test("reference vessel → 20000", () => {
    approx(impellerReynolds(REF.rho, REF.N, REF.D, REF.mu), 20000);
  });
  test("turbulent boundary check value (≈ exactly 10000 setup)", () => {
    // ρ·N·D²/μ = 10000 with ρ=1000, D=0.1, μ=0.001 → N = 1 rev/s
    approx(impellerReynolds(1000, 1, 0.1, 0.001), 10000);
  });
  test("rejects zero viscosity", () => {
    expect(() => impellerReynolds(REF.rho, REF.N, REF.D, 0)).toThrow();
  });
});

describe("tipSpeed  v_tip = π·N·D  (Np-independent)", () => {
  test("reference vessel → 0.6283 m/s", () => {
    approx(tipSpeed(REF.N, REF.D), Math.PI * 0.2);
  });
  test("does not require Np — computable from N and D alone", () => {
    expect(tipSpeed(3, 0.15)).toBeGreaterThan(0);
  });
  test("crosses the 1.5 m/s alert threshold as expected", () => {
    // v_tip = 1.5 when N·D = 1.5/π ≈ 0.4775
    expect(tipSpeed(5, 0.09)).toBeLessThan(1.5); // π·5·0.09 = 1.4137
    expect(tipSpeed(6, 0.1)).toBeGreaterThan(1.5); // π·6·0.1 = 1.885
  });
});

describe("impeller-zone power density and EDR", () => {
  test("default zone fraction is the pitched-blade 0.705", () => {
    expect(PITCHED_BLADE_ZONE_FRACTION).toBe(0.705);
  });

  test("(f·P)/V_zone with P=0.4, V_zone=0.0005 → 564 W/m³", () => {
    approx(impellerZonePowerDensity(0.4, 0.0005), (0.705 * 0.4) / 0.0005);
    approx(impellerZonePowerDensity(0.4, 0.0005), 564);
  });

  test("local density exceeds average P/V (heterogeneity)", () => {
    const avg = powerPerVolume(0.4, 0.01); // 40 W/m³
    const local = impellerZonePowerDensity(0.4, 0.0005); // 564 W/m³
    expect(local).toBeGreaterThan(avg);
  });

  test("energyDissipationRate = powerDensity / ρ", () => {
    approx(energyDissipationRate(40, 1000), 0.04);
    approx(energyDissipationRate(564, 1000), 0.564);
  });

  test("rejects fraction outside (0,1]", () => {
    expect(() => impellerZonePowerDensity(0.4, 0.0005, 0)).toThrow();
    expect(() => impellerZonePowerDensity(0.4, 0.0005, 1.2)).toThrow();
    expect(impellerZonePowerDensity(0.4, 0.0005, 1)).toBeGreaterThan(0);
  });
});

describe("kolmogorovLength  λ = (ν³/ε)^(1/4)", () => {
  test("reference mean-EDR case → ≈ 70.7 µm", () => {
    const edr = energyDissipationRate(40, 1000); // 0.04 m²/s³, ν = 1e-6
    const lambda = kolmogorovLength(edr, REF.mu, REF.rho);
    approx(lambda, 7.0710678e-5, 1e-6);
    // sanity: above the 20 µm cell-safety threshold
    expect(lambda).toBeGreaterThan(20e-6);
  });

  test("higher EDR → smaller eddies", () => {
    const big = kolmogorovLength(0.04, REF.mu, REF.rho);
    const small = kolmogorovLength(4.0, REF.mu, REF.rho);
    expect(small).toBeLessThan(big);
  });

  test("rejects non-positive EDR", () => {
    expect(() => kolmogorovLength(0, REF.mu, REF.rho)).toThrow();
  });
});

describe("estimateSweptVolume  (π/4)·D²·w", () => {
  test("D=0.1, w=0.02 → 1.5708e-4 m³", () => {
    approx(estimateSweptVolume(0.1, 0.02), (Math.PI / 4) * 0.01 * 0.02);
  });
  test("rejects non-positive width", () => {
    expect(() => estimateSweptVolume(0.1, 0)).toThrow();
  });
});
