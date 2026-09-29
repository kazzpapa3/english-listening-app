import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Mode, PlaybackRate } from "./types";
import { getItems } from "./data";
import { useAudio } from "./hooks/useAudio";
import { ModeTabs } from "./components/ModeTabs";
import { TextPanel } from "./components/TextPanel";
import { AudioController } from "./components/AudioController";
import { NavButtons } from "./components/NavButtons";
import { AutoPlayToggle } from "./components/AutoPlayToggle";
import { JaSpeechToggle } from "./components/JaSpeechToggle";
import { trackEvent } from "./analytics";

// 公開ルート基準の相対パス (audio/...) を絶対パス (/audio/...) に変換
function toSrc(audio: string): string {
  return audio.startsWith("/") ? audio : `/${audio}`;
}

// 自動進行で次の問題に移るまでの待ち時間（ミリ秒）
const AUTO_ADVANCE_DELAY_MS = 1500;
// 英語の後、日本語読み上げを始めるまでの待ち時間（ミリ秒）
const EN_TO_JA_DELAY_MS = 700;

// 再生フェーズ: 英語 or 日本語
type Phase = "en" | "ja";

export default function App() {
  const [mode, setMode] = useState<Mode>("daily");
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [jaSpeech, setJaSpeech] = useState(false);
  const [phase, setPhase] = useState<Phase>("en");

  const items = useMemo(() => getItems(mode), [mode]);
  const item = items[index];
  const isLast = index >= items.length - 1;

  // 現在フェーズに応じた音源（日本語は等倍で再生するため速度切替の対象外）
  const src = phase === "ja" ? toSrc(item.jaAudio) : toSrc(item.audio);

  // 各種遅延タイマー
  const timerRef = useRef<number | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 最新の可変値を setTimeout 内から参照するための ref 群
  const stateRef = useRef({ autoPlay, jaSpeech, isLast, phase, itemsLen: items.length });
  useEffect(() => {
    stateRef.current = { autoPlay, jaSpeech, isLast, phase, itemsLen: items.length };
  }, [autoPlay, jaSpeech, isLast, phase, items.length]);

  const requestAutoPlayRef = useRef<() => void>(() => {});

  // 次の問題へ進む（フェーズを en に戻し、自動再生を予約）
  const goNextAuto = useCallback(() => {
    requestAutoPlayRef.current?.();
    setPhase("en");
    setIndex((i) => Math.min(stateRef.current.itemsLen - 1, i + 1));
  }, []);

  // 音源が最後まで再生されたとき
  const handleEnded = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "en") {
      // 英語が終わった
      if (s.jaSpeech) {
        // 日本語読み上げへ（少し間を置いて）
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          requestAutoPlayRef.current?.();
          setPhase("ja");
        }, EN_TO_JA_DELAY_MS);
      } else if (s.autoPlay && !s.isLast) {
        // 日本語なし → 自動で次へ
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          goNextAuto();
        }, AUTO_ADVANCE_DELAY_MS);
      }
    } else {
      // 日本語が終わった → 自動で次へ（ONかつ最終でない場合）
      if (s.autoPlay && !s.isLast) {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          goNextAuto();
        }, AUTO_ADVANCE_DELAY_MS);
      }
    }
  }, [clearTimer, goNextAuto]);

  const { audioRef, isPlaying, currentTime, duration, playbackRate, toggle, seek, setRate, requestAutoPlay } =
    useAudio(src, { onEnded: handleEnded });

  useEffect(() => {
    requestAutoPlayRef.current = requestAutoPlay;
  }, [requestAutoPlay]);

  // 問題(index/mode)が変わったら保留タイマー解除。※phase切替時は解除しない（連続再生のため）
  useEffect(() => {
    return () => clearTimer();
  }, [index, mode, clearTimer]);

  // 自動再生・日本語をOFFにしたら保留タイマー解除
  useEffect(() => {
    if (!autoPlay) clearTimer();
  }, [autoPlay, clearTimer]);

  // 音声再生イベント: isPlaying が false -> true になった瞬間に計測
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      trackEvent("audio_play", { mode, item_id: item.id, order: item.order, phase });
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, mode, item.id, item.order, phase]);

  const handleModeChange = (m: Mode) => {
    if (m === mode) return;
    clearTimer();
    setMode(m);
    setIndex(0);
    setPhase("en");
    trackEvent("mode_change", { mode: m });
  };

  const handleAutoPlayChange = (checked: boolean) => {
    setAutoPlay(checked);
    trackEvent("autoplay_toggle", { enabled: checked });
  };

  const handleJaSpeechChange = (checked: boolean) => {
    setJaSpeech(checked);
    trackEvent("ja_speech_toggle", { enabled: checked });
  };

  // 手動操作: 保留中の自動進行を解除し、フェーズを en に戻して移動
  const handlePrev = () => {
    clearTimer();
    setPhase("en");
    setIndex((i) => Math.max(0, i - 1));
  };
  const handleNext = () => {
    clearTimer();
    setPhase("en");
    setIndex((i) => Math.min(items.length - 1, i + 1));
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">English Listening</h1>
        <ModeTabs mode={mode} onChange={handleModeChange} />
      </header>

      <main className="app__main">
        <TextPanel label="EN" text={item.en} lang="en" variant="en" />
        <TextPanel label="JP" text={item.ja} lang="ja" variant="ja" />

        <AudioController
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          onToggle={toggle}
          onSeek={seek}
          onRateChange={(r: PlaybackRate) => setRate(r)}
          phaseLabel={phase === "ja" ? "日本語" : "English"}
        />

        <div className="toggles">
          <AutoPlayToggle checked={autoPlay} onChange={handleAutoPlayChange} />
          <JaSpeechToggle checked={jaSpeech} onChange={handleJaSpeechChange} />
        </div>

        {/* audio 要素は再利用し、src 属性の変更で切り替える（key は付けない） */}
        <audio ref={audioRef} src={src} preload="metadata" />
      </main>

      <footer className="app__footer">
        <NavButtons
          index={index}
          total={items.length}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </footer>
    </div>
  );
}
