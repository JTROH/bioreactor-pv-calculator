import React from "react";
import type { ConstraintStatus } from "../../engine/types";

const LABELS: Record<ConstraintStatus, string> = {
  ok: "Within limit",
  caution: "Caution",
  violated: "Alert",
  advisory: "Info",
  unknown: "Needs input",
};

/** Colored status pill for a single constraint. */
export function ConstraintBadge({ status }: { status: ConstraintStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
