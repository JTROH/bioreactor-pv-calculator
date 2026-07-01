import React from "react";
import type { GuideSection } from "../guideContent";

interface Props {
  section: GuideSection;
  open: boolean;
  onToggle: () => void;
}

/** Collapsible "Parameter guide" side panel with plain-English explanations. */
export function GuidePanel({ section, open, onToggle }: Props) {
  if (!open) {
    return (
      <button className="guide-collapsed" onClick={onToggle} title="Show the parameter guide">
        <span className="guide-collapsed-icon" aria-hidden="true">
          📖
        </span>
        <span className="guide-collapsed-label">Parameter guide</span>
      </button>
    );
  }

  return (
    <aside className="panel guide-panel">
      <div className="guide-header">
        <h2>Parameter guide</h2>
        <button className="guide-hide" onClick={onToggle} title="Hide the guide">
          Hide ✕
        </button>
      </div>
      {section.intro && <p className="guide-intro">{section.intro}</p>}
      <dl className="guide-list">
        {section.entries.map((e) => (
          <div key={e.term} className="guide-entry">
            <dt>{e.term}</dt>
            <dd>
              <p>{e.def}</p>
              {e.typical && (
                <p>
                  <span className="guide-tag">Typical</span> {e.typical}
                </p>
              )}
              {e.how && (
                <p>
                  <span className="guide-tag">How to get it</span> {e.how}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
