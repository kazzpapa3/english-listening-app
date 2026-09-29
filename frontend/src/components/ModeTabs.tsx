import type { Mode } from "../types";
import { MODE_LABELS } from "../types";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const MODES: Mode[] = ["daily", "conference"];

export function ModeTabs({ mode, onChange }: Props) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="学習モード">
      {MODES.map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          className={`mode-tab ${mode === m ? "is-active" : ""}`}
          onClick={() => onChange(m)}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
