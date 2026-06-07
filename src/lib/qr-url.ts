/**
 * Helpers for building scan-time QR URLs that always follow the *current*
 * site domain — never the hard-coded Lovable preview origin.
 *
 * Old uploaded QR images bake in `hoc3newcomer.lovable.app`, which sends
 * scans to the wrong database after deploys. All QR display sites should
 * generate codes dynamically from these helpers.
 */

const LEGACY_LOVABLE_HOST = "hoc3newcomer.lovable.app";

/** SSR / build fallback when `window` is not available. */
const SSR_FALLBACK_ORIGIN = "https://hoc3.lioneapps.com";

export function getCurrentOrigin(): string {
  if (typeof window === "undefined") return SSR_FALLBACK_ORIGIN;
  return window.location.origin;
}

export function buildRegisterUrl(eventToken?: string | null): string {
  const base = getCurrentOrigin();
  return eventToken ? `${base}/register?event=${eventToken}` : `${base}/register`;
}

export function buildRetreatRegisterUrl(): string {
  return `${getCurrentOrigin()}/retreat-register`;
}

export function isLegacyLovableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return new RegExp(LEGACY_LOVABLE_HOST, "i").test(url);
}

export type UrlValidation = { ok: true } | { ok: false; error: string };

/** Validate an admin-supplied newcomer-register URL. */
export function validateRegisterUrl(url: string): UrlValidation {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "请填写完整 URL。" };
  if (!/^https?:\/\//i.test(trimmed))
    return { ok: false, error: "URL 必须以 http:// 或 https:// 开头。" };
  if (isLegacyLovableUrl(trimmed))
    return {
      ok: false,
      error: `检测到旧的 Lovable 地址（${LEGACY_LOVABLE_HOST}）。请改为当前正式域名，例如 https://hoc3.lioneapps.com/register。`,
    };
  if (!/\/register(\?|#|$)/i.test(trimmed))
    return { ok: false, error: "新人登记 URL 必须包含 /register 路径。" };
  return { ok: true };
}

/** Validate an admin-supplied retreat-register URL. */
export function validateRetreatUrl(url: string): UrlValidation {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "请填写完整 URL。" };
  if (!/^https?:\/\//i.test(trimmed))
    return { ok: false, error: "URL 必须以 http:// 或 https:// 开头。" };
  if (isLegacyLovableUrl(trimmed))
    return {
      ok: false,
      error: `检测到旧的 Lovable 地址（${LEGACY_LOVABLE_HOST}）。请改为当前正式域名。`,
    };
  if (!/\/retreat-register(\?|#|$)/i.test(trimmed))
    return { ok: false, error: "退修会 URL 必须包含 /retreat-register 路径。" };
  return { ok: true };
}

export const QR_LEGACY_NOTICE =
  "建议使用系统自动生成的二维码。上传的二维码图片可能包含旧域名（如 hoc3newcomer.lovable.app），迁移网站或更换域名后会失效，并可能写入错误数据库。";