import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import type { UnitSystem } from "../engine/units";
import { evaluateOperatingPoint } from "../engine/constraints";
import type { EvaluationResult } from "../engine/types";
import {
  DEFAULTS,
  SCALE_DEFAULTS,
  buildOperatingPoint,
  convertFormState,
  convertScaleState,
  type FormState,
  type ScaleFormState,
} from "./model";
import { VesselForm } from "./components/VesselForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { ScaleUpPanel } from "./components/ScaleUpPanel";

type Tab = "single" | "scaleup";

function App() {
  const [system, setSystem] = useState<UnitSystem>("SI");
  const [tab, setTab] = useState<Tab>("single");
  const [state, setState] = useState<FormState>(DEFAULTS.SI);
  const [scale, setScale] = useState<ScaleFormState>(SCALE_DEFAULTS.SI);

  const onChange = (patch: Partial<FormState>) => setState((prev) => ({ ...prev, ...patch }));
  const onScaleChange = (patch: Partial<ScaleFormState>) =>
    setScale((prev) => ({ ...prev, ...patch }));

  // Switch unit system: convert all populated numeric fields in place.
  const switchSystem = (next: UnitSystem) => {
    if (next === system) return;
    setState((prev) => convertFormState(prev, system, next));
    setScale((prev) => convertScaleState(prev, system, next));
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
          <div className="unit-toggle" role="group" aria-label="Unit system">
            <button
              className={system === "SI" ? "active" : ""}
              onClick={() => switchSystem("SI")}
            >
              SI
            </button>
            <button
              className={system === "practical" ? "active" : ""}
              onClick={() => switchSystem("practical")}
            >
              Practical
            </button>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "single" ? "active" : ""} onClick={() => setTab("single")}>
            Single Vessel
          </button>
          <button className={tab === "scaleup" ? "active" : ""} onClick={() => setTab("scaleup")}>
            Scale-Up
          </button>
        </nav>
      </header>

      {tab === "single" ? (
        <main className="container two-col">
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
        </main>
      ) : (
        <main className="container">
          <ScaleUpPanel reference={state} scale={scale} system={system} onChange={onScaleChange} />
        </main>
      )}

      <footer className="app-footer">
        Engineering reference only. Thresholds from BioProcess International
        (Muralidharan, 2023); some equation forms reconstructed from standard
        stirred-tank correlations. Validate against primary literature and process
        data before GMP use.
      </footer>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
