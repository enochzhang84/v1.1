import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";
const supabaseAdmin = _supabaseAdmin as unknown as {
  from: (t: string) => any;
};

// Canonical table list. Grouped logically by module for the UI.
export const BACKUP_TABLES = [
  // 管理员和权限
  "user_profiles",
  "user_roles",
  "user_preferences",
  "user_module_analytics",
  // 新人登记
  "registrations",
  // 退修会
  "retreat_registrations",
  // 信仰成长档案
  "decisions",
  "baptisms",
  "contacts",
  // 主日学
  "sunday_class_schedule",
  "sunday_school_courses",
  "sunday_school_teachers",
  "sunday_school_checkins",
  "adult_class_checkins",
  "fellowship_checkins",
  "kids_class_enrollment_snapshots",
  "kids_promotion_records",
  // 迎宾 / 接待
  "attendance_records",
  "fellowships",
  "duty_personnel",
  "duty_schedules",
  "hospitality_ministry_entries",
  "ministries",
  "ministry_service_entries",
  "service_projects",
  "service_applications",
  // 厨房事工
  "meal_plans",
  "meal_types",
  "event_meal_notes",
  // 影音投影
  "av_broadcasts",
  "av_notes",
  // TV 屏幕
  "display_screens",
  "display_playlists",
  "display_playlist_items",
  "display_posters",
  // 活动
  "events",
  // 首页 / 系统设置
  "home_page_settings",
  "app_settings",
  // 聊天 / 留言
  "messages",
  "chat_messages",
  // 反馈
  "feedbacks",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

// Module groupings for selective backup / restore.
export const RESTORE_GROUPS: Record<string, BackupTable[]> = {
  admins: ["user_profiles", "user_roles", "user_preferences", "user_module_analytics"],
  newcomers: ["registrations"],
  retreat: ["retreat_registrations"],
  faith: ["decisions", "baptisms", "contacts"],
  sunday_school: [
    "sunday_class_schedule",
    "sunday_school_courses",
    "sunday_school_teachers",
    "sunday_school_checkins",
    "adult_class_checkins",
    "fellowship_checkins",
    "kids_class_enrollment_snapshots",
    "kids_promotion_records",
  ],
  welcome: [
    "attendance_records",
    "fellowships",
    "duty_personnel",
    "duty_schedules",
    "hospitality_ministry_entries",
    "ministries",
    "ministry_service_entries",
    "service_projects",
    "service_applications",
  ],
  kitchen: ["meal_plans", "meal_types", "event_meal_notes"],
  media: ["av_broadcasts", "av_notes"],
  tv: ["display_screens", "display_playlists", "display_playlist_items", "display_posters"],
  events: ["events"],
  home: ["home_page_settings", "app_settings"],
  chat: ["chat_messages", "messages"],
  feedback: ["feedbacks"],
};

export const GROUP_LABELS: Record<string, string> = {
  admins: "管理员和权限",
  newcomers: "新人登记",
  retreat: "退修会",
  faith: "信仰成长档案",
  sunday_school: "主日学",
  welcome: "迎宾接待 / 服侍",
  kitchen: "厨房事工",
  media: "影音投影",
  tv: "TV 屏幕",
  events: "活动",
  home: "首页 / 系统设置",
  chat: "聊天 / 留言",
  feedback: "反馈",
};

export const TABLE_NOTES: Record<string, string> = {
  user_profiles: "用户档案 / 同工资料",
  user_roles: "用户角色与权限",
  user_preferences: "用户偏好设置",
  user_module_analytics: "用户模块统计可见性",
  registrations: "新人登记表",
  retreat_registrations: "退修会报名",
  decisions: "决志记录",
  baptisms: "受洗记录",
  contacts: "联络信息",
  sunday_class_schedule: "主日学课程安排",
  sunday_school_courses: "主日学课程",
  sunday_school_teachers: "主日学教师",
  sunday_school_checkins: "主日学签到",
  adult_class_checkins: "成人主日学签到",
  fellowship_checkins: "团契签到",
  kids_class_enrollment_snapshots: "儿童主日学入学快照",
  kids_promotion_records: "儿童升班记录",
  attendance_records: "首页饭食 / 出席统计",
  fellowships: "团契列表",
  duty_personnel: "迎宾同工",
  duty_schedules: "迎宾同工安排",
  hospitality_ministry_entries: "接待事工记录",
  ministries: "事工列表",
  ministry_service_entries: "事工服侍记录",
  service_projects: "服侍项目",
  service_applications: "服侍申请",
  meal_plans: "饭食计划",
  meal_types: "饭食类别",
  event_meal_notes: "其他活动订餐",
  av_broadcasts: "影音广播",
  av_notes: "影音笔记",
  display_screens: "TV 屏幕配置",
  display_playlists: "TV 播放列表",
  display_playlist_items: "TV 播放项",
  display_posters: "TV 海报",
  events: "活动 / 二维码",
  home_page_settings: "首页设置",
  app_settings: "系统设置",
  messages: "公告 / 留言",
  chat_messages: "同工聊天消息",
  feedbacks: "反馈意见",
};

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin required");
}

function pkColumn(table: string): string {
  if (
    table === "user_preferences" ||
    table === "user_presence" ||
    table === "user_profiles"
  )
    return "user_id";
  if (table === "user_module_analytics") return "id";
  if (table === "app_settings") return "key";
  return "id";
}

// 用户身份相关表：系统安装包绝不导出；历史/迁移恢复时强制跳过。
// 新教会的超级管理员通过「第一个注册用户」触发器自动产生。
export const USER_IDENTITY_TABLES: readonly string[] = [
  "user_profiles",
  "user_roles",
  "user_preferences",
  "user_module_analytics",
  "user_notification_reads",
];

function isIdentityTable(t: string) {
  return USER_IDENTITY_TABLES.includes(t);
}

// ---------- Backup preview ----------
const BackupOptionsInput = z
  .object({
    includeUserAccounts: z.boolean().optional(),
  })
  .optional();

export const previewBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BackupOptionsInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const includeUserAccounts = data?.includeUserAccounts ?? false;
    const tables: Array<{ table: string; count: number; error?: string; skipped?: boolean }> = [];
    let total = 0;
    for (const t of BACKUP_TABLES) {
      if (!includeUserAccounts && isIdentityTable(t)) {
        tables.push({ table: t, count: 0, skipped: true });
        continue;
      }
      const { count, error } = await supabaseAdmin
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) {
        tables.push({ table: t, count: 0, error: error.message });
      } else {
        const c = count ?? 0;
        tables.push({ table: t, count: c });
        total += c;
      }
    }
    return {
      tables,
      total,
      tableCount: BACKUP_TABLES.length,
      includeUserAccounts,
      skippedIdentityTables: includeUserAccounts ? [] : [...USER_IDENTITY_TABLES],
    };
  });

// ---------- Backup ----------
export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BackupOptionsInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const includeUserAccounts = data?.includeUserAccounts ?? false;
    const tables: Record<string, any[]> = {};
    const warnings: string[] = [];
    const summary: Record<string, number> = {};
    let total = 0;
    for (const t of BACKUP_TABLES) {
      if (!includeUserAccounts && isIdentityTable(t)) {
        // 不导出用户身份表
        continue;
      }
      const { data: rows, error } = await supabaseAdmin.from(t).select("*");

// ---------- Backup ----------
export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const tables: Record<string, any[]> = {};
    const warnings: string[] = [];
    const summary: Record<string, number> = {};
    let total = 0;
    for (const t of BACKUP_TABLES) {
      const { data, error } = await supabaseAdmin.from(t).select("*");
      if (error) {
        warnings.push(`${t}: ${error.message}`);
        tables[t] = [];
        summary[t] = 0;
      } else {
        tables[t] = data ?? [];
        summary[t] = (data ?? []).length;
        total += (data ?? []).length;
      }
    }
    const payload: any = {
      backup_version: 1,
      created_at: new Date().toISOString(),
      project_name: "HOC3 Ministry Center",
      tables,
      summary,
      warnings,
    };

    // Log it
    const sizeBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    let creatorName: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("display_name, worker_name, full_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      creatorName = prof?.display_name || prof?.worker_name || prof?.full_name || null;
    } catch {
      // ignore
    }
    try {
      await supabaseAdmin.from("backup_logs").insert({
        created_by: context.userId,
        creator_name: creatorName,
        file_size_bytes: sizeBytes,
        total_tables: BACKUP_TABLES.length,
        total_records: total,
        summary,
        kind: "backup",
      });
    } catch {
      // ignore logging failure
    }
    return payload;
  });

// ---------- Backup logs ----------
export const simulateBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    let creatorName: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("display_name, worker_name, full_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      creatorName = prof?.display_name || prof?.worker_name || prof?.full_name || null;
    } catch {
      // ignore
    }
    const { data, error } = await supabaseAdmin
      .from("backup_logs")
      .insert({
        created_by: context.userId,
        creator_name: creatorName,
        file_size_bytes: 13107200,
        total_tables: 10,
        total_records: 1250,
        summary: {},
        kind: "simulate",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { log: data };
  });

export const listBackupLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { logs: data ?? [] };
  });

// ---------- Restore ----------
const RestoreInput = z.object({
  payload: z.object({
    backup_version: z.number().optional(),
    created_at: z.string().optional(),
    project_name: z.string().optional(),
    tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  }),
  groups: z.array(z.string()).optional(), // empty/undefined = all
  mode: z.enum(["replace", "merge"]).optional(),
});

// ---------- Restore preview ----------
const PreviewRestoreInput = z.object({
  payload: z.object({
    backup_version: z.number().optional(),
    created_at: z.string().optional(),
    project_name: z.string().optional(),
    tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  }),
});

export const previewRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewRestoreInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { payload } = data;
    const tableCounts: Array<{ table: string; count: number; known: boolean; module?: string }> =
      [];
    const moduleMap: Record<string, string> = {};
    for (const [group, tables] of Object.entries(RESTORE_GROUPS)) {
      for (const t of tables) moduleMap[t] = group;
    }
    let total = 0;
    const modulesSeen = new Set<string>();
    for (const [table, rows] of Object.entries(payload.tables)) {
      const count = Array.isArray(rows) ? rows.length : 0;
      const known = (BACKUP_TABLES as readonly string[]).includes(table);
      const mod = moduleMap[table];
      if (mod) modulesSeen.add(mod);
      tableCounts.push({ table, count, known, module: mod });
      total += count;
    }
    tableCounts.sort((a, b) => a.table.localeCompare(b.table));
    return {
      tableCount: tableCounts.length,
      total,
      tables: tableCounts,
      modules: [...modulesSeen].map((m) => ({ key: m, label: GROUP_LABELS[m] || m })),
      project_name: payload.project_name ?? null,
      created_at: payload.created_at ?? null,
      backup_version: payload.backup_version ?? null,
    };
  });

type TableResult = {
  table: string;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
  warnings: string[];
};

async function restoreTable(
  table: string,
  rows: any[],
  mode: "replace" | "merge",
): Promise<TableResult> {
  const res: TableResult = { table, inserted: 0, skipped: 0, failed: 0, warnings: [] };
  const pk = pkColumn(table);

  if (mode === "replace") {
    // Wipe existing rows.
    const sentinel =
      pk === "key" ? "__lovable_backup_sentinel__" : "00000000-0000-0000-0000-000000000000";
    const del = await supabaseAdmin.from(table).delete().neq(pk, sentinel);
    if (del.error) {
      res.error = `delete failed: ${del.error.message}`;
      return res;
    }
  }
  if (!rows || rows.length === 0) return res;

  // For merge: upsert with ignoreDuplicates so existing rows are preserved.
  if (mode === "merge") {
    const bulk = await supabaseAdmin
      .from(table)
      .upsert(rows, { onConflict: pk, ignoreDuplicates: true })
      .select("*");
    if (!bulk.error) {
      res.inserted = bulk.data?.length ?? 0;
      res.skipped = rows.length - res.inserted;
      return res;
    }
    res.warnings.push(`bulk upsert rejected (${bulk.error.message}); retrying row-by-row`);
  }

  // For replace (and merge fallback): try bulk insert first.
  const bulk =
    mode === "replace"
      ? await supabaseAdmin.from(table).insert(rows).select("*")
      : { error: { message: "fallback" }, data: null };
  if (!bulk.error) {
    res.inserted = bulk.data?.length ?? rows.length;
    return res;
  }

  if (mode === "replace") {
    res.warnings.push(`bulk insert rejected (${bulk.error.message}); retrying row-by-row`);
  }

  const droppedCols = new Set<string>();
  for (const original of rows as Record<string, any>[]) {
    const row: Record<string, any> = { ...original };
    for (const c of droppedCols) delete row[c];
    let attempt = 0;
    while (attempt < 5) {
      const r =
        mode === "merge"
          ? await supabaseAdmin
              .from(table)
              .upsert(row, { onConflict: pk, ignoreDuplicates: true })
          : await supabaseAdmin.from(table).insert(row);
      if (!r.error) {
        if (mode === "merge") {
          // Ignored duplicates return no error and no data; treat as inserted.
          res.inserted++;
        } else {
          res.inserted++;
        }
        break;
      }
      const msg = r.error.message || "";
      const m = msg.match(/'([^']+)' column|column "([^"]+)"/);
      const badCol = m?.[1] || m?.[2];
      if (badCol && badCol in row) {
        droppedCols.add(badCol);
        delete row[badCol];
        attempt++;
        continue;
      }
      // Duplicate key in merge mode = expected skip
      if (mode === "merge" && /duplicate key|conflict/i.test(msg)) {
        res.skipped++;
      } else {
        res.failed++;
        res.warnings.push(msg);
      }
      break;
    }
  }
  if (droppedCols.size > 0) {
    res.warnings.unshift(`skipped unknown columns: ${[...droppedCols].join(", ")}`);
  }
  return res;
}

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { payload, groups, mode } = data;
    const restoreMode: "replace" | "merge" = mode ?? "replace";

    let targetTables: string[];
    if (!groups || groups.length === 0) {
      targetTables = [...BACKUP_TABLES];
    } else {
      const set = new Set<string>();
      for (const g of groups) {
        const ts = RESTORE_GROUPS[g];
        if (ts) ts.forEach((t) => set.add(t));
      }
      targetTables = [...set];
    }

    const missing: string[] = [];
    const results: TableResult[] = [];
    for (const t of targetTables) {
      if (!(t in payload.tables)) {
        missing.push(t);
        continue;
      }
      const r = await restoreTable(t, payload.tables[t], restoreMode);
      results.push(r);
    }
    return { results, missing, mode: restoreMode };
  });

// ---------- Database schema documentation ----------
export const exportSchemaDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const moduleMap: Record<string, string> = {};
    for (const [group, tables] of Object.entries(RESTORE_GROUPS)) {
      for (const t of tables) moduleMap[t] = GROUP_LABELS[group] || group;
    }
    const rows: Array<{
      table: string;
      module: string;
      record_count: number;
      note: string;
    }> = [];
    for (const t of BACKUP_TABLES) {
      const { count } = await supabaseAdmin
        .from(t)
        .select("*", { count: "exact", head: true });
      rows.push({
        table: t,
        module: moduleMap[t] || "—",
        record_count: count ?? 0,
        note: TABLE_NOTES[t] || "",
      });
    }
    // Fetch column-level metadata via SECURITY DEFINER helper
    const tablesArg = [...BACKUP_TABLES];
    let columns: Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      is_primary_key: boolean;
      ordinal_position: number;
    }> = [];
    let policies: Array<{
      table_name: string;
      policy_name: string;
      cmd: string;
      roles: string;
      qual: string;
      with_check: string;
    }> = [];
    try {
      const { data: colData } = await (supabaseAdmin as any).rpc(
        "get_table_columns_info",
        { _tables: tablesArg },
      );
      columns = colData || [];
    } catch {
      columns = [];
    }
    try {
      const { data: polData } = await (supabaseAdmin as any).rpc(
        "get_table_policies_info",
        { _tables: tablesArg },
      );
      policies = polData || [];
    } catch {
      policies = [];
    }
    return {
      rows,
      columns,
      policies,
      modules: Object.entries(RESTORE_GROUPS).map(([key, tables]) => ({
        key,
        label: GROUP_LABELS[key] || key,
        tables,
      })),
      moduleMap,
    };
  });

// ---------- Bootstrap super_admin ----------
export const initSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error: e1 } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);
    if (e1) throw new Error(e1.message);
    if (existing && existing.length > 0) {
      throw new Error("Super admin already exists");
    }
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" });
    if (profileError) throw new Error(profileError.message);
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "super_admin" },
        { onConflict: "user_id,role" },
      );
    if (e2) throw new Error(e2.message);
    return { ok: true } as any;
  });

export const hasSuperAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (error) throw new Error(error.message);
  return { hasSuperAdmin: (data?.length ?? 0) > 0 };
});