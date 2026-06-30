// Save / load / share presets.
//
// A "preset" is a snapshot of the whole UI state (unit system + the three
// forms). This module is pure and testable: it handles serialization,
// validation of untrusted input (imported files, URL hashes), and named-preset
// storage behind a small StorageLike interface (real localStorage in the UI,
// an in-memory map in tests).

import {
  DEFAULTS,
  SCALE_DEFAULTS,
  OTR_DEFAULTS,
  type FormState,
  type ScaleFormState,
  type OtrFormState,
} from "./model";
import type { UnitSystem } from "../engine/units";

/** Everything needed to fully restore the UI. */
export interface AppState {
  system: UnitSystem;
  form: FormState;
  scale: ScaleFormState;
  otr: OtrFormState;
}

export const PRESET_VERSION = 1;
const APP_ID = "bioreactor-pv-calculator";

export interface PresetFile {
  app: string;
  version: number;
  savedAt: string;
  state: AppState;
}

// --- coercion / validation (untrusted input lives here) --------------------

function coerceString(v: unknown, fallback: string): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

/**
 * Rebuild an object with exactly the keys/types of `template`, pulling matching
 * values from `raw` and falling back to the template otherwise. Booleans coerce
 * to booleans, everything else to strings. This makes import forward/backward
 * compatible (unknown keys dropped, missing keys defaulted).
 */
function coerceLike<T extends object>(raw: unknown, template: T): T {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tpl = template as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(tpl)) {
    const t = tpl[key];
    const v = src[key];
    out[key] = typeof t === "boolean" ? (typeof v === "boolean" ? v : t) : coerceString(v, t as string);
  }
  return out as T;
}

/** Parse an arbitrary value into a valid AppState (never throws). */
export function parseAppState(raw: unknown): AppState {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  // Accept either a PresetFile ({state}) or a bare AppState.
  const st =
    root.state && typeof root.state === "object" ? (root.state as Record<string, unknown>) : root;

  const system: UnitSystem = st.system === "practical" ? "practical" : "SI";
  const form = coerceLike(st.form, DEFAULTS.SI);
  const scale = coerceLike(st.scale, SCALE_DEFAULTS.SI);
  const otr = coerceLike(st.otr, OTR_DEFAULTS.SI);

  // criterion is a string union — keep only valid values.
  if (scale.criterion !== "pv" && scale.criterion !== "tipSpeed") {
    scale.criterion = "pv";
  }
  // zoneMode is a string union — keep only valid values.
  if (form.zoneMode !== "direct" && form.zoneMode !== "bladeWidth") {
    form.zoneMode = "direct";
  }

  return { system, form, scale, otr };
}

/** Wrap an AppState in a versioned file envelope. */
export function makePresetFile(state: AppState): PresetFile {
  return { app: APP_ID, version: PRESET_VERSION, savedAt: new Date().toISOString(), state };
}

/** Pretty JSON for file export. */
export function serializePreset(state: AppState): string {
  return JSON.stringify(makePresetFile(state), null, 2);
}

export interface ParseResult {
  state?: AppState;
  error?: string;
}

/** Parse imported file text; rejects anything that isn't a recognizable preset. */
export function parsePresetText(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "Not valid JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Unrecognized preset file." };
  }
  const obj = raw as Record<string, unknown>;
  const looksLikePreset =
    "state" in obj || "form" in obj || "version" in obj || obj.app === APP_ID;
  if (!looksLikePreset) return { error: "Unrecognized preset file." };
  return { state: parseAppState(raw) };
}

// --- shareable URL hash -----------------------------------------------------

export const HASH_PREFIX = "cfg=";

/** Encode an AppState into a URL-hash-safe parameter value (unicode-safe). */
export function encodeStateToHash(state: AppState): string {
  return encodeURIComponent(JSON.stringify(makePresetFile(state)));
}

/** Decode a URL-hash parameter value back into an AppState. */
export function decodeHashToState(param: string): ParseResult {
  let text: string;
  try {
    text = decodeURIComponent(param);
  } catch {
    return { error: "Malformed share link." };
  }
  return parsePresetText(text);
}

/** Build a full shareable URL for the current page + state. */
export function shareableUrl(base: string, state: AppState): string {
  const clean = base.split("#")[0];
  return `${clean}#${HASH_PREFIX}${encodeStateToHash(state)}`;
}

/** If a location hash carries a config, decode it; otherwise undefined. */
export function stateFromLocationHash(hash: string): AppState | undefined {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.startsWith(HASH_PREFIX)) return undefined;
  const res = decodeHashToState(h.slice(HASH_PREFIX.length));
  return res.state;
}

// --- named-preset storage ---------------------------------------------------

/** Minimal storage surface (satisfied by window.localStorage via a wrapper). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

const KEY_PREFIX = "pvtool.preset.";

export interface PresetSummary {
  name: string;
  savedAt: string;
}

/** Wrap window.localStorage into a StorageLike. */
export function browserStorage(ls: Storage): StorageLike {
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
    keys: () => {
      const out: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k) out.push(k);
      }
      return out;
    },
  };
}

export function savePreset(storage: StorageLike, name: string, state: AppState): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Preset name is required.");
  storage.setItem(KEY_PREFIX + trimmed, serializePreset(state));
}

export function listPresets(storage: StorageLike): PresetSummary[] {
  return storage
    .keys()
    .filter((k) => k.startsWith(KEY_PREFIX))
    .map((k) => {
      const name = k.slice(KEY_PREFIX.length);
      let savedAt = "";
      const raw = storage.getItem(k);
      if (raw) {
        try {
          savedAt = (JSON.parse(raw) as PresetFile).savedAt ?? "";
        } catch {
          /* ignore corrupt entry timestamp */
        }
      }
      return { name, savedAt };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadPreset(storage: StorageLike, name: string): ParseResult {
  const raw = storage.getItem(KEY_PREFIX + name);
  if (raw === null) return { error: `Preset "${name}" not found.` };
  return parsePresetText(raw);
}

export function deletePreset(storage: StorageLike, name: string): void {
  storage.removeItem(KEY_PREFIX + name);
}
