// Public origin used for QR codes / share links.
//
// Phase 1 标准化：二维码必须使用「正式域名」，而不是 Lovable 预览域名
// (*.lovableproject.com / *.lovable.app) 或 localhost。
//
// 策略：
//   1. 启动时由 RootComponent 调用 loadOfficialOrigin()，从
//      app_settings.auth_base_url 读取正式域名并写入模块缓存 + localStorage。
//   2. 同步 getPublicOrigin() 优先返回该缓存。
//   3. 仅当缓存为空且当前 window 不是开发域时，回退到 window.location.origin。
//   4. 如果两者都不可用，使用 SSR_FALLBACK_ORIGIN。
import { getAuthBaseUrl } from "@/lib/auth-base-url";

export const SSR_FALLBACK_ORIGIN = "https://hoc3.lioneapps.com";
const LS_KEY = "official_origin_v1";

const DEV_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /\.lovable\.app$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
  /^0\.0\.0\.0(:\d+)?$/i,
];

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function isDevOrigin(originOrUrl: string): boolean {
  if (!originOrUrl) return false;
  try {
    const host = new URL(originOrUrl).host;
    return DEV_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return DEV_HOST_PATTERNS.some((re) => re.test(originOrUrl));
  }
}

let _officialOrigin: string | null = null;

// Hydrate from localStorage synchronously so first paint already uses the
// correct origin even before loadOfficialOrigin() resolves.
if (typeof window !== "undefined") {
  try {
    const cached = window.localStorage.getItem(LS_KEY);
    if (cached && /^https?:\/\//i.test(cached) && !isDevOrigin(cached)) {
      _officialOrigin = normalize(cached);
    }
  } catch { /* ignore */ }
}

export function setOfficialOrigin(url: string | null) {
  if (!url) {
    _officialOrigin = null;
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    return;
  }
  if (!/^https?:\/\//i.test(url)) return;
  if (isDevOrigin(url)) return; // 拒绝把开发域写进缓存
  _officialOrigin = normalize(url);
  try { window.localStorage.setItem(LS_KEY, _officialOrigin); } catch { /* ignore */ }
}

export function getOfficialOrigin(): string | null {
  return _officialOrigin;
}

/** 异步从 app_settings 读取并刷新缓存。在 RootComponent 启动时调用一次。 */
export async function loadOfficialOrigin(): Promise<string | null> {
  try {
    const base = await getAuthBaseUrl();
    if (base && /^https?:\/\//i.test(base) && !isDevOrigin(base)) {
      setOfficialOrigin(base);
      return _officialOrigin;
    }
  } catch { /* ignore */ }
  return _officialOrigin;
}

export function getPublicOrigin(): string {
  if (_officialOrigin) return _officialOrigin;
  if (typeof window !== "undefined") {
    const here = window.location.origin;
    if (!isDevOrigin(here)) return normalize(here);
  }
  return SSR_FALLBACK_ORIGIN;
}

/** 当前 window 是否处于开发域（用于在 UI 上提示警告）。 */
export function isCurrentWindowDev(): boolean {
  if (typeof window === "undefined") return false;
  return isDevOrigin(window.location.origin);
}
