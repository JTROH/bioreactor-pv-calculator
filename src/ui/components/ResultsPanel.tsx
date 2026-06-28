import React from "react";
import type { ConstraintResult, EvaluationResult } from "../../engine/types";
import { ConstraintBadge } from "./ConstraintBadge";

const WINDOW_TEXT = {
  inside: { title: "Inside the shear-proof window", cls: "summary-inside" },
  outside: { title: "Outside the shear-proof window", cls: "summary-outside" },
  indeterminate: { title: "Window indeterminate — more input needed", cls: "summary-indeterminate" },
} as const;

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return n.toExponential(2);
  return parseFloat(n.toPrecision(4)).toString();
}

/** Format a constraint's SI value into a display value + unit. */
function display(c: ConstraintResult): { value: string; unit: string } {
  if (c.status === "unknown") return { value: "—", unit: "" };
  // Eddy lengths are stored in metres; show micrometres.
  if (c.unit === "m") return { value: fmt(c.value * 1e6), unit: "µm" };
  return { value: fmt(c.value), unit: c.unit };
}

export function ResultsPanel({ result }: { result: EvaluationResult }) {
  const w = WINDOW_TEXT[result.window];
  return (
    <section className="panel">
      <div className={`summary ${w.cls}`}>
        <strong>{w.title}</strong>
        {result.window === "outside" && result.violated.length > 0 && (
          <span className="summary-detail">Binding: {result.violated.join(", ")}</span>
        )}
        {result.window === "indeterminate" && result.unknown.length > 0 && (
          <span className="summary-detail">Awaiting: {result.unknown.join(", ")}</span>
        )}
        {result.skipped.length > 0 && (
          <span className="summary-detail">
            Optional checks skipped (input not provided): {result.skipped.join(", ")}
          </span>
        )}
      </div>

      <table className="results">
        <thead>
          <tr>
            <th>Quantity</th>
            <th className="num">Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {result.constraints.map((c) => {
            const d = display(c);
            return (
              <tr key={c.id} className={`row-${c.status}`}>
                <td>
                  <div className="q-label">{c.label}</div>
                  {c.message && <div className="q-msg">{c.message}</div>}
                </td>
                <td className="num">
                  {d.value} {d.unit && <span className="unit">{d.unit}</span>}
                </td>
                <td>
                  <ConstraintBadge status={c.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
