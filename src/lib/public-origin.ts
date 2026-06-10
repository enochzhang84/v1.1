// Public origin used for QR codes / share links.
//
// 关键规则：二维码绝不能使用 *.lovableproject.com（Lovable 编辑器沙箱域名），
// 微信等外部浏览器访问该域名会被强制跳转到 Lovable 登录页。
//
// 当前策略：
//   - 二维码统一使用「已发布站点域名」PUBLISHED_ORIGIN（公开访问，无需登录）
//   - 如果当前 window 已经在正式/发布域名上，则直接使用当前域名
//   - 仅当 window 处于 lovableproject.com / id-preview 等沙箱域时，
//     才强制替换为 PUBLISHED_ORIGIN

/** 已发布站点（Public / Anyone with URL），微信扫码可直接访问。 */
export const PUBLISHED_ORIGIN = "https://qr-newbie-flow.lovable.app";

export const SSR_FALLBACK_ORIGIN = PUBLISHED_ORIGIN;
const LS_KEY = "official_origin_v1";

// 沙箱/本地域名：扫码会进 Lovable 登录页，禁止用于二维码。
const SANDBOX_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /^id-preview--.*\.lovable\.app$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
  /^0\.0\.0\.0(:\d+)?$/i,
];

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** 是否是「扫码会进 Lovable 登录页」的开发/沙箱域名。
 *  注意：已发布的 *.lovable.app（如 qr-newbie-flow.lovable.app）是公开可访问的，
 *  不算开发域名。 */
export function isDevOrigin(originOrUrl: string): boolean {
  if (!originOrUrl) return false;
  try {
    const host = new URL(originOrUrl).host;
    return SANDBOX_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return SANDBOX_HOST_PATTERNS.some((re) => re.test(originOrUrl));
  }
}

// 清除历史遗留的 localStorage 缓存。
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

export function setOfficialOrigin(_url: string | null) {
  // 域名由 PUBLISHED_ORIGIN 统一管理，不接受运行时写入。
}

export function getOfficialOrigin(): string | null {
  return PUBLISHED_ORIGIN;
}

export async function loadOfficialOrigin(): Promise<string | null> {
  return PUBLISHED_ORIGIN;
}

/** 二维码 / 分享链接使用的对外域名。 */
export function getPublicOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const current = normalize(window.location.origin);
    // 沙箱域 → 强制使用已发布域名，避免微信扫码进 Lovable 登录页
    if (isDevOrigin(current)) return PUBLISHED_ORIGIN;
    return current;
  }
  return SSR_FALLBACK_ORIGIN;
}

/** 当前 window 是否处于开发/沙箱域（保留导出以兼容已引用此函数的组件）。 */
export function isCurrentWindowDev(): boolean {
  if (typeof window === "undefined") return false;
  return isDevOrigin(window.location.origin);
}
