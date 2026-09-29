export type Mode = "daily" | "conference";

export type VoiceId = "Joanna" | "Matthew";
export type JaVoiceId = "Kazuha" | "Takumi" | "Tomoko";

export interface Item {
  id: string;
  mode: Mode;
  order: number;
  en: string;
  ja: string;
  voice: VoiceId;
  rate: number;
  /** 公開ルートからの相対パス (例: audio/daily/daily-01.mp3) */
  audio: string;
  /** 日本語読み上げのボイス */
  jaVoice: JaVoiceId;
  /** 日本語音声の公開ルート相対パス (例: audio/daily-ja/daily-01.mp3) */
  jaAudio: string;
}

export const MODE_LABELS: Record<Mode, string> = {
  daily: "日常会話",
  conference: "AWSカンファレンス",
};

export const PLAYBACK_RATES = [0.75, 1.0, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
