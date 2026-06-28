import { test, expect, describe } from "bun:test";
import {
  convert,
  toSI,
  fromSI,
  unitLabel,
  engineUnit,
  displayUnit,
  displayToEngine,
  engineToDisplay,
  QUANTITY_UNITS,
  type Quantity,
} from "../src/engine/units";

const approx = (a: number, b: number, tol = 1e-12) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe("known conversions", () => {
  test("60 rpm = 1 rev/s", () => {
    approx(convert(60, "rpm", "rev/s"), 1);
    approx(convert(1, "rev/s", "rpm"), 60);
  });

  test("1000 L = 1 m³", () => {
    approx(convert(1000, "L", "m³"), 1);
    approx(convert(1, "m³", "L"), 1000);
  });

  test("1 Pa·s = 1000 cP (water ≈ 1 cP = 0.001 Pa·s)", () => {
    approx(convert(1, "Pa·s", "cP"), 1000);
    approx(convert(1, "cP", "Pa·s"), 0.001);
  });

  test("g/L is numerically equal to kg/m³", () => {
    approx(convert(1025, "g/L", "kg/m³"), 1025);
  });

  test("1 g/mL = 1000 kg/m³", () => {
    approx(convert(1, "g/mL", "kg/m³"), 1000);
  });

  test("1 L/min = 1/60000 m³/s", () => {
    approx(convert(1, "L/min", "m³/s"), 1e-3 / 60);
  });

  test("1 m = 1000 mm = 1e6 µm", () => {
    approx(convert(1, "m", "mm"), 1000);
    approx(convert(1, "m", "µm"), 1e6);
  });

  test("1 W/L = 1000 W/m³", () => {
    approx(convert(1, "W/L", "W/m³"), 1000);
  });
});

describe("toSI / fromSI are inverses", () => {
  const cases: Array<[number, Parameters<typeof toSI>[1]]> = [
    [150, "rpm"],
    [2.5, "L"],
    [1.2, "cP"],
    [33, "mm"],
    [4.7, "L/min"],
    [1025, "g/L"],
  ];
  for (const [value, unit] of cases) {
    test(`${value} ${String(unit)} round-trips`, () => {
      approx(fromSI(toSI(value, unit), unit), value);
    });
  }
});

describe("convert round-trips (A→B→A)", () => {
  const pairs: Array<[Parameters<typeof convert>[1], Parameters<typeof convert>[2]]> = [
    ["rpm", "rev/s"],
    ["L", "m³"],
    ["cP", "Pa·s"],
    ["mm", "m"],
    ["L/min", "m³/s"],
  ];
  for (const [a, b] of pairs) {
    test(`${String(a)} ↔ ${String(b)}`, () => {
      const v = 123.456;
      approx(convert(convert(v, a, b), b, a), v);
    });
  }
});

describe("dimension safety", () => {
  test("converting across dimensions throws", () => {
    expect(() => convert(1, "rpm", "L")).toThrow(/dimension mismatch/);
  });

  test("unknown unit throws", () => {
    // @ts-expect-error intentionally invalid unit
    expect(() => convert(1, "furlong", "m")).toThrow(/Unknown unit/);
  });
});

describe("quantity presets ↔ engine", () => {
  test("every quantity's display units share the engine unit's dimension", () => {
    for (const q of Object.keys(QUANTITY_UNITS) as Quantity[]) {
      // convert 1.0 display→engine for both systems; must not throw
      expect(() => displayToEngine(1, q, "SI")).not.toThrow();
      expect(() => displayToEngine(1, q, "practical")).not.toThrow();
    }
  });

  test("impeller speed: 90 rpm (practical) → 1.5 rev/s (engine)", () => {
    approx(displayToEngine(90, "impellerSpeed", "practical"), 1.5);
  });

  test("working volume: 200 L (practical) → 0.2 m³ (engine)", () => {
    approx(displayToEngine(200, "workingVolume", "practical"), 0.2);
  });

  test("eddy length engine(m) → display(µm): 25e-6 m → 25 µm", () => {
    approx(engineToDisplay(25e-6, "eddyLength", "SI"), 25);
  });

  test("display→engine→display is identity", () => {
    const v = 37.5;
    approx(
      engineToDisplay(displayToEngine(v, "liquidViscosity", "practical"), "liquidViscosity", "practical"),
      v,
    );
  });

  test("SI display unit equals engine unit for primary inputs", () => {
    expect(displayUnit("impellerDiameter", "SI")).toBe(engineUnit("impellerDiameter"));
    expect(displayUnit("workingVolume", "SI")).toBe(engineUnit("workingVolume"));
  });
});

describe("labels", () => {
  test("unitLabel returns the display label", () => {
    expect(unitLabel("Pa·s")).toBe("Pa·s");
    expect(unitLabel("rpm")).toBe("rpm");
    expect(unitLabel("")).toBe("");
  });
});
