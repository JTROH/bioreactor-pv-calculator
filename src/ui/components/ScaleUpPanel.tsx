import React, { useMemo } from "react";
import {
  displayUnit,
  engineToDisplay,
  unitLabel,
  type UnitSystem,
} from "../../engine/units";
import { scaleUp, type ScaleCriterion } from "../../engine/scaleup";
import {
  buildOperatingPoint,
  buildTargetGeometry,
  type FormState,
  type ScaleFormState,
} from "../model";
import { NumberField } from "./NumberField";
import { ResultsPanel } from "./ResultsPanel";

interface Props {
  /** Reference vessel = the single-vessel form state. */
  reference: FormState;
  scale: ScaleFormState;
  system: UnitSystem;
  onChange: (patch: Partial<ScaleFormState>) => void;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return parseFloat(n.toPrecision(4)).toString();
}

const CRITERIA: Array<{ id: ScaleCriterion; label: string }> = [
  { id: "pv", label: "Hold P/V constant" },
  { id: "tipSpeed", label: "Hold tip speed constant" },
];

export function ScaleUpPanel({ reference, scale, system, onChange }: Props) {
  const refBuilt = useMemo(() => buildOperatingPoint(reference, system), [reference, system]);
  const tgtBuilt = useMemo(() => buildTargetGeometry(scale, system), [scale, system]);

  const computed = useMemo(() => {
    if (!refBuilt.point) return { error: "Complete the reference vessel (Single Vessel tab) first." };
    if (!tgtBuilt.target) return { error: tgtBuilt.errors.join(" ") };
    try {
      return { result: scaleUp(refBuilt.point, tgtBuilt.target, scale.criterion) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [refBuilt, tgtBuilt, scale.criterion]);

  const speedUnit = unitLabel(displayUnit("impellerSpeed", system));

  return (
    <>
      <section className="panel">
        <h2>Scaling target</h2>
        <p className="field-help" style={{ marginTop: 0 }}>
          Reference vessel is taken from the <strong>Single Vessel</strong> tab. Choose a target
          geometry (larger or smaller) and the criterion to hold constant; the solver finds the
          target impeller speed and re-checks every constraint at the new scale.
        </p>

        <fieldset>
          <legend>Criterion</legend>
          <div className="radio-row">
            {CRITERIA.map((c) => (
              <label key={c.id} className="toggle-inline">
                <input
                  type="radio"
                  name="criterion"
                  checked={scale.criterion === c.id}
                  onChange={() => onChange({ criterion: c.id })}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Target geometry</legend>
          <div className="grid">
            <NumberField
              label="Target diameter (D₂)"
              quantity="impellerDiameter"
              system={system}
              value={scale.targetDiameter}
              onChange={(v) => onChange({ targetDiameter: v })}
              required
            />
            <NumberField
              label="Target working volume (V₂)"
              quantity="workingVolume"
              system={system}
              value={scale.targetVolume}
              onChange={(v) => onChange({ targetVolume: v })}
              required
            />
            <NumberField
              label="Target swept volume (V_zone)"
              quantity="workingVolume"
              system={system}
              value={scale.targetZoneVolume}
              onChange={(v) => onChange({ targetZoneVolume: v })}
              help="Optional — enables localized EDR at target."
            />
            <NumberField
              label="Target Np override"
              system={system}
              value={scale.targetPowerNumber}
              onChange={(v) => onChange({ targetPowerNumber: v })}
              unitOverride=""
              help="Optional — defaults to the reference Np (same impeller design)."
            />
          </div>
        </fieldset>
      </section>

      {"error" in computed && computed.error && (
        <section className="panel errors">
          <strong>Cannot scale up yet:</strong>
          <p style={{ margin: "6px 0 0", fontSize: "0.86rem" }}>{computed.error}</p>
        </section>
      )}

      {"result" in computed && computed.result && (
        <>
          <section className="panel">
            <h2>Solved target conditions</h2>
            <table className="kv">
              <tbody>
                <tr>
                  <td>Criterion held constant</td>
                  <td className="num">
                    {scale.criterion === "pv" ? "P/V" : "Tip speed"} ={" "}
                    {scale.criterion === "pv"
                      ? `${fmt(computed.result.heldValue)} W/m³`
                      : `${fmt(computed.result.heldValue)} m/s`}
                  </td>
                </tr>
                <tr>
                  <td>Solved impeller speed (N₂)</td>
                  <td className="num">
                    {fmt(engineToDisplay(computed.result.solvedSpeed, "impellerSpeed", system))}{" "}
                    <span className="unit">{speedUnit}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            {computed.result.warnings.length > 0 && (
              <ul className="warnings">
                {computed.result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </section>

          <ResultsPanel result={computed.result.evaluation} />
        </>
      )}
    </>
  );
}
