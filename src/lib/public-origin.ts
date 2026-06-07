// Returns the stable public origin to use in QR codes / share links.
// On Lovable preview/sandbox hosts (which require a Lovable login), substitute
// the published host so WeChat / external scanners never hit an auth wall.
const PUBLISHED_ORIGIN = "https://qr-newbie-flow.lovable.app";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  const o = window.location.origin;
  const isPreviewHost =
    /id-preview--/.test(o) ||
    /lovableproject\.com$/.test(o) ||
    /sandbox\.lovable\.dev$/.test(o);
  return isPreviewHost ? PUBLISHED_ORIGIN : o;
}
