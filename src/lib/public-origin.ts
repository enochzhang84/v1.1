// Public origin used for QR codes / share links.
//
// 关键规则：二维码绝不能使用 *.lovableproject.com（Lovable 编辑器沙箱域名），
// 微信等外部浏览器访问该域名会被强制跳转到 Lovable 登录页。
//
// 优先级：
//   1. localStorage 缓存的「站点正式域名」(由 app_settings.auth_base_url 同步而来)
//   2. 当前 window.location.origin（如果不是沙箱/本地）
//   3. PUBLISHED_ORIGIN（最终兜底）
//
// 这样一来，更换正式域名 → 写入 auth_base_url → 缓存刷新 →
// 所有通过 getPublicOrigin() 生成的二维码自动指向新域名。

import { supabase } from "@/integrations/supabase/client";

/** 兜底：已发布的 lovable 域名（仅当 app_settings 未配置时使用）。 */
export const PUBLISHED_ORIGIN = "https://qr-newbie-flow.lovable.app";
export const SSR_FALLBACK_ORIGIN = PUBLISHED_ORIGIN;

const PREFERRED_LS_KEY = "qr_preferred_origin_v2";
const LEGACY_LS_KEY = "official_origin_v1";

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

export function isDevOrigin(originOrUrl: string): boolean {
  if (!originOrUrl) return false;
  try {
    const host = new URL(originOrUrl).host;
    return SANDBOX_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return SANDBOX_HOST_PATTERNS.some((re) => re.test(originOrUrl));
  }
}

// 清理历史遗留 key
if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
}

function readPreferred(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PREFERRED_LS_KEY);
    if (!v) return null;
    const n = normalize(v);
    if (!/^https?:\/\//i.test(n)) return null;
    if (isDevOrigin(n)) return null;
    return n;
  } catch {
    return null;
  }
}

/** 由设置页 / 初始化向导调用：写入正式域名供二维码使用。 */
export function setPreferredQrOrigin(url: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!url) {
      window.localStorage.removeItem(PREFERRED_LS_KEY);
      return;
    }
    const n = normalize(url);
    if (!/^https?:\/\//i.test(n) || isDevOrigin(n)) return;
    window.localStorage.setItem(PREFERRED_LS_KEY, n);
  } catch { /* ignore */ }
}

/** 兼容旧 API：返回缓存的正式域名。 */
export function getOfficialOrigin(): string | null {
  return readPreferred() ?? PUBLISHED_ORIGIN;
}

/** 兼容旧 API：曾经允许运行时写入，现统一通过 setPreferredQrOrigin。 */
export function setOfficialOrigin(url: string | null) {
  setPreferredQrOrigin(url);
}

/** 从 app_settings.auth_base_url 拉取并缓存到 localStorage。
 *  在 __root.tsx 启动时调用一次；setup 向导保存后也应调用。 */
export async function loadOfficialOrigin(): Promise<string | null> {
  try {
    const { data } = await supabase.rpc("get_public_app_settings");
    const rows = (data ?? []) as Array<{ key: string; value: string }>;
    const row = rows.find((r) => r.key === "auth_base_url");
    if (row?.value) {
      setPreferredQrOrigin(row.value);
      return readPreferred();
    }
  } catch { /* ignore */ }
  return readPreferred();
}

/** 二维码 / 分享链接使用的对外域名。 */
export function getPublicOrigin(): string {
  // 1. 显式配置的正式域名优先
  const preferred = readPreferred();
  if (preferred) return preferred;

  // 2. 当前 window 域名（非沙箱）
  if (typeof window !== "undefined" && window.location?.origin) {
    const current = normalize(window.location.origin);
    if (!isDevOrigin(current)) return current;
  }

  // 3. 兜底
  return PUBLISHED_ORIGIN;
}

export function isCurrentWindowDev(): boolean {
  if (typeof window === "undefined") return false;
  return isDevOrigin(window.location.origin);
}

/** 渲染前最后防线：把保存的链接里的沙箱域名替换为正式域名。 */
export function sanitizePublicUrl(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (isDevOrigin(u.origin)) {
      const target = getPublicOrigin();
      return `${target}${u.pathname}${u.search}${u.hash}`;
    }
    return raw;
  } catch {
    return raw;
  }
}
