import { test, expect, describe } from "bun:test";
import {
  parseAppState,
  serializePreset,
  stateToCsv,
  parsePresetText,
  encodeStateToHash,
  decodeHashToState,
  shareableUrl,
  stateFromLocationHash,
  savePreset,
  listPresets,
  loadPreset,
  deletePreset,
  type AppState,
  type StorageLike,
} from "../src/ui/presets";
import { DEFAULTS, SCALE_DEFAULTS, OTR_DEFAULTS } from "../src/ui/model";

const sample = (): AppState => ({
  system: "practical",
  form: { ...DEFAULTS.practical, powerNumber: "5", impellerSpeed: "150" },
  scale: { ...SCALE_DEFAULTS.practical, criterion: "tipSpeed" },
  otr: { ...OTR_DEFAULTS.practical, cellDensity: "12" },
});

// In-memory StorageLike for testing.
function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

describe("serialize / parse round-trip", () => {
  test("preserves system and all three forms", () => {
    const s = sample();
    const back = parsePresetText(serializePreset(s)).state!;
    expect(back.system).toBe("practical");
    expect(back.form.powerNumber).toBe("5");
    expect(back.form.impellerSpeed).toBe("150");
    expect(back.scale.criterion).toBe("tipSpeed");
    expect(back.otr.cellDensity).toBe("12");
  });

  test("serialized file carries app id + version", () => {
    const obj = JSON.parse(serializePreset(sample()));
    expect(obj.app).toBe("bioreactor-pv-calculator");
    expect(obj.version).toBe(1);
    expect(typeof obj.savedAt).toBe("string");
  });
});

describe("parseAppState robustness", () => {
  test("missing keys fall back to defaults", () => {
    const st = parseAppState({ state: { system: "SI", form: { powerNumber: "7" } } });
    expect(st.form.powerNumber).toBe("7");
    expect(st.form.impellerDiameter).toBe(DEFAULTS.SI.impellerDiameter); // defaulted
    expect(st.scale.criterion).toBe("pv"); // defaulted
  });

  test("invalid system defaults to SI", () => {
    expect(parseAppState({ system: "imperial" }).system).toBe("SI");
  });

  test("invalid scale criterion is corrected to pv", () => {
    const st = parseAppState({ scale: { criterion: "nonsense" } });
    expect(st.scale.criterion).toBe("pv");
  });

  test("numbers are coerced to strings; booleans preserved", () => {
    const st = parseAppState({ form: { powerNumber: 5, gasEnabled: true } });
    expect(st.form.powerNumber).toBe("5");
    expect(st.form.gasEnabled).toBe(true);
  });

  test("garbage input yields a valid default state (never throws)", () => {
    expect(() => parseAppState(null)).not.toThrow();
    expect(parseAppState(null).system).toBe("SI");
    expect(parseAppState(42).form.workingVolume).toBe(DEFAULTS.SI.workingVolume);
  });
});

describe("parsePresetText guards", () => {
  test("rejects non-JSON", () => {
    expect(parsePresetText("not json {").error).toMatch(/JSON/);
  });
  test("rejects arrays and unrelated objects", () => {
    expect(parsePresetText("[1,2,3]").error).toMatch(/Unrecognized/);
    expect(parsePresetText('{"hello":"world"}').error).toMatch(/Unrecognized/);
  });
  test("accepts a file with a state key", () => {
    expect(parsePresetText('{"state":{"system":"SI"}}').state).toBeDefined();
  });
});

describe("stateToCsv", () => {
  const rows = (csv: string) => csv.split("\r\n").map((r) => r.split(","));

  test("has the Section/Parameter/Value/Unit header and CRLF lines", () => {
    const csv = stateToCsv(sample());
    expect(csv.split("\r\n")[0]).toBe("Section,Parameter,Value,Unit");
    expect(csv.includes("\r\n")).toBe(true);
  });

  test("includes key parameters with their values", () => {
    const csv = stateToCsv(sample()); // practical system, Np=5, N=150
    expect(csv).toContain("Vessel,Power number (Np),5,");
    expect(csv).toMatch(/Vessel,Impeller speed \(N\),150,rpm/);
    expect(csv).toContain("Meta,Unit system,Practical");
  });

  test("units follow the state's unit system", () => {
    const si = stateToCsv({ ...sample(), system: "SI" });
    expect(si).toMatch(/Impeller diameter \(D\),[^,]*,m(\r|$)/m);
    const pr = stateToCsv(sample()); // practical
    expect(pr).toMatch(/Impeller diameter \(D\),[^,]*,mm/);
  });

  test("covers all three sections", () => {
    const csv = stateToCsv(sample());
    const sections = new Set(rows(csv).slice(1).map((r) => r[0]));
    expect(sections.has("Vessel")).toBe(true);
    expect(sections.has("Scaling")).toBe(true);
    expect(sections.has("Oxygen")).toBe(true);
  });

  test("quotes fields containing commas", () => {
    // A viscosity value like "1,5" (comma decimal) must be quoted so columns stay intact.
    const s = sample();
    s.form.liquidViscosity = "1,5";
    const line = stateToCsv(s).split("\r\n").find((l) => l.includes("Liquid viscosity"))!;
    expect(line).toContain('"1,5"');
  });
});

describe("shareable URL hash", () => {
  test("encode → decode round-trip", () => {
    const s = sample();
    const back = decodeHashToState(encodeStateToHash(s)).state!;
    expect(back.system).toBe("practical");
    expect(back.form.powerNumber).toBe("5");
  });

  test("shareableUrl strips an existing hash and appends cfg", () => {
    const url = shareableUrl("https://x.io/app/#cfg=old", sample());
    expect(url.startsWith("https://x.io/app/#cfg=")).toBe(true);
    expect(url).not.toContain("cfg=old");
  });

  test("stateFromLocationHash reads a cfg hash", () => {
    const hash = "#cfg=" + encodeStateToHash(sample());
    expect(stateFromLocationHash(hash)!.form.powerNumber).toBe("5");
  });

  test("stateFromLocationHash ignores unrelated hashes", () => {
    expect(stateFromLocationHash("#section=top")).toBeUndefined();
    expect(stateFromLocationHash("")).toBeUndefined();
  });
});

describe("named-preset storage CRUD", () => {
  test("save → list → load → delete", () => {
    const s = memStorage();
    savePreset(s, "10L run", sample());
    savePreset(s, "200L run", { ...sample(), system: "SI" });

    const list = listPresets(s);
    expect(list.map((p) => p.name)).toEqual(["10L run", "200L run"]);
    expect(list[0]!.savedAt).not.toBe("");

    const loaded = loadPreset(s, "200L run").state!;
    expect(loaded.system).toBe("SI");

    deletePreset(s, "10L run");
    expect(listPresets(s).map((p) => p.name)).toEqual(["200L run"]);
  });

  test("empty name is rejected", () => {
    expect(() => savePreset(memStorage(), "   ", sample())).toThrow(/required/);
  });

  test("loading a missing preset returns an error", () => {
    expect(loadPreset(memStorage(), "nope").error).toMatch(/not found/);
  });

  test("listPresets ignores unrelated storage keys", () => {
    const s = memStorage();
    s.setItem("some.other.key", "x");
    savePreset(s, "only", sample());
    expect(listPresets(s).map((p) => p.name)).toEqual(["only"]);
  });
});
