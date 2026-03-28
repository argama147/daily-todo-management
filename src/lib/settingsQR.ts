import { type AppSettings } from "./settings";

export const SETTINGS_QR_PARAM = "settings";

/**
 * AppSettings を URL-safe Base64 文字列にエンコードする（日本語カテゴリ名対応）
 */
export function encodeSettingsToBase64(settings: AppSettings): string {
  const json = JSON.stringify(settings);
  // encodeURIComponent で非ASCII をパーセントエスケープ → 各バイトを1文字に変換
  const safeStr = encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(safeStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * URL-safe Base64 文字列を AppSettings にデコードする（失敗時は null）
 */
export function decodeSettingsFromBase64(encoded: string): AppSettings | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const safeStr = atob(padded);
    const json = decodeURIComponent(
      safeStr.split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json) as AppSettings;
  } catch {
    return null;
  }
}

/**
 * 設定共有URLを生成する
 */
export function buildSettingsShareUrl(settings: AppSettings): string {
  const encoded = encodeSettingsToBase64(settings);
  return `${window.location.origin}/?${SETTINGS_QR_PARAM}=${encoded}`;
}
