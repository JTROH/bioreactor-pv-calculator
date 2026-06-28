import { test, expect, describe } from "bun:test";
import {
  DEFAULTS,
  SCALE_DEFAULTS,
  OTR_DEFAULTS,
  buildOperatingPoint,
  buildTargetGeometry,
  buildOxygenInputs,
  convertFormState,
  convertScaleState,
  convertOtrState,
} from "../src/ui/model";
import { evaluateOperatingPoint } from "../src/engine/constraints";
import { scaleUp } from "../src/engine/scaleup";
import { oxygenBalance } from "../src/engine/oxygen";

describe("buildOperatingPoint", () => {
  test("SI defaults build a valid point (Np blank → no powerNumber)", () => {
    const { point, errors } = buildOperatingPoint(DEFAULTS.SI, "SI");
    expect(errors).toEqual([]);
    expect(point).toBeDefined();
    expect(point!.impeller.powerNumber).toBeUndefined();
    expect(point!.impeller.impellerDiameter).toBeCloseTo(0.1, 9);
    expect(point!.fluid.workingVolume).toBeCloseTo(0.01, 9);
  });

  test("practical defaults convert to the same SI point", () => {
    const si = buildOperatingPoint(DEFAULTS.SI, "SI").point!;
    const pr = buildOperatingPoint(DEFAULTS.practical, "practical").point!;
    expect(pr.impeller.impellerDiameter).toBeCloseTo(si.impeller.impellerDiameter, 9);
    expect(pr.impeller.impellerSpeed).toBeCloseTo(si.impeller.impellerSpeed, 9);
    expect(pr.fluid.workingVolume).toBeCloseTo(si.fluid.workingVolume, 9);
    expect(pr.fluid.liquidViscosity).toBeCloseTo(si.fluid.liquidViscosity, 12);
  });

  test("entering Np makes P/V evaluable", () => {
    const state = { ...DEFAULTS.SI, powerNumber: "5" };
    const { point } = buildOperatingPoint(state, "SI");
    const r = evaluateOperatingPoint(point!);
    const pv = r.constraints.find((c) => c.id === "pv")!;
    expect(pv.status).not.toBe("unknown");
    expect(pv.value).toBeCloseTo(40, 6);
  });

  test("missing core field produces an error and no point", () => {
    const state = { ...DEFAULTS.SI, impellerDiameter: "" };
    const { point, errors } = buildOperatingPoint(state, "SI");
    expect(point).toBeUndefined();
    expect(errors.some((e) => /diameter/i.test(e))).toBe(true);
  });

  test("gas section only included when enabled", () => {
    const off = buildOperatingPoint(DEFAULTS.SI, "SI").point!;
    expect(off.gas).toBeUndefined();
    const on = buildOperatingPoint({ ...DEFAULTS.SI, gasEnabled: true }, "SI").point!;
    expect(on.gas).toBeDefined();
    expect(on.gas!.holeCount).toBe(20);
  });

  test("non-integer hole count is rejected", () => {
    const state = { ...DEFAULTS.SI, gasEnabled: true, holeCount: "10.5" };
    const { errors } = buildOperatingPoint(state, "SI");
    expect(errors.some((e) => /integer/i.test(e))).toBe(true);
  });
});

describe("convertFormState", () => {
  test("SI → practical matches the practical defaults for shared fields", () => {
    const converted = convertFormState(DEFAULTS.SI, "SI", "practical");
    expect(Number(converted.impellerSpeed)).toBeCloseTo(120, 6); // 2 rev/s → 120 rpm
    expect(Number(converted.workingVolume)).toBeCloseTo(10, 6); // 0.01 m³ → 10 L
    expect(Number(converted.impellerDiameter)).toBeCloseTo(100, 6); // 0.1 m → 100 mm
  });

  test("round-trips back to original", () => {
    const there = convertFormState(DEFAULTS.SI, "SI", "practical");
    const back = convertFormState(there, "practical", "SI");
    expect(Number(back.impellerSpeed)).toBeCloseTo(2, 6);
    expect(Number(back.workingVolume)).toBeCloseTo(0.01, 6);
    expect(Number(back.liquidViscosity)).toBeCloseTo(0.001, 9);
  });

  test("blank fields stay blank", () => {
    const converted = convertFormState(DEFAULTS.SI, "SI", "practical");
    expect(converted.powerNumber).toBe("");
    expect(converted.zoneVolume).toBe("");
  });
});

describe("scale-up model", () => {
  test("buildTargetGeometry: SI and practical defaults agree", () => {
    const si = buildTargetGeometry(SCALE_DEFAULTS.SI, "SI").target!;
    const pr = buildTargetGeometry(SCALE_DEFAULTS.practical, "practical").target!;
    expect(pr.impellerDiameter).toBeCloseTo(si.impellerDiameter, 9); // 200 mm = 0.2 m
    expect(pr.workingVolume).toBeCloseTo(si.workingVolume, 9); // 80 L = 0.08 m³
  });

  test("end-to-end: reference + target hold P/V → solved N₂ = cbrt(2)", () => {
    const ref = buildOperatingPoint({ ...DEFAULTS.SI, powerNumber: "5" }, "SI").point!;
    const target = buildTargetGeometry(SCALE_DEFAULTS.SI, "SI").target!;
    const r = scaleUp(ref, target, "pv");
    expect(r.solvedSpeed).toBeCloseTo(Math.cbrt(2), 9);
    expect(r.evaluation.constraints.find((c) => c.id === "pv")!.value).toBeCloseTo(40, 6);
  });

  test("missing target diameter → error", () => {
    const { target, errors } = buildTargetGeometry({ ...SCALE_DEFAULTS.SI, targetDiameter: "" }, "SI");
    expect(target).toBeUndefined();
    expect(errors.some((e) => /diameter/i.test(e))).toBe(true);
  });

  test("convertScaleState round-trips", () => {
    const there = convertScaleState(SCALE_DEFAULTS.SI, "SI", "practical");
    expect(Number(there.targetDiameter)).toBeCloseTo(200, 6);
    expect(Number(there.targetVolume)).toBeCloseTo(80, 6);
    const back = convertScaleState(there, "practical", "SI");
    expect(Number(back.targetDiameter)).toBeCloseTo(0.2, 9);
    expect(back.criterion).toBe("pv");
  });
});

describe("oxygen (kLa/OTR) model", () => {
  test("requires Np on the reference to compute P/V", () => {
    const r = buildOxygenInputs(OTR_DEFAULTS.SI, DEFAULTS.SI, "SI"); // Np blank
    expect(r.inputs).toBeUndefined();
    expect(r.errors.some((e) => /Np/.test(e))).toBe(true);
  });

  test("with Np, builds SI inputs and P/V = 40 W/m³", () => {
    const ref = { ...DEFAULTS.SI, powerNumber: "5" };
    const r = buildOxygenInputs(OTR_DEFAULTS.SI, ref, "SI");
    expect(r.errors).toEqual([]);
    expect(r.powerPerVolume).toBeCloseTo(40, 6);
    expect(r.inputs!.kLaConstants).toEqual({ A: 0.026, alpha: 0.4, beta: 0.5 });
    expect(r.inputs!.doFraction).toBeCloseTo(0.4, 9);
    // 10 ×10⁶ cells/mL → 1e13 cells/m³
    expect(r.inputs!.cellDensity).toBeCloseTo(1e13, 0);
  });

  test("SI and practical OTR defaults yield the same balance", () => {
    const refSI = { ...DEFAULTS.SI, powerNumber: "5" };
    const refPr = { ...DEFAULTS.practical, powerNumber: "5" };
    const si = oxygenBalance(buildOxygenInputs(OTR_DEFAULTS.SI, refSI, "SI").inputs!);
    const pr = oxygenBalance(buildOxygenInputs(OTR_DEFAULTS.practical, refPr, "practical").inputs!);
    expect(pr.kLa).toBeCloseTo(si.kLa, 9);
    expect(pr.otrMax).toBeCloseTo(si.otrMax, 9);
    expect(pr.our).toBeCloseTo(si.our, 9);
  });

  test("default scenario is oxygen-limited (realistic)", () => {
    const ref = { ...DEFAULTS.SI, powerNumber: "5" };
    const r = oxygenBalance(buildOxygenInputs(OTR_DEFAULTS.SI, ref, "SI").inputs!);
    expect(r.sufficient).toBe(false);
  });

  test("convertOtrState converts gas flow & tank diameter, leaves O₂ params", () => {
    const there = convertOtrState(OTR_DEFAULTS.SI, "SI", "practical");
    expect(Number(there.tankDiameter)).toBeCloseTo(200, 6); // 0.2 m → 200 mm
    expect(Number(there.gasFlow)).toBeCloseTo(3.6, 4); // 6e-5 m³/s → 3.6 L/min
    expect(there.saturation).toBe("0.21"); // unchanged (same unit both systems)
    expect(there.specificOUR).toBe("0.3");
  });
});
