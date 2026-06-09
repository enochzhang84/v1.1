// Returns the stable public origin to use in QR codes / share links and
// in Supabase auth email redirect URLs. On Lovable preview/sandbox hosts
// (which require a Lovable login) or on the legacy lovable.app host we
// substitute the official production domain so emails never link to a
// preview/sandbox URL and external scanners never hit an auth wall.
export const PRODUCTION_ORIGIN = "https://lioneapps.com";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const o = window.location.origin;
  const isNonProdHost =
    /id-preview--/.test(o) ||
    /lovableproject\.com$/.test(o) ||
    /sandbox\.lovable\.dev$/.test(o) ||
    /\.lovable\.app$/.test(o) ||
    /localhost/.test(o) ||
    /127\.0\.0\.1/.test(o);
  return isNonProdHost ? PRODUCTION_ORIGIN : o;
}

