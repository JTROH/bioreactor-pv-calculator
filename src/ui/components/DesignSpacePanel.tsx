import React, { useMemo } from "react";
import {
  displayUnit,
  engineToDisplay,
  unitLabel,
  type UnitSystem,
} from "../../engine/units";
import { computeDesignSpace } from "../../engine/designspace";
import { buildOperatingPoint, type FormState } from "../model";

interface Props {
  reference: FormState;
  system: UnitSystem;
}

// SVG plot geometry (viewBox units).
const W = 680;
const H = 460;
const M = { top: 24, right: 120, bottom: 56, left: 76 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const FILL: Record<string, string> = {
  inside: "#9ccc9c",
  outside: "#f0b4ab",
  indeterminate: "#e6c98a",
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return parseFloat(n.toPrecision(3)).toString();
}

export function DesignSpacePanel({ reference, system }: Props) {
  const built = useMemo(() => buildOperatingPoint(reference, system), [reference, system]);

  const data = useMemo(() => {
    if (!built.point) return { error: "Complete the reference vessel (Single Vessel tab) first." };
    if (built.point.impeller.powerNumber === undefined)
      return { error: "Enter the power number (Np) on the Single Vessel tab to render the design space." };
    try {
      return { result: computeDesignSpace(built.point) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [built]);

  const nUnit = unitLabel(displayUnit("impellerSpeed", system));
  const vUnit = unitLabel(displayUnit("workingVolume", system));

  return (
    <section className="panel">
      <h2>Design space — impeller speed vs. working volume</h2>
      <p className="field-help" style={{ marginTop: 0 }}>
        Each point is evaluated against every shear constraint for the current vessel geometry,
        fluid, and sparger (from the <strong>Single Vessel</strong> tab). Green is inside the
        shear-proof window; red is outside. The marker shows your current operating point.
      </p>

      {"error" in data && data.error && (
        <div className="summary summary-indeterminate" style={{ marginTop: 12 }}>
          <strong>{data.error}</strong>
        </div>
      )}

      {"result" in data && data.result && (
        <DesignSpaceSVG result={data.result} system={system} nUnit={nUnit} vUnit={vUnit} />
      )}
    </section>
  );
}

function DesignSpaceSVG({
  result,
  system,
  nUnit,
  vUnit,
}: {
  result: ReturnType<typeof computeDesignSpace>;
  system: UnitSystem;
  nUnit: string;
  vUnit: string;
}) {
  const { nValues, vValues, grid, nRange, vRange, current } = result;
  const cellW = PLOT_W / nValues.length;
  const cellH = PLOT_H / vValues.length;

  // SI → pixel mappers.
  const xPix = (nSI: number) => M.left + ((nSI - nRange[0]) / (nRange[1] - nRange[0])) * PLOT_W;
  const yPix = (vSI: number) => M.top + (1 - (vSI - vRange[0]) / (vRange[1] - vRange[0])) * PLOT_H;

  // Axis ticks (display units).
  const xTicks = Array.from({ length: 5 }, (_, i) => nRange[0] + (i / 4) * (nRange[1] - nRange[0]));
  const yTicks = Array.from({ length: 5 }, (_, i) => vRange[0] + (i / 4) * (vRange[1] - vRange[0]));

  const cx = xPix(current.n);
  const cy = yPix(current.v);
  const currentInRange =
    current.n >= nRange[0] && current.n <= nRange[1] && current.v >= vRange[0] && current.v <= vRange[1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="design-svg" role="img" aria-label="Design space plot">
      {/* feasibility cells */}
      {grid.map((row, vi) =>
        row.map((win, ni) => (
          <rect
            key={`${vi}-${ni}`}
            x={M.left + ni * cellW}
            y={M.top + (vValues.length - 1 - vi) * cellH}
            width={cellW + 0.5}
            height={cellH + 0.5}
            fill={FILL[win] ?? "#ddd"}
          />
        )),
      )}

      {/* plot border */}
      <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} fill="none" stroke="#9aa7ad" />

      {/* x ticks */}
      {xTicks.map((t, i) => (
        <g key={`x${i}`}>
          <line x1={xPix(t)} y1={M.top + PLOT_H} x2={xPix(t)} y2={M.top + PLOT_H + 5} stroke="#9aa7ad" />
          <text x={xPix(t)} y={M.top + PLOT_H + 18} textAnchor="middle" className="axis-text">
            {fmt(engineToDisplay(t, "impellerSpeed", system))}
          </text>
        </g>
      ))}
      <text x={M.left + PLOT_W / 2} y={H - 8} textAnchor="middle" className="axis-label">
        Impeller speed N ({nUnit})
      </text>

      {/* y ticks */}
      {yTicks.map((t, i) => (
        <g key={`y${i}`}>
          <line x1={M.left - 5} y1={yPix(t)} x2={M.left} y2={yPix(t)} stroke="#9aa7ad" />
          <text x={M.left - 9} y={yPix(t) + 3} textAnchor="end" className="axis-text">
            {fmt(engineToDisplay(t, "workingVolume", system))}
          </text>
        </g>
      ))}
      <text
        transform={`translate(16, ${M.top + PLOT_H / 2}) rotate(-90)`}
        textAnchor="middle"
        className="axis-label"
      >
        Working volume V ({vUnit})
      </text>

      {/* current operating point */}
      {currentInRange && (
        <g>
          <circle cx={cx} cy={cy} r={6} fill="#14201f" stroke="#fff" strokeWidth={2} />
          <text x={cx + 10} y={cy - 8} className="axis-text" fill="#14201f">
            current
          </text>
        </g>
      )}

      {/* legend */}
      <g transform={`translate(${M.left + PLOT_W + 16}, ${M.top + 6})`}>
        <rect width={12} height={12} fill={FILL.inside} />
        <text x={18} y={11} className="axis-text">Inside</text>
        <rect y={22} width={12} height={12} fill={FILL.outside} />
        <text x={18} y={33} className="axis-text">Outside</text>
        <circle cx={6} cy={52} r={5} fill="#14201f" stroke="#fff" strokeWidth={1.5} />
        <text x={18} y={56} className="axis-text">Current</text>
      </g>
    </svg>
  );
}
