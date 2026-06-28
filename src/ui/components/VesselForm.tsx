import React from "react";
import type { UnitSystem } from "../../engine/units";
import type { FormState } from "../model";
import { NumberField } from "./NumberField";

interface Props {
  state: FormState;
  system: UnitSystem;
  onChange: (patch: Partial<FormState>) => void;
}

/** Input form for a single bioreactor operating point. */
export function VesselForm({ state, system, onChange }: Props) {
  const set =
    (key: keyof FormState) =>
    (v: string) =>
      onChange({ [key]: v } as Partial<FormState>);

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
            help="Bioreactor/impeller-specific — empirical or from the vendor. Required for P/V."
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
          <NumberField
            label="Impeller swept volume (V_zone)"
            quantity="workingVolume"
            system={system}
            value={state.zoneVolume}
            onChange={set("zoneVolume")}
            help="Optional — enables localized impeller-zone EDR."
          />
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
