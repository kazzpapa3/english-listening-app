/**
 * Google Analytics 4 (gtag.js) の初期化とイベント送信。
 *
 * 測定IDは Vite の環境変数 VITE_GA_ID から取得する。
 * ID が未設定（空）の場合は何も読み込まず、イベント送信も no-op になる。
 * これにより開発環境やプレビューで誤って計測しないようにできる。
 */

const GA_ID = (import.meta.env.VITE_GA_ID ?? "").trim();

type GtagArgs = unknown[];

declare global {
  interface Window {
    dataLayer?: GtagArgs[];
    gtag?: (...args: GtagArgs) => void;
  }
}

let initialized = false;

/** GA が有効か（測定IDが設定されているか） */
export function isAnalyticsEnabled(): boolean {
  return GA_ID.length > 0;
}

/**
 * gtag.js を動的に読み込み、初期化する。
 * 複数回呼んでも一度だけ初期化される。
 */
export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  if (typeof document === "undefined") return;
  initialized = true;

  // gtag.js スクリプトを読み込む
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag は arguments をそのまま dataLayer に push する（公式スニペット準拠）
  window.gtag = function gtag(...args: GtagArgs) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

/**
 * カスタムイベントを送信する。GA 無効時は no-op。
 */
export function trackEvent(
  name: string,
  params?: Record<string, unknown>
): void {
  if (!isAnalyticsEnabled() || typeof window === "undefined" || !window.gtag) {
    return;
  }
  window.gtag("event", name, params ?? {});
}
