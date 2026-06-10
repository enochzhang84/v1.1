// Public origin used for QR codes / share links.
//
// 测试环境策略（当前项目）：
//   - 不绑定任何正式域名
//   - 二维码直接使用当前 window.location.origin
//     （即 https://<uuid>.lovableproject.com 或 *.lovable.app）
//   - 不再从 app_settings.auth_base_url 自动写入"正式域名"缓存
//
// 如未来切换正式环境，再恢复 loadOfficialOrigin 的 DB 读取逻辑即可。

export const SSR_FALLBACK_ORIGIN =
  "https://62afd8e3-2019-4bcc-a154-5b4a311e6a8e.lovableproject.com";
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

// 清除历史遗留的 localStorage 缓存（之前可能写入了 hoc3.lioneapps.com）。
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

let _officialOrigin: string | null = null;

export function setOfficialOrigin(_url: string | null) {
  // 测试环境：不接受任何"正式域名"写入。
  _officialOrigin = null;
  try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export function getOfficialOrigin(): string | null {
  return null;
}

/** 测试环境下不再从 DB 读取正式域名，直接 no-op。 */
export async function loadOfficialOrigin(): Promise<string | null> {
  return null;
}

export function getPublicOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return normalize(window.location.origin);
  }
  return SSR_FALLBACK_ORIGIN;
}

/** 当前 window 是否处于开发域（保留导出以兼容已引用此函数的组件）。 */
export function isCurrentWindowDev(): boolean {
  if (typeof window === "undefined") return false;
  return isDevOrigin(window.location.origin);
}
