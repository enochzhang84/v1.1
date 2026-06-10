// Returns the public origin used for QR codes / share links.
//
// Rule (per product requirement):
//   QR codes MUST point to the SAME deployment the admin is currently using.
//   We use window.location.origin directly so each copy's QR code resolves
//   back to that copy's own registration page, regardless of what domain
//   it is hosted on (custom domain, *.lovable.app, preview, etc.).
//
// We only substitute a fallback during SSR (no window) — never to rewrite
// a live browser origin. This prevents the old behaviour where every
// deployment's QR code was hard-coded to https://lioneapps.com even
// when that domain pointed at a different project.
export const SSR_FALLBACK_ORIGIN = "https://lioneapps.com";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return SSR_FALLBACK_ORIGIN;
  return window.location.origin;
}
