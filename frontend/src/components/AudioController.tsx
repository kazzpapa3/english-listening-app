import type { PlaybackRate } from "../types";
import { PLAYBACK_RATES } from "../types";

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: PlaybackRate;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: PlaybackRate) => void;
  /** 現在再生中の言語ラベル（例: "English" / "日本語"） */
  phaseLabel?: string;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioController({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onToggle,
  onSeek,
  onRateChange,
  phaseLabel,
}: Props) {
  return (
    <div className="audio-controller">
      <div className="audio-controller__row">
        <button
          className="play-button"
          onClick={onToggle}
          aria-label={isPlaying ? "一時停止" : "再生"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        <input
          className="seek-bar"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="再生位置"
        />
        <span className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div className="audio-controller__rates" role="group" aria-label="再生速度">
        {phaseLabel && <span className="phase-label">{phaseLabel}</span>}
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            className={`rate-button ${playbackRate === r ? "is-active" : ""}`}
            onClick={() => onRateChange(r)}
          >
            x{r.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}
