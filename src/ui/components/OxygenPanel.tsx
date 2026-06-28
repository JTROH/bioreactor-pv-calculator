import React, { useMemo } from "react";
import { engineToDisplay, type UnitSystem } from "../../engine/units";
import { oxygenBalance, KLA_PRESETS } from "../../engine/oxygen";
import {
  buildOxygenInputs,
  type FormState,
  type OtrFormState,
} from "../model";
import { NumberField } from "./NumberField";

interface Props {
  reference: FormState;
  otr: OtrFormState;
  system: UnitSystem;
  onChange: (patch: Partial<OtrFormState>) => void;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return n === Infinity ? "∞" : "—";
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return n.toExponential(2);
  return parseFloat(n.toPrecision(4)).toString();
}

export function OxygenPanel({ reference, otr, system, onChange }: Props) {
  const built = useMemo(
    () => buildOxygenInputs(otr, reference, system),
    [otr, reference, system],
  );
  const result = useMemo(
    () => (built.inputs ? oxygenBalance(built.inputs) : null),
    [built.inputs],
  );

  const set = (key: keyof OtrFormState) => (v: string) =>
    onChange({ [key]: v } as Partial<OtrFormState>);

  const applyPreset = (p: keyof typeof KLA_PRESETS) => {
    const k = KLA_PRESETS[p];
    onChange({ kLaA: String(k.A), kLaAlpha: String(k.alpha), kLaBeta: String(k.beta) });
  };

  return (
    <div className="two-col">
      <section className="panel">
        <h2>Oxygen transfer inputs</h2>
        <p className="field-help" style={{ marginTop: 0 }}>
          P/V is taken from the <strong>Single Vessel</strong> tab (requires Np). kLa uses{" "}
          <code>kLa = A·(P/V)^α·(vs)^β</code> (SI). Correlation constants are system-specific —
          presets are Van't Riet (1979) literature values; validate against your own data.
        </p>

        <fieldset>
          <legend>Gas &amp; geometry</legend>
          <div className="grid">
            <NumberField label="Gas flow (Q)" quantity="gasFlow" system={system} value={otr.gasFlow} onChange={set("gasFlow")} required />
            <NumberField label="Tank diameter (D_tank)" quantity="tankDiameter" system={system} value={otr.tankDiameter} onChange={set("tankDiameter")} required />
          </div>
        </fieldset>

        <fieldset>
          <legend>kLa correlation</legend>
          <div className="radio-row" style={{ marginBottom: 10 }}>
            <button type="button" className="preset-btn" onClick={() => applyPreset("coalescing")}>
              Coalescing (water)
            </button>
            <button type="button" className="preset-btn" onClick={() => applyPreset("nonCoalescing")}>
              Non-coalescing (media)
            </button>
          </div>
          <div className="grid">
            <NumberField label="Coefficient A" system={system} value={otr.kLaA} onChange={set("kLaA")} required unitOverride="" />
            <NumberField label="Exponent α (P/V)" system={system} value={otr.kLaAlpha} onChange={set("kLaAlpha")} required unitOverride="" />
            <NumberField label="Exponent β (vs)" system={system} value={otr.kLaBeta} onChange={set("kLaBeta")} required unitOverride="" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Dissolved oxygen</legend>
          <div className="grid">
            <NumberField label="Saturation O₂ (C*)" quantity="oxygenConc" system={system} value={otr.saturation} onChange={set("saturation")} required />
            <NumberField label="DO setpoint" system={system} value={otr.doPercent} onChange={set("doPercent")} required unitOverride="%" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Cell demand</legend>
          <div className="grid">
            <NumberField label="Specific OUR (qO₂)" quantity="specificOUR" system={system} value={otr.specificOUR} onChange={set("specificOUR")} required />
            <NumberField label="Viable cell density (X)" quantity="cellDensity" system={system} value={otr.cellDensity} onChange={set("cellDensity")} required />
          </div>
        </fieldset>
      </section>

      <div>
        {built.errors.length > 0 && (
          <section className="panel errors">
            <strong>Complete the inputs:</strong>
            <ul>
              {built.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </section>
        )}

        {result && (
          <section className="panel">
            <div className={`summary ${result.sufficient ? "summary-inside" : "summary-outside"}`}>
              <strong>
                {result.sufficient
                  ? "Oxygen supply meets demand"
                  : "Oxygen-limited — supply below demand"}
              </strong>
              <span className="summary-detail">
                OTR_max / OUR = {fmt(result.ratio)}
                {Number.isFinite(result.ratio) &&
                  ` (${result.ratio >= 1 ? "+" : ""}${fmt((result.ratio - 1) * 100)}% margin)`}
              </span>
            </div>

            <table className="results">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th className="num">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Power per volume (P/V)</td>
                  <td className="num">{fmt(built.powerPerVolume ?? NaN)} <span className="unit">W/m³</span></td>
                </tr>
                <tr>
                  <td>Superficial gas velocity (vs)</td>
                  <td className="num">{fmt(result.superficialVel * 1000)} <span className="unit">mm/s</span></td>
                </tr>
                <tr>
                  <td>Mass-transfer coefficient (kLa)</td>
                  <td className="num">{fmt(engineToDisplay(result.kLa, "kLa", system))} <span className="unit">1/h</span></td>
                </tr>
                <tr className={result.sufficient ? "" : "row-violated"}>
                  <td>Max oxygen transfer rate (OTR_max)</td>
                  <td className="num">{fmt(engineToDisplay(result.otrMax, "oxygenRate", system))} <span className="unit">mmol/(L·h)</span></td>
                </tr>
                <tr>
                  <td>Oxygen uptake rate (OUR)</td>
                  <td className="num">{fmt(engineToDisplay(result.our, "oxygenRate", system))} <span className="unit">mmol/(L·h)</span></td>
                </tr>
                <tr>
                  <td>Max sustainable cell density</td>
                  <td className="num">{fmt(engineToDisplay(result.maxCellDensity, "cellDensity", system))} <span className="unit">10⁶ cells/mL</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
