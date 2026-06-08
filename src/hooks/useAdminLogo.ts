import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminLogo = {
  admin_logo_title_zh: string;
  admin_logo_title_en: string;
  admin_logo_version: string;
};

export const ADMIN_LOGO_DEFAULTS: AdminLogo = {
  admin_logo_title_zh: "基督三家事工中心",
  admin_logo_title_en: "The Home of Christ Church III",
  admin_logo_version: "Version 2.0",
};

const TEXT_KEYS = Object.keys(ADMIN_LOGO_DEFAULTS) as (keyof AdminLogo)[];
// system_version 由「系统升级」流程维护，作为版本号的权威来源
const ALL_KEYS = [...TEXT_KEYS, "system_version"];
const EVENT = "admin-logo-updated";

export function emitAdminLogoUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function formatVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // 已经带 Version 前缀就原样返回
  if (/^version\b/i.test(t)) return t;
  // v1.2.3 / V1.2 → Version 1.2.3
  const cleaned = t.replace(/^v/i, "");
  return `Version ${cleaned}`;
}

export function useAdminLogo(): AdminLogo {
  const [logo, setLogo] = useState<AdminLogo>(ADMIN_LOGO_DEFAULTS);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("app_settings")
      .select("key,value")
      .in("key", ALL_KEYS);
    if (!data) return;
    const next = { ...ADMIN_LOGO_DEFAULTS } as AdminLogo;
    let systemVer: string | null = null;
    let savedVer: string | null = null;
    for (const row of data as Array<{ key: string; value: string | null }>) {
      if (row.key === "admin_logo_version") {
        savedVer = row.value ?? null;
        continue;
      }
      if ((TEXT_KEYS as string[]).includes(row.key) && row.value) {
        (next as any)[row.key] = row.value;
      }
      if (row.key === "system_version") systemVer = row.value ?? null;
    }
    // 优先使用用户在「后台设置」中保存的版本号；
    // 没有自定义时再回退到升级包写入的 system_version；
    // 都没有时使用默认值。
    if (savedVer && savedVer.trim()) {
      next.admin_logo_version = savedVer.trim();
    } else {
      const sv = formatVersion(systemVer);
      if (sv) next.admin_logo_version = sv;
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
