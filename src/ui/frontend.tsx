import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import type { UnitSystem } from "../engine/units";
import { evaluateOperatingPoint } from "../engine/constraints";
import type { EvaluationResult } from "../engine/types";
import {
  DEFAULTS,
  SCALE_DEFAULTS,
  OTR_DEFAULTS,
  buildOperatingPoint,
  convertFormState,
  convertScaleState,
  convertOtrState,
  type FormState,
  type ScaleFormState,
  type OtrFormState,
} from "./model";
import { VesselForm } from "./components/VesselForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { ScaleUpPanel } from "./components/ScaleUpPanel";
import { DesignSpacePanel } from "./components/DesignSpacePanel";
import { OxygenPanel } from "./components/OxygenPanel";
import { PresetsPanel } from "./components/PresetsPanel";
import { GuidePanel } from "./components/GuidePanel";
import { SINGLE_GUIDE, SCALING_GUIDE, OXYGEN_GUIDE } from "./guideContent";
import { stateFromLocationHash, type AppState } from "./presets";

type Tab = "single" | "scaleup" | "designspace" | "oxygen" | "presets";

/** Initial state — from a share-link hash if present, otherwise defaults. */
function initialAppState(): AppState {
  if (typeof window !== "undefined") {
    const fromHash = stateFromLocationHash(window.location.hash);
    if (fromHash) return fromHash;
  }
  return {
    system: "practical",
    form: DEFAULTS.practical,
    scale: SCALE_DEFAULTS.practical,
    otr: OTR_DEFAULTS.practical,
  };
}

function App() {
  const [initial] = useState<AppState>(initialAppState);
  const [system, setSystem] = useState<UnitSystem>(initial.system);
  const [tab, setTab] = useState<Tab>("single");
  const [state, setState] = useState<FormState>(initial.form);
  const [scale, setScale] = useState<ScaleFormState>(initial.scale);
  const [otr, setOtr] = useState<OtrFormState>(initial.otr);
  const [guideOpen, setGuideOpen] = useState(true);
  const toggleGuide = () => setGuideOpen((v) => !v);

  const onChange = (patch: Partial<FormState>) => setState((prev) => ({ ...prev, ...patch }));
  const onScaleChange = (patch: Partial<ScaleFormState>) =>
    setScale((prev) => ({ ...prev, ...patch }));
  const onOtrChange = (patch: Partial<OtrFormState>) => setOtr((prev) => ({ ...prev, ...patch }));

  // Apply a complete state (from a loaded/imported/shared preset).
  const applyAppState = (s: AppState) => {
    setSystem(s.system);
    setState(s.form);
    setScale(s.scale);
    setOtr(s.otr);
    setTab("single");
  };

  // Switch unit system: convert all populated numeric fields in place.
  const switchSystem = (next: UnitSystem) => {
    if (next === system) return;
    setState((prev) => convertFormState(prev, system, next));
    setScale((prev) => convertScaleState(prev, system, next));
    setOtr((prev) => convertOtrState(prev, system, next));
    setSystem(next);
  };

  const { result, errors } = useMemo(() => {
    const built = buildOperatingPoint(state, system);
    if (!built.point) return { result: null as EvaluationResult | null, errors: built.errors };
    try {
      return { result: evaluateOperatingPoint(built.point), errors: [] as string[] };
    } catch (e) {
      return { result: null, errors: [(e as Error).message] };
    }
  }, [state, system]);

  return (
    <>
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Power Input per Unit Volume (P/V) Calculator</h1>
            <p>Stirred-tank bioreactor — shear-proof design space for cell culture</p>
          </div>
          <div className="unit-control">
            <div className="unit-toggle" role="group" aria-label="Unit system">
              <button
                className={system === "SI" ? "active" : ""}
                onClick={() => switchSystem("SI")}
                title="SI base units: m, rev/s, m³, kg/m³, Pa·s, W/m³"
              >
                SI
              </button>
              <button
                className={system === "practical" ? "active" : ""}
                onClick={() => switchSystem("practical")}
                title="Practical bench units: mm, rpm, L, g/L, cP"
              >
                Practical
              </button>
            </div>
            <p className="unit-hint">
              Only how values are entered/displayed — results are identical.
              <br />
              <strong>SI</strong>: m, rev/s, m³, Pa·s · <strong>Practical</strong>: mm, rpm, L, cP
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "single" ? "active" : ""} onClick={() => setTab("single")}>
            Single Vessel
          </button>
          <button className={tab === "scaleup" ? "active" : ""} onClick={() => setTab("scaleup")}>
            Scaling
          </button>
          <button
            className={tab === "designspace" ? "active" : ""}
            onClick={() => setTab("designspace")}
          >
            Design Space
          </button>
          <button className={tab === "oxygen" ? "active" : ""} onClick={() => setTab("oxygen")}>
            Oxygen (kLa/OTR)
          </button>
          <button className={tab === "presets" ? "active" : ""} onClick={() => setTab("presets")}>
            Presets
          </button>
        </nav>
      </header>

      {tab === "single" ? (
        <main className={`guide-layout${guideOpen ? "" : " collapsed"}`}>
          <GuidePanel section={SINGLE_GUIDE} open={guideOpen} onToggle={toggleGuide} />
          <div className="guide-main two-col">
            <VesselForm state={state} system={system} onChange={onChange} />
            <div>
              {errors.length > 0 && (
                <section className="panel errors">
                  <strong>Complete the required inputs:</strong>
                  <ul>
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </section>
              )}
              {result && <ResultsPanel result={result} />}
            </div>
          </div>
        </main>
      ) : tab === "scaleup" ? (
        <main className={`guide-layout${guideOpen ? "" : " collapsed"}`}>
          <GuidePanel section={SCALING_GUIDE} open={guideOpen} onToggle={toggleGuide} />
          <div className="guide-main">
            <ScaleUpPanel reference={state} scale={scale} system={system} onChange={onScaleChange} />
          </div>
        </main>
      ) : tab === "designspace" ? (
        <main className="container">
          <DesignSpacePanel reference={state} system={system} />
        </main>
      ) : tab === "oxygen" ? (
        <main className={`guide-layout${guideOpen ? "" : " collapsed"}`}>
          <GuidePanel section={OXYGEN_GUIDE} open={guideOpen} onToggle={toggleGuide} />
          <div className="guide-main">
            <OxygenPanel reference={state} otr={otr} system={system} onChange={onOtrChange} />
          </div>
        </main>
      ) : (
        <main className="container">
          <PresetsPanel current={{ system, form: state, scale, otr }} onLoad={applyAppState} />
        </main>
      )}

      <footer className="app-footer">
        <p className="footer-privacy">
          🔒 <strong>Your data stays private.</strong> This tool runs entirely in your browser —
          nothing you enter is sent to any server, collected, or shared. Saved presets are kept
          only in this browser's local storage on your device; a shareable link encodes your inputs
          only if you choose to copy and send one.
        </p>
        <p>
          Engineering reference only. Thresholds from BioProcess International (Muralidharan, 2023)
          and Hu &amp; Wiltberger (Industrial Cell Culture Scale-up); some equation forms
          reconstructed from standard stirred-tank correlations. Validate against primary literature
          and process data before GMP use.
        </p>
      </footer>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
