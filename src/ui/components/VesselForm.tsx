import React from "react";
import {
  displayToEngine,
  engineToDisplay,
  displayUnit,
  unitLabel,
  type UnitSystem,
} from "../../engine/units";
import { estimateSweptVolume } from "../../engine/impeller";
import type { FormState } from "../model";
import { NumberField } from "./NumberField";

interface Props {
  state: FormState;
  system: UnitSystem;
  onChange: (patch: Partial<FormState>) => void;
}

/** Computed V_zone (in the working-volume display unit) from D + blade width. */
function computedZoneVolumeLabel(state: FormState, system: UnitSystem): string | null {
  const dNum = Number(state.impellerDiameter);
  const wNum = Number(state.bladeWidth);
  if (!Number.isFinite(dNum) || dNum <= 0 || !Number.isFinite(wNum) || wNum <= 0) return null;
  const dSI = displayToEngine(dNum, "impellerDiameter", system);
  const wSI = displayToEngine(wNum, "impellerDiameter", system);
  const vSI = estimateSweptVolume(dSI, wSI);
  const v = engineToDisplay(vSI, "workingVolume", system);
  const unit = unitLabel(displayUnit("workingVolume", system));
  return `${parseFloat(v.toPrecision(4))} ${unit}`;
}

/** Input form for a single bioreactor operating point. */
export function VesselForm({ state, system, onChange }: Props) {
  const set =
    (key: keyof FormState) =>
    (v: string) =>
      onChange({ [key]: v } as Partial<FormState>);

  const zoneVolumeLabel = computedZoneVolumeLabel(state, system);

  return (
    <section className="panel">
      <h2>Vessel inputs</h2>

      <fieldset>
        <legend>Impeller</legend>
        <div className="grid">
          <NumberField
            label="Power number (Np)"
            system={system}
            value={state.powerNumber}
            onChange={set("powerNumber")}
            required
            placeholder="e.g. 5"
            help="Bioreactor/impeller-specific — empirical or from the vendor. Required for P/V. Typical: Rushton ~5.0, pitched-blade ~1.3, elephant-ear ~1.7, Lightnin A315 ~0.84, axial high-efficiency ~0.3."
          />
          <NumberField
            label="Impeller diameter (D)"
            quantity="impellerDiameter"
            system={system}
            value={state.impellerDiameter}
            onChange={set("impellerDiameter")}
            required
          />
          <NumberField
            label="Impeller speed (N)"
            quantity="impellerSpeed"
            system={system}
            value={state.impellerSpeed}
            onChange={set("impellerSpeed")}
            required
          />
        </div>

        <div className="zone-block">
          <div className="zone-head">
            <span className="field-label">Impeller swept volume (V_zone)</span>
            <span className="zone-modes">
              <label className="toggle-inline">
                <input
                  type="radio"
                  name="zoneMode"
                  checked={state.zoneMode === "direct"}
                  onChange={() => onChange({ zoneMode: "direct" })}
                />
                Enter directly
              </label>
              <label className="toggle-inline">
                <input
                  type="radio"
                  name="zoneMode"
                  checked={state.zoneMode === "bladeWidth"}
                  onChange={() => onChange({ zoneMode: "bladeWidth" })}
                />
                From blade width
              </label>
            </span>
          </div>
          <div className="grid">
            {state.zoneMode === "direct" ? (
              <NumberField
                label="V_zone"
                quantity="workingVolume"
                system={system}
                value={state.zoneVolume}
                onChange={set("zoneVolume")}
                help="Optional — enables localized impeller-zone EDR."
              />
            ) : (
              <NumberField
                label="Blade width / height (w)"
                quantity="impellerDiameter"
                system={system}
                value={state.bladeWidth}
                onChange={set("bladeWidth")}
                help={
                  zoneVolumeLabel
                    ? `V_zone = (π/4)·D²·w = ${zoneVolumeLabel}`
                    : "Optional — V_zone = (π/4)·D²·w (needs D and w)."
                }
              />
            )}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Fluid</legend>
        <div className="grid">
          <NumberField
            label="Working volume (V)"
            quantity="workingVolume"
            system={system}
            value={state.workingVolume}
            onChange={set("workingVolume")}
            required
          />
          <NumberField
            label="Liquid density (ρ)"
            quantity="liquidDensity"
            system={system}
            value={state.liquidDensity}
            onChange={set("liquidDensity")}
            required
          />
          <NumberField
            label="Liquid viscosity (μ)"
            quantity="liquidViscosity"
            system={system}
            value={state.liquidViscosity}
            onChange={set("liquidViscosity")}
            required
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <label className="toggle-inline">
            <input
              type="checkbox"
              checked={state.gasEnabled}
              onChange={(e) => onChange({ gasEnabled: e.target.checked })}
            />
            Gas / sparging
          </label>
        </legend>
        {state.gasEnabled && (
          <div className="grid">
            <NumberField
              label="Gas flow (Q)"
              quantity="gasFlow"
              system={system}
              value={state.gasFlow}
              onChange={set("gasFlow")}
              required
            />
            <NumberField
              label="Hole count (n)"
              system={system}
              value={state.holeCount}
              onChange={set("holeCount")}
              required
              unitOverride=""
              step="1"
            />
            <NumberField
              label="Hole diameter (d)"
              quantity="holeDiameter"
              system={system}
              value={state.holeDiameter}
              onChange={set("holeDiameter")}
              required
            />
            <NumberField
              label="Gas density (ρ_gas)"
              quantity="liquidDensity"
              system={system}
              value={state.gasDensity}
              onChange={set("gasDensity")}
              required
            />
            <NumberField
              label="Gas viscosity (μ_gas)"
              quantity="liquidViscosity"
              system={system}
              value={state.gasViscosity}
              onChange={set("gasViscosity")}
              required
            />
            <NumberField
              label="Bubble-wake EDR (ε_wake)"
              system={system}
              value={state.wakeEdr}
              onChange={set("wakeEdr")}
              unitOverride="m²/s³"
              help="Optional (SI) — enables bubble-wake eddy-length check."
            />
          </div>
        )}
      </fieldset>
    </section>
  );
}
