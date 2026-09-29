import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackRate } from "../types";

interface UseAudioOptions {
  /** 再生が最後まで終わったときに呼ばれる（自動進行などに使用） */
  onEnded?: () => void;
}

interface UseAudioResult {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: PlaybackRate;
  toggle: () => void;
  seek: (time: number) => void;
  setRate: (rate: PlaybackRate) => void;
  /** 次に src が読み込まれたら自動で再生する（自動進行用） */
  requestAutoPlay: () => void;
}

/**
 * <audio> 要素の再生状態を管理するフック。
 * src が変わったら再生を停止し先頭へ戻す。playbackRate は src が変わっても維持する。
 */
export function useAudio(src: string, options?: UseAudioOptions): UseAudioResult {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1.0);

  // 次の src ロード時に自動再生するかどうか
  const autoPlayNextRef = useRef(false);
  // onEnded は毎レンダーで変わりうるので ref に保持し、イベント購読を張り直さない
  const onEndedRef = useRef<UseAudioOptions["onEnded"]>(options?.onEnded);
  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  // src 変更時のリセット + イベント購読を単一の effect にまとめる。
  // リスナーを付けた直後に load() を呼ぶことで、loadedmetadata/canplay を取りこぼさない。
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    // --- リセット ---
    el.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // --- リスナー定義 ---
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const tryAutoPlay = () => {
      if (autoPlayNextRef.current) {
        autoPlayNextRef.current = false;
        void el.play().catch(() => {
          /* 自動再生がブロックされた場合は無視（ユーザー操作待ち） */
        });
      }
    };
    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      el.playbackRate = playbackRate;
    };
    // canplay で自動再生を試みる（メタデータだけでなく再生可能になってから）
    const onCanPlay = () => {
      el.playbackRate = playbackRate;
      tryAutoPlay();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      el.currentTime = 0;
      onEndedRef.current?.();
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    // リスナーを付けた後に読み込みを開始（取りこぼし防止）
    el.playbackRate = playbackRate;
    el.load();

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [playbackRate, src]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setRate = useCallback((rate: PlaybackRate) => {
    setPlaybackRate(rate);
    const el = audioRef.current;
    if (el) el.playbackRate = rate;
  }, []);

  const requestAutoPlay = useCallback(() => {
    autoPlayNextRef.current = true;
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    toggle,
    seek,
    setRate,
    requestAutoPlay,
  };
}
