import { test, expect, describe } from "bun:test";
import { evaluateOperatingPoint, THRESHOLDS } from "../src/engine/constraints";
import type { OperatingPoint, ConstraintResult } from "../src/engine/types";

const byId = (cs: ConstraintResult[], id: string): ConstraintResult => {
  const c = cs.find((x) => x.id === id);
  if (!c) throw new Error(`no constraint "${id}"`);
  return c;
};

// Reference vessel (same hand-calc numbers as impeller tests) — all safe.
//   Np=5, ρ=1000, N=2 rev/s, D=0.1, V=0.01, μ=0.001
//   P/V=40 (ok ≤50), N_Re=20000 (ok >10000), v_tip=0.628 (ok <1.5), λ≈70.7µm (ok)
const SAFE: OperatingPoint = {
  impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2, zoneVolume: 0.0005 },
  fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
  gas: {
    gasFlow: 6e-5,
    holeCount: 10,
    holeDiameter: 0.002,
    gasDensity: 1.2,
    gasViscosity: 1.8e-5,
    wakeEdr: 0.04,
  },
};

describe("safe reference vessel", () => {
  const r = evaluateOperatingPoint(SAFE);

  test("window is inside", () => {
    expect(r.window).toBe("inside");
    expect(r.violated).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.cautions).toEqual([]);
  });

  test("P/V = 40 W/m³, ok (within typical 10–150 band)", () => {
    const c = byId(r.constraints, "pv");
    expect(c.value).toBeCloseTo(40, 6);
    expect(c.status).toBe("ok");
  });

  test("tip speed ok", () => {
    expect(byId(r.constraints, "tipSpeed").status).toBe("ok");
  });

  test("impeller Reynolds = 20000, ok", () => {
    const c = byId(r.constraints, "impellerReynolds");
    expect(c.value).toBeCloseTo(20000, 3);
    expect(c.status).toBe("ok");
  });

  test("local zone power density = 564 W/m³, ok", () => {
    const c = byId(r.constraints, "localEdr");
    expect(c.value).toBeCloseTo(564, 3);
    expect(c.status).toBe("ok");
  });

  test("microeddy length ok and based on impeller-zone EDR", () => {
    const c = byId(r.constraints, "eddyLength");
    expect(c.status).toBe("ok");
    expect(c.value).toBeGreaterThan(THRESHOLDS.eddyLengthMin);
    expect(c.message).toContain("impeller-zone EDR");
  });

  test("gas metrics present and ok/advisory", () => {
    expect(byId(r.constraints, "vvm").status).toBe("advisory");
    expect(byId(r.constraints, "gasVelocity").status).toBe("ok");
    expect(byId(r.constraints, "orificeReynolds").status).toBe("ok");
    expect(byId(r.constraints, "bubbleWakeEddy").status).toBe("ok");
  });
});

describe("P/V banding (typical 10–150, caution to 250, alert >250)", () => {
  // P/V = 5·N³ for this vessel (Np=5, ρ=1000, D=0.1, V=0.01).
  const atSpeed = (N: number) =>
    evaluateOperatingPoint({ ...SAFE, impeller: { ...SAFE.impeller, impellerSpeed: N } });

  test("P/V ≈ 200 → caution, window still inside", () => {
    const r = atSpeed(Math.cbrt(40)); // 5·40 = 200 W/m³
    const c = byId(r.constraints, "pv");
    expect(c.value).toBeCloseTo(200, 4);
    expect(c.status).toBe("caution");
    expect(r.cautions).toContain("pv");
    expect(r.window).toBe("inside"); // caution does not push it outside
  });

  test("P/V ≈ 300 → violated, window outside", () => {
    const r = atSpeed(Math.cbrt(60)); // 5·60 = 300 W/m³
    const c = byId(r.constraints, "pv");
    expect(c.value).toBeCloseTo(300, 4);
    expect(c.status).toBe("violated");
    expect(r.window).toBe("outside");
  });

  test("P/V ≈ 5 (< 10) → low caution", () => {
    const r = atSpeed(1); // 5·1 = 5 W/m³
    const c = byId(r.constraints, "pv");
    expect(c.value).toBeCloseTo(5, 6);
    expect(c.status).toBe("caution");
    expect(c.message).toMatch(/below the typical/);
  });
});

describe("over-agitated vessel (N = 10 rev/s)", () => {
  const fast: OperatingPoint = {
    ...SAFE,
    impeller: { ...SAFE.impeller, impellerSpeed: 10 },
  };
  const r = evaluateOperatingPoint(fast);

  test("window is outside", () => {
    expect(r.window).toBe("outside");
  });

  test("P/V violated (5000 W/m³ > 250)", () => {
    const c = byId(r.constraints, "pv");
    expect(c.value).toBeCloseTo(5000, 2);
    expect(c.status).toBe("violated");
    expect(c.message).toMatch(/exceeds/);
  });

  test("tip speed violated (π·10·0.1 = 3.14 > 1.5)", () => {
    const c = byId(r.constraints, "tipSpeed");
    expect(c.status).toBe("violated");
  });

  test("violated list contains pv and tipSpeed", () => {
    expect(r.violated).toContain("pv");
    expect(r.violated).toContain("tipSpeed");
  });
});

describe("missing power number (Np) — tip speed still alerts", () => {
  test("power-derived metrics are unknown; window indeterminate", () => {
    const noNp: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noNp);
    expect(r.window).toBe("indeterminate");
    expect(byId(r.constraints, "pv").status).toBe("unknown");
    expect(byId(r.constraints, "eddyLength").status).toBe("unknown");
    expect(byId(r.constraints, "pv").message).toMatch(/power number/i);
    // tip speed & Reynolds remain computable
    expect(byId(r.constraints, "tipSpeed").status).toBe("ok");
    expect(byId(r.constraints, "impellerReynolds").status).toBe("ok");
  });

  test("tip-speed alert fires even without Np", () => {
    const noNpFast: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 10 }, // v_tip = 3.14
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noNpFast);
    // A violation outranks the unknowns → outside.
    expect(byId(r.constraints, "tipSpeed").status).toBe("violated");
    expect(r.window).toBe("outside");
  });
});

describe("partial inputs", () => {
  test("no V_zone → localEdr unknown, eddy falls back to mean P/V", () => {
    const noZone: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noZone);
    expect(byId(r.constraints, "localEdr").status).toBe("unknown");
    expect(byId(r.constraints, "eddyLength").message).toContain("mean P/V");
    expect(byId(r.constraints, "eddyLength").status).toBe("ok");
  });

  test("blank OPTIONAL input (V_zone) does NOT block 'inside' — it is skipped", () => {
    const noZone: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noZone);
    expect(r.window).toBe("inside");
    expect(r.skipped).toContain("localEdr");
    expect(r.unknown).not.toContain("localEdr");
  });

  test("blank OPTIONAL gas input (wakeEdr) is skipped, window stays inside", () => {
    const noWake: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2, zoneVolume: 0.0005 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
      gas: { gasFlow: 6e-5, holeCount: 10, holeDiameter: 0.002, gasDensity: 1.2, gasViscosity: 1.8e-5 },
    };
    const r = evaluateOperatingPoint(noWake);
    expect(r.window).toBe("inside");
    expect(r.skipped).toContain("bubbleWakeEddy");
  });

  test("missing REQUIRED input (Np) still forces 'indeterminate'", () => {
    const noNp: OperatingPoint = {
      impeller: { impellerDiameter: 0.1, impellerSpeed: 2 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noNp);
    expect(r.window).toBe("indeterminate");
    expect(r.unknown).toContain("pv");
    expect(r.unknown).toContain("eddyLength");
    // localEdr is optional-class, so it is skipped, not blocking
    expect(r.skipped).toContain("localEdr");
  });

  test("no gas section → no gas constraints emitted", () => {
    const noGas: OperatingPoint = {
      impeller: { powerNumber: 5, impellerDiameter: 0.1, impellerSpeed: 2, zoneVolume: 0.0005 },
      fluid: { workingVolume: 0.01, liquidDensity: 1000, liquidViscosity: 0.001 },
    };
    const r = evaluateOperatingPoint(noGas);
    expect(r.constraints.find((c) => c.id === "gasVelocity")).toBeUndefined();
    expect(r.window).toBe("inside");
  });

  test("high gas velocity → gasVelocity violated", () => {
    const jet: OperatingPoint = {
      ...SAFE,
      gas: { ...SAFE.gas!, gasFlow: 5e-4, holeCount: 1, holeDiameter: 0.001 },
    };
    const r = evaluateOperatingPoint(jet);
    expect(byId(r.constraints, "gasVelocity").status).toBe("violated");
    expect(r.window).toBe("outside");
  });
});
