import React from "react";
import { displayUnit, unitLabel, type Quantity, type UnitSystem } from "../../engine/units";

interface Props {
  label: string;
  /** Quantity drives the displayed unit; omit for dimensionless fields. */
  quantity?: Quantity;
  system: UnitSystem;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** Override the unit label (e.g. for SI-only advanced fields). */
  unitOverride?: string;
  help?: string;
  placeholder?: string;
  step?: string;
}

/** Labeled numeric input with a unit suffix derived from the unit system. */
export function NumberField({
  label,
  quantity,
  system,
  value,
  onChange,
  required,
  unitOverride,
  help,
  placeholder,
  step,
}: Props) {
  const unit =
    unitOverride ?? (quantity ? unitLabel(displayUnit(quantity, system)) : "");
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="req" title="Required"> *</span>}
      </span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          step={step}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}
