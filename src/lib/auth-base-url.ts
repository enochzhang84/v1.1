// 统一管理认证邮件的跳转域名。
// 优先从系统设置中的 auth_base_url 读取（首次开通向导写入）；
// 兜底回退到 getPublicOrigin()。
//
// 浏览器端使用：所有 resetPasswordForEmail / 注册验证邮件 redirectTo 都通过此函数获取。
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";

export interface PublicAppSettings {
  auth_base_url?: string;
  church_name_cn?: string;
  church_name_en?: string;
  church_email?: string;
  email_sender_name?: string;
  reply_to_email?: string;
  setup_completed?: string;
  [k: string]: string | undefined;
}

let cache: Promise<PublicAppSettings> | null = null;

export function clearPublicAppSettingsCache() {
  cache = null;
}

export async function getPublicAppSettings(): Promise<PublicAppSettings> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabase.rpc("get_public_app_settings");
      if (error || !data) return {};
      const out: PublicAppSettings = {};
      for (const row of data as Array<{ key: string; value: string }>) {
        out[row.key] = row.value;
      }
      return out;
    })();
  }
  return cache;
}

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function getAuthBaseUrl(): Promise<string> {
  try {
    const s = await getPublicAppSettings();
    if (s.auth_base_url && /^https?:\/\//i.test(s.auth_base_url)) {
      return normalize(s.auth_base_url);
    }
  } catch {
    /* fall through */
  }
  return normalize(getPublicOrigin());
}

export async function buildAuthUrl(path: string): Promise<string> {
  const base = await getAuthBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
