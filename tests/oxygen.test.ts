import { test, expect, describe } from "bun:test";
import {
  superficialGasVelocity,
  volumetricMassTransfer,
  oxygenTransferRate,
  oxygenUptakeRate,
  oxygenBalance,
  KLA_PRESETS,
} from "../src/engine/oxygen";

const approx = (a: number, b: number, rel = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe("superficialGasVelocity  vs = Q/(π D²/4)", () => {
  test("Q=6e-5 m³/s, D_tank=0.2 m → ≈ 1.9099e-3 m/s", () => {
    approx(superficialGasVelocity(6e-5, 0.2), 6e-5 / ((Math.PI / 4) * 0.04));
    approx(superficialGasVelocity(6e-5, 0.2), 1.90986e-3, 1e-4);
  });
  test("zero flow → zero velocity", () => {
    expect(superficialGasVelocity(0, 0.2)).toBe(0);
  });
  test("rejects non-positive tank diameter", () => {
    expect(() => superficialGasVelocity(6e-5, 0)).toThrow();
  });
});

describe("volumetricMassTransfer  kLa = A·(P/V)^α·(vs)^β", () => {
  test("Van't Riet coalescing preset values", () => {
    expect(KLA_PRESETS.coalescing).toEqual({ A: 0.026, alpha: 0.4, beta: 0.5 });
    expect(KLA_PRESETS.nonCoalescing).toEqual({ A: 0.002, alpha: 0.7, beta: 0.2 });
  });

  test("cell-culture preset (Xing 2009 exponents) gives kLa ≈ 10 1/h at typical conditions", () => {
    expect(KLA_PRESETS.cellCulture.alpha).toBe(0.47);
    expect(KLA_PRESETS.cellCulture.beta).toBe(0.8);
    // pv=40 W/m³, vs≈1.91e-3 m/s → kLa ≈ 0.00284 1/s ≈ 10.2 1/h
    const kLa = volumetricMassTransfer(40, 1.90986e-3, KLA_PRESETS.cellCulture);
    expect(kLa * 3600).toBeGreaterThan(8);
    expect(kLa * 3600).toBeLessThan(13);
  });

  test("pv=40, vs=1.90986e-3 → kLa ≈ 0.004969 1/s", () => {
    const kLa = volumetricMassTransfer(40, 1.90986e-3, KLA_PRESETS.coalescing);
    const expected = 0.026 * 40 ** 0.4 * (1.90986e-3) ** 0.5;
    approx(kLa, expected);
    approx(kLa, 0.0049686, 1e-3); // ≈ 17.9 1/h
  });

  test("monotonic in P/V and vs", () => {
    const base = volumetricMassTransfer(40, 2e-3, KLA_PRESETS.coalescing);
    expect(volumetricMassTransfer(80, 2e-3, KLA_PRESETS.coalescing)).toBeGreaterThan(base);
    expect(volumetricMassTransfer(40, 4e-3, KLA_PRESETS.coalescing)).toBeGreaterThan(base);
  });

  test("rejects non-positive A", () => {
    expect(() => volumetricMassTransfer(40, 2e-3, { A: 0, alpha: 0.4, beta: 0.5 })).toThrow();
  });
});

describe("oxygenTransferRate  OTR = kLa·C*·(1−DO)", () => {
  test("kLa=0.005, C*=0.21 mol/m³, DO=0.4 → 6.3e-4 mol/(m³·s)", () => {
    approx(oxygenTransferRate(0.005, 0.21, 0.4), 0.005 * 0.21 * 0.6);
    approx(oxygenTransferRate(0.005, 0.21, 0.4), 6.3e-4);
  });
  test("DO must be in [0,1)", () => {
    expect(() => oxygenTransferRate(0.005, 0.21, 1)).toThrow();
    expect(() => oxygenTransferRate(0.005, 0.21, -0.1)).toThrow();
  });
});

describe("oxygenUptakeRate  OUR = qO2·X", () => {
  // qO2 = 0.3 mmol/(10⁹ cells·h) = 0.3e-3/(1e9·3600) mol/(cell·s) = 8.3333e-17
  // X   = 10 ×10⁶ cells/mL = 1e13 cells/m³
  // OUR = 8.3333e-17 · 1e13 = 8.3333e-4 mol/(m³·s) (= 3.0 mmol/(L·h))
  const qO2 = 0.3e-3 / (1e9 * 3600);
  test("qO2·X → 8.3333e-4 mol/(m³·s)", () => {
    approx(oxygenUptakeRate(qO2, 1e13), 8.33333e-4, 1e-4);
  });
});

describe("oxygenBalance integration", () => {
  const qO2 = 0.3e-3 / (1e9 * 3600);
  const inp = {
    powerPerVolume: 40,
    gasFlow: 6e-5,
    tankDiameter: 0.2,
    kLaConstants: KLA_PRESETS.coalescing,
    saturation: 0.21,
    doFraction: 0.4,
    specificOUR: qO2,
    cellDensity: 1e13,
  };

  test("this realistic case is oxygen-LIMITED (OTR_max < OUR)", () => {
    const r = oxygenBalance(inp);
    // OTR_max ≈ 0.004969·0.21·0.6 = 6.26e-4; OUR ≈ 8.33e-4
    approx(r.otrMax, 0.0049686 * 0.21 * 0.6, 1e-2);
    approx(r.our, 8.33333e-4, 1e-4);
    expect(r.sufficient).toBe(false);
    expect(r.ratio).toBeLessThan(1);
  });

  test("lower cell density makes it sufficient", () => {
    const r = oxygenBalance({ ...inp, cellDensity: 5e12 }); // 5 ×10⁶ cells/mL
    expect(r.sufficient).toBe(true);
    expect(r.ratio).toBeGreaterThan(1);
  });

  test("max sustainable cell density = OTR_max / qO2", () => {
    const r = oxygenBalance(inp);
    approx(r.maxCellDensity, r.otrMax / qO2);
    // sanity: between current insufficient density and a lower sufficient one
    expect(r.maxCellDensity).toBeLessThan(1e13);
    expect(r.maxCellDensity).toBeGreaterThan(5e12);
  });

  test("zero demand → infinite ratio", () => {
    const r = oxygenBalance({ ...inp, cellDensity: 0 });
    expect(r.our).toBe(0);
    expect(r.ratio).toBe(Infinity);
    expect(r.sufficient).toBe(true);
  });
});
