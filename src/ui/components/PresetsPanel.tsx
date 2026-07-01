import React, { useMemo, useRef, useState } from "react";
import {
  browserStorage,
  deletePreset,
  listPresets,
  loadPreset,
  parsePresetText,
  savePreset,
  serializePreset,
  stateToCsv,
  shareableUrl,
} from "../presets";
import type { AppState, PresetSummary } from "../presets";

interface Props {
  /** Current full app state to save/export/share. */
  current: AppState;
  /** Apply a loaded/imported/decoded state to the app. */
  onLoad: (state: AppState) => void;
}

type Notice = { kind: "ok" | "error"; text: string } | null;

export function PresetsPanel({ current, onLoad }: Props) {
  const storage = useMemo(
    () => (typeof window !== "undefined" ? browserStorage(window.localStorage) : null),
    [],
  );
  const [name, setName] = useState("");
  const [presets, setPresets] = useState<PresetSummary[]>(() =>
    storage ? listPresets(storage) : [],
  );
  const [notice, setNotice] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => storage && setPresets(listPresets(storage));
  const flash = (n: Notice) => {
    setNotice(n);
    if (n) window.setTimeout(() => setNotice(null), 4000);
  };

  const handleSave = () => {
    if (!storage) return;
    try {
      savePreset(storage, name, current);
      setName("");
      refresh();
      flash({ kind: "ok", text: `Saved "${name.trim()}".` });
    } catch (e) {
      flash({ kind: "error", text: (e as Error).message });
    }
  };

  const handleLoad = (presetName: string) => {
    if (!storage) return;
    const res = loadPreset(storage, presetName);
    if (res.state) {
      onLoad(res.state);
      flash({ kind: "ok", text: `Loaded "${presetName}".` });
    } else {
      flash({ kind: "error", text: res.error ?? "Could not load preset." });
    }
  };

  const handleDelete = (presetName: string) => {
    if (!storage) return;
    deletePreset(storage, presetName);
    refresh();
    flash({ kind: "ok", text: `Deleted "${presetName}".` });
  };

  const download = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const handleExport = () =>
    download(serializePreset(current), "application/json", `pv-preset-${today()}.json`);

  const handleExportCsv = () =>
    // Prepend a UTF-8 BOM so Excel renders unit characters (µ, ³, …) correctly.
    download("\uFEFF" + stateToCsv(current), "text/csv;charset=utf-8", `pv-config-${today()}.csv`);

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parsePresetText(String(reader.result ?? ""));
      if (res.state) {
        onLoad(res.state);
        flash({ kind: "ok", text: `Imported "${file.name}".` });
      } else {
        flash({ kind: "error", text: res.error ?? "Could not import file." });
      }
    };
    reader.readAsText(file);
  };

  const handleShare = async () => {
    const url = shareableUrl(window.location.href, current);
    try {
      await navigator.clipboard.writeText(url);
      flash({ kind: "ok", text: "Shareable link copied to clipboard." });
    } catch {
      // Fallback: drop it into the address bar so the user can copy manually.
      window.history.replaceState(null, "", url);
      flash({ kind: "ok", text: "Link added to the address bar — copy it to share." });
    }
  };

  return (
    <section className="panel">
      <h2>Presets &amp; sharing</h2>
      <p className="field-help" style={{ marginTop: 0 }}>
        Save the current inputs (all tabs) to this browser, export them as a JSON or CSV file, or
        copy a link that reopens the tool with these exact values. (JSON re-imports here; CSV is a
        spreadsheet-friendly record.)
      </p>

      {notice && (
        <div className={`summary ${notice.kind === "ok" ? "summary-inside" : "summary-outside"}`}>
          <strong>{notice.text}</strong>
        </div>
      )}

      <fieldset>
        <legend>Save current configuration</legend>
        <div className="preset-save-row">
          <input
            type="text"
            placeholder="Preset name (e.g. 10 L CHO run)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button className="preset-btn" onClick={handleSave} disabled={!name.trim()}>
            Save
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Saved presets</legend>
        {presets.length === 0 ? (
          <p className="field-help" style={{ margin: 0 }}>No saved presets yet.</p>
        ) : (
          <ul className="preset-list">
            {presets.map((p) => (
              <li key={p.name}>
                <div className="preset-meta">
                  <span className="preset-name">{p.name}</span>
                  {p.savedAt && (
                    <span className="preset-date">{new Date(p.savedAt).toLocaleString()}</span>
                  )}
                </div>
                <div className="preset-actions">
                  <button className="preset-btn" onClick={() => handleLoad(p.name)}>Load</button>
                  <button className="preset-btn danger" onClick={() => handleDelete(p.name)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset>
        <legend>File &amp; link</legend>
        <div className="radio-row">
          <button className="preset-btn" onClick={handleExport}>Export JSON</button>
          <button className="preset-btn" onClick={handleExportCsv}>Export CSV</button>
          <button className="preset-btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button className="preset-btn" onClick={handleShare}>Copy shareable link</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </fieldset>
    </section>
  );
}
