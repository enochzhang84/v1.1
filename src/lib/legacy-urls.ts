// 旧域名自动扫描与一键替换。
// 用于：系统初始化向导完成后 / 副本环境复用后，
// 把数据库里残留的 lovableproject.com / id-preview / localhost / 旧教会域名
// 改写为当前系统域名（auth_base_url）。
//
// 使用同一个 supabase 客户端（已登录 super_admin 时可直接写）。
import { supabase } from "@/integrations/supabase/client";
import { isDevOrigin } from "@/lib/public-origin";

export type LegacyHit = {
  table: string;
  column: string;
  id: string;
  label: string;
  oldUrl: string;
  newUrl: string;
};

export type LegacyScanResult = {
  hits: LegacyHit[];
  total: number;
};

const TARGETS: Array<{
  table: "home_page_settings" | "qr_library" | "app_settings";
  columns: string[];
  labelCol?: string;
}> = [
  {
    table: "home_page_settings",
    columns: [
      "qr_newcomer_url",
      "qr_retreat_url",
      "primary_button_url",
      "secondary_button_url",
    ],
  },
  { table: "qr_library", columns: ["target_url"], labelCol: "name" },
];

const APP_SETTING_KEYS = ["auth_base_url"];

function normalizeOrigin(input: string): string {
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  } catch {
    return input.replace(/\/+$/, "");
  }
}

/** 把任意 URL 的 origin 改写为 targetOrigin，保留 path/search/hash。
 *  额外接受 extraLegacyHosts（如旧教会域名），命中则替换。
 *  没命中（域名正常）→ 返回 null。 */
function rewriteOrigin(
  url: string,
  targetOrigin: string,
  extraLegacyHosts: string[],
): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    const isLegacy =
      isDevOrigin(u.origin) ||
      extraLegacyHosts.some((h) => h && host === h.toLowerCase());
    if (!isLegacy) return null;
    const target = new URL(targetOrigin);
    return `${target.protocol}//${target.host}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/** 扫描数据库中的旧域名（不写入）。 */
export async function scanLegacyUrls(
  targetOrigin: string,
  extraLegacyHosts: string[] = [],
): Promise<LegacyScanResult> {
  const target = normalizeOrigin(targetOrigin);
  const hits: LegacyHit[] = [];

  for (const t of TARGETS) {
    const cols = ["id", ...t.columns, ...(t.labelCol ? [t.labelCol] : [])].join(",");
    const { data, error } = await (supabase as any).from(t.table).select(cols);
    if (error || !data) continue;
    for (const row of data as Array<Record<string, string | null>>) {
      for (const col of t.columns) {
        const val = row[col];
        if (!val) continue;
        const rewritten = rewriteOrigin(String(val), target, extraLegacyHosts);
        if (rewritten && rewritten !== val) {
          hits.push({
            table: t.table,
            column: col,
            id: String(row.id),
            label: t.labelCol ? String(row[t.labelCol] ?? "") : col,
            oldUrl: String(val),
            newUrl: rewritten,
          });
        }
      }
    }
  }

  // app_settings: key/value 行
  const { data: appData } = await (supabase as any)
    .from("app_settings")
    .select("key,value")
    .in("key", APP_SETTING_KEYS);
  for (const row of (appData ?? []) as Array<{ key: string; value: string | null }>) {
    if (!row.value) continue;
    const rewritten = rewriteOrigin(String(row.value), target, extraLegacyHosts);
    if (rewritten && rewritten !== row.value) {
      hits.push({
        table: "app_settings",
        column: "value",
        id: row.key,
        label: row.key,
        oldUrl: String(row.value),
        newUrl: rewritten,
      });
    }
  }

  return { hits, total: hits.length };
}

/** 一键替换。返回成功 / 失败数。需当前登录账号为 super_admin/admin。 */
export async function rewriteLegacyUrls(
  targetOrigin: string,
  extraLegacyHosts: string[] = [],
): Promise<{ updated: number; failed: number; hits: LegacyHit[]; errors: string[] }> {
  const scan = await scanLegacyUrls(targetOrigin, extraLegacyHosts);
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  // 按 table+id 聚合，单次 update 多列
  const grouped = new Map<string, { table: string; id: string; patch: Record<string, string> }>();
  for (const h of scan.hits) {
    const key = `${h.table}::${h.id}`;
    const g = grouped.get(key) ?? { table: h.table, id: h.id, patch: {} };
    g.patch[h.column] = h.newUrl;
    grouped.set(key, g);
  }

  for (const g of grouped.values()) {
    if (g.table === "app_settings") {
      // key/value 表：每个 key 单独 update
      const { error } = await (supabase as any)
        .from("app_settings")
        .update({ value: g.patch.value, updated_at: new Date().toISOString() })
        .eq("key", g.id);
      if (error) { failed++; errors.push(`app_settings(${g.id}): ${error.message}`); }
      else updated++;
    } else {
      const { error } = await (supabase as any)
        .from(g.table)
        .update(g.patch)
        .eq("id", g.id);
      if (error) { failed++; errors.push(`${g.table}(${g.id}): ${error.message}`); }
      else updated += Object.keys(g.patch).length;
    }
  }

  return { updated, failed, hits: scan.hits, errors };
}
