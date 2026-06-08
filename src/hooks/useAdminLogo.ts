import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ADMIN_LOGO_DEFAULTS = {
  admin_logo_title_zh: "基督三家事工中心",
  admin_logo_title_en: "The Home of Christ Church III",
  admin_logo_version: "Version 2.0",
} as const;

export type AdminLogo = typeof ADMIN_LOGO_DEFAULTS;

const KEYS = Object.keys(ADMIN_LOGO_DEFAULTS) as (keyof AdminLogo)[];
const EVENT = "admin-logo-updated";

export function emitAdminLogoUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function useAdminLogo(): AdminLogo {
  const [logo, setLogo] = useState<AdminLogo>(ADMIN_LOGO_DEFAULTS);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("app_settings")
      .select("key,value")
      .in("key", KEYS);
    if (!data) return;
    const next = { ...ADMIN_LOGO_DEFAULTS } as AdminLogo;
    for (const row of data as Array<{ key: string; value: string | null }>) {
      if ((KEYS as string[]).includes(row.key) && row.value) {
        (next as any)[row.key] = row.value;
      }
    }
    setLogo(next);
  }, []);

  useEffect(() => {
    load();
    if (typeof window === "undefined") return;
    const handler = () => load();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [load]);

  return logo;
}
