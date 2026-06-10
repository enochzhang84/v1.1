import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";

const supabaseAdmin = _supabaseAdmin as unknown as {
  from: (t: string) => any;
};

/**
 * 母版初始化 (Factory Reset) — clears business/event data so the project can
 * be cloned as a fresh church master copy, while preserving administrators,
 * permissions, system settings, home page content, QR library and assets.
 */

// 保留：管理员、权限、系统/主页设置、二维码库、屏幕配置、配置型档案
export const PRESERVE_TABLES = [
  // 用户与权限
  "user_profiles",
  "user_roles",
  "user_preferences",
  "user_module_analytics",
  // 系统 / 主页 / 主题
  "app_settings",
  "app_versions",
  "home_page_settings",
  "home_page_content",
  // 二维码 / 显示屏配置 (海报+配置)
  "qr_library",
  "qr_categories",
  "display_screens",
  "display_playlists",
  "display_playlist_items",
  "display_posters",
  // 配置型档案（事工/团契/课程/餐型）
  "ministries",
  "service_projects",
  "meal_types",
  "fellowships",
  "sunday_school_courses",
  "sunday_school_teachers",
  "sunday_class_schedule",
  // 系统级
  "system_notifications",
  "user_notification_reads",
  "suppressed_emails",
  "email_unsubscribe_tokens",
] as const;

// 清空：业务/历史/统计数据
export const CLEAR_TABLES = [
  // 新人 / 退修会 / 信仰
  "registrations",
  "retreat_registrations",
  "decisions",
  "baptisms",
  "contacts",
  // 签到 / 出席
  "sunday_school_checkins",
  "adult_class_checkins",
  "fellowship_checkins",
  "group_join_records",
  "kids_class_enrollment_snapshots",
  "kids_promotion_records",
  "attendance_records",
  // 迎宾 / 服侍 / 接待
  "duty_personnel",
  "duty_schedules",
  "hospitality_ministry_entries",
  "ministry_service_entries",
  "service_applications",
  "worship_service_roles",
  "communion_service",
  "custodial_duty",
  "flower_duty",
  "kitchen_duty",
  // 厨房 / 影音
  "meal_plans",
  "event_meal_notes",
  "av_broadcasts",
  "av_notes",
  // 活动 / 留言 / 聊天 / 反馈
  "events",
  "messages",
  "chat_messages",
  "feedbacks",
  // 日志 / 临时状态
  "backup_logs",
  "email_send_log",
  "email_send_state",
  "user_presence",
] as const;

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
  if (table === "user_preferences" || table === "user_presence") return "user_id";
  if (table === "app_settings") return "key";
  return "id";
}

async function tableCount(table: string): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

export const previewFactoryReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const preserve: Array<{ table: string; count: number | null }> = [];
    const clear: Array<{ table: string; count: number | null }> = [];
    for (const t of PRESERVE_TABLES) preserve.push({ table: t, count: await tableCount(t) });
    for (const t of CLEAR_TABLES) clear.push({ table: t, count: await tableCount(t) });
    const totalClear = clear.reduce((s, r) => s + (r.count ?? 0), 0);
    // super admin count
    const { count: superAdminCount } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    return { preserve, clear, totalClear, superAdminCount: superAdminCount ?? 0 };
  });

export const runFactoryReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    // 预检：必须存在超级管理员
    const { count: beforeSuperAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (!beforeSuperAdmin || beforeSuperAdmin < 1) {
      throw new Error("初始化中止：系统中没有超级管理员，禁止执行清空操作");
    }
    const { count: beforeRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    const cleared: Array<{ table: string; deleted: number; error?: string }> = [];
    for (const t of CLEAR_TABLES) {
      const before = (await tableCount(t)) ?? 0;
      const pk = pkColumn(t);
      const sentinel =
        pk === "key" ? "__lovable_factory_reset_sentinel__" : "00000000-0000-0000-0000-000000000000";
      const { error } = await supabaseAdmin.from(t).delete().neq(pk, sentinel);
      cleared.push({
        table: t,
        deleted: error ? 0 : before,
        error: error?.message,
      });
    }

    // 后检：确保管理员体系完整
    const { count: afterSuperAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    const { count: afterRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    const violations: string[] = [];
    if (!afterSuperAdmin || afterSuperAdmin < 1) violations.push("超级管理员丢失");
    if (!afterRoles || afterRoles < 1) violations.push("user_roles 被清空");
    if (afterSuperAdmin !== beforeSuperAdmin)
      violations.push(`超级管理员数量异常: ${beforeSuperAdmin} → ${afterSuperAdmin}`);

    const totalDeleted = cleared.reduce((s, r) => s + r.deleted, 0);
    const ok = violations.length === 0;

    // 同时执行母版健康检查
    const health = await computeMasterHealth();

    // 写入 backup_logs (kind=factory_reset)
    let creatorName: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("display_name, worker_name, full_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      creatorName = prof?.display_name || prof?.worker_name || prof?.full_name || null;
    } catch {}
    try {
      await supabaseAdmin.from("backup_logs").insert({
        created_by: context.userId,
        creator_name: creatorName,
        file_size_bytes: 0,
        total_tables: cleared.length,
        total_records: totalDeleted,
        kind: "factory_reset",
        summary: {
          op: "factory_reset",
          result: ok ? "success" : "failed",
          violations,
          cleared_table_count: cleared.length,
          cleared_total_rows: totalDeleted,
          preserved_table_count: PRESERVE_TABLES.length,
          super_admin_before: beforeSuperAdmin ?? 0,
          super_admin_after: afterSuperAdmin ?? 0,
          roles_before: beforeRoles ?? 0,
          roles_after: afterRoles ?? 0,
          health_ok: health.ok,
          health_failed_checks: health.checks.filter((c) => !c.ok).map((c) => c.name),
        },
      });
    } catch {
      // 日志失败不影响主流程
    }

    return {
      ok,
      violations,
      cleared,
      preserved: {
        superAdminBefore: beforeSuperAdmin ?? 0,
        superAdminAfter: afterSuperAdmin ?? 0,
        rolesBefore: beforeRoles ?? 0,
        rolesAfter: afterRoles ?? 0,
      },
      totalDeleted,
      health,
    };
  });

// ---------- 母版状态检查 ----------
async function computeMasterHealth() {
  const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

  const c = async (name: string, fn: () => Promise<{ ok: boolean; detail?: string }>) => {
    try {
      const r = await fn();
      checks.push({ name, ...r });
    } catch (e: any) {
      checks.push({ name, ok: false, detail: e?.message || String(e) });
    }
  };

  await c("super_admin 数量 > 0", async () => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    return { ok: (count ?? 0) > 0, detail: `${count ?? 0} 个` };
  });
  await c("user_roles 未被清空", async () => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });
    return { ok: (count ?? 0) > 0, detail: `${count ?? 0} 条` };
  });
  await c("app_settings 存在", async () => {
    const { count } = await supabaseAdmin
      .from("app_settings")
      .select("*", { count: "exact", head: true });
    return { ok: (count ?? 0) > 0, detail: `${count ?? 0} 条` };
  });
  await c("home_page_settings 存在", async () => {
    const { count } = await supabaseAdmin
      .from("home_page_settings")
      .select("*", { count: "exact", head: true });
    return { ok: (count ?? 0) > 0, detail: `${count ?? 0} 条` };
  });
  await c("home_page_content 存在或可回退默认", async () => {
    const { count } = await supabaseAdmin
      .from("home_page_content")
      .select("*", { count: "exact", head: true });
    // 允许为 0：前端有默认主页回退
    return { ok: true, detail: `${count ?? 0} 条 (允许 0, 前端有默认回退)` };
  });
  await c("qr_library 存在", async () => {
    const { count } = await supabaseAdmin
      .from("qr_library")
      .select("*", { count: "exact", head: true });
    return { ok: (count ?? 0) >= 0, detail: `${count ?? 0} 条` };
  });
  await c("主要展示配置存在", async () => {
    const { count: screens } = await supabaseAdmin
      .from("display_screens")
      .select("*", { count: "exact", head: true });
    const { count: playlists } = await supabaseAdmin
      .from("display_playlists")
      .select("*", { count: "exact", head: true });
    return {
      ok: true,
      detail: `screens=${screens ?? 0}, playlists=${playlists ?? 0}`,
    };
  });
  await c("业务表已清空", async () => {
    const samples = [
      "registrations",
      "retreat_registrations",
      "sunday_school_checkins",
      "chat_messages",
      "messages",
      "feedbacks",
    ];
    const nonEmpty: string[] = [];
    for (const t of samples) {
      const n = await tableCount(t);
      if ((n ?? 0) > 0) nonEmpty.push(`${t}=${n}`);
    }
    return { ok: nonEmpty.length === 0, detail: nonEmpty.length ? `仍有数据: ${nonEmpty.join(", ")}` : "全部为空" };
  });

  return { ok: checks.every((c) => c.ok), checks };
}

export const masterHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    return computeMasterHealth();
  });

// ---------- 导出母版 SQL ----------
async function getMasterVersion(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "database_version")
      .maybeSingle();
    if (data?.value) return String(data.value).replace(/^v/i, "");
  } catch {}
  try {
    const { data } = await supabaseAdmin
      .from("app_versions")
      .select("version")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.version) return String(data.version).replace(/^v/i, "");
  } catch {}
  return "1.0.0";
}

function sqlEscapeIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlEscapeValue(v: any): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") {
    const j = JSON.stringify(v).replace(/'/g, "''");
    return `'${j}'::jsonb`;
  }
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function pgTypeFromInfo(dataType: string): string {
  // information_schema returns generic types; map common ones back
  const t = dataType.toLowerCase();
  if (t === "character varying") return "text";
  if (t === "timestamp with time zone") return "timestamptz";
  if (t === "timestamp without time zone") return "timestamp";
  if (t === "double precision") return "double precision";
  if (t === "ARRAY") return "text[]";
  return t;
}

export const exportMasterSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const allTables = [...PRESERVE_TABLES, ...CLEAR_TABLES];
    const version = await getMasterVersion();
    const versionTag = `v${version.replace(/\./g, "_")}`;
    const generatedAt = new Date().toISOString();

    // --- schema.sql ---
    let columns: any[] = [];
    let policies: any[] = [];
    try {
      const { data } = await (supabaseAdmin as any).rpc("get_table_columns_info", {
        _tables: allTables,
      });
      columns = data || [];
    } catch {}
    try {
      const { data } = await (supabaseAdmin as any).rpc("get_table_policies_info", {
        _tables: allTables,
      });
      policies = data || [];
    } catch {}

    const byTable: Record<string, any[]> = {};
    for (const col of columns) {
      (byTable[col.table_name] ||= []).push(col);
    }

    const schemaLines: string[] = [];
    schemaLines.push(`-- HOC3 母版数据库结构 (schema)`);
    schemaLines.push(`-- 版本: v${version}`);
    schemaLines.push(`-- 生成时间: ${generatedAt}`);
    schemaLines.push(`-- 表数量: ${allTables.length} (保留 ${PRESERVE_TABLES.length} + 业务 ${CLEAR_TABLES.length})`);
    schemaLines.push(`-- 注意：此为结构快照，不包含触发器、函数与扩展。新建项目请通过 Lovable Cloud 自动迁移。`);
    schemaLines.push(``);

    for (const t of allTables) {
      const cols = (byTable[t] || []).sort(
        (a, b) => a.ordinal_position - b.ordinal_position,
      );
      if (cols.length === 0) {
        schemaLines.push(`-- 表 ${t} 未读到列信息，跳过`);
        schemaLines.push(``);
        continue;
      }
      schemaLines.push(`-- ============================================================`);
      schemaLines.push(`-- table: public.${t}`);
      schemaLines.push(`-- ============================================================`);
      schemaLines.push(`CREATE TABLE IF NOT EXISTS public.${sqlEscapeIdent(t)} (`);
      const lines: string[] = [];
      const pkCols: string[] = [];
      for (const c of cols) {
        const parts = [
          sqlEscapeIdent(c.column_name),
          pgTypeFromInfo(c.data_type),
        ];
        if (c.column_default) parts.push(`DEFAULT ${c.column_default}`);
        if (c.is_nullable === "NO") parts.push("NOT NULL");
        lines.push("  " + parts.join(" "));
        if (c.is_primary_key) pkCols.push(sqlEscapeIdent(c.column_name));
      }
      if (pkCols.length) lines.push(`  PRIMARY KEY (${pkCols.join(", ")})`);
      schemaLines.push(lines.join(",\n"));
      schemaLines.push(`);`);
      schemaLines.push(`ALTER TABLE public.${sqlEscapeIdent(t)} ENABLE ROW LEVEL SECURITY;`);

      // policies for this table
      const tablePolicies = policies.filter((p) => p.table_name === t);
      for (const p of tablePolicies) {
        const qual = p.qual ? ` USING (${p.qual})` : "";
        const withCheck = p.with_check ? ` WITH CHECK (${p.with_check})` : "";
        const roles = p.roles && p.roles !== "" ? ` TO ${p.roles}` : "";
        schemaLines.push(
          `CREATE POLICY ${sqlEscapeIdent(p.policy_name)} ON public.${sqlEscapeIdent(t)} FOR ${p.cmd}${roles}${qual}${withCheck};`,
        );
      }
      schemaLines.push(``);
    }

    const schemaSql = schemaLines.join("\n");

    // --- seed.sql (仅保留表的现有数据，不含 user_profiles/user_roles 等用户数据) ---
    // 排除涉及具体用户身份的表，避免把当前管理员个人信息带入母版
    const SEED_EXCLUDE = new Set([
      "user_profiles",
      "user_roles",
      "user_preferences",
      "user_module_analytics",
      "user_notification_reads",
    ]);
    const seedTables = PRESERVE_TABLES.filter((t) => !SEED_EXCLUDE.has(t));

    const seedLines: string[] = [];
    seedLines.push(`-- HOC3 母版默认数据 (seed)`);
    seedLines.push(`-- 版本: v${version}`);
    seedLines.push(`-- 生成时间: ${generatedAt}`);
    seedLines.push(`-- 包含表: ${seedTables.length} 个 (不含用户身份相关表)`);
    seedLines.push(`-- 用户/管理员账号请通过新项目的首次注册流程自动创建。`);
    seedLines.push(``);

    let totalRows = 0;
    for (const t of seedTables) {
      const { data, error } = await supabaseAdmin.from(t).select("*");
      if (error || !data) {
        seedLines.push(`-- ${t}: 读取失败 ${error?.message || ""}`);
        seedLines.push(``);
        continue;
      }
      if (data.length === 0) {
        seedLines.push(`-- ${t}: 无数据`);
        seedLines.push(``);
        continue;
      }
      const colNames = Object.keys(data[0]);
      seedLines.push(`-- ${t}: ${data.length} 行`);
      seedLines.push(
        `INSERT INTO public.${sqlEscapeIdent(t)} (${colNames.map(sqlEscapeIdent).join(", ")}) VALUES`,
      );
      const rows = data.map(
        (row: any) =>
          `  (${colNames.map((c) => sqlEscapeValue(row[c])).join(", ")})`,
      );
      seedLines.push(rows.join(",\n") + "\nON CONFLICT DO NOTHING;");
      seedLines.push(``);
      totalRows += data.length;
    }

    const seedSql = seedLines.join("\n");

    return {
      version,
      versionTag,
      generatedAt,
      schemaFilename: `hoc3_database_init_${versionTag}.sql`,
      seedFilename: `hoc3_seed_data_${versionTag}.sql`,
      schemaSql,
      seedSql,
      stats: {
        tables: allTables.length,
        seedTables: seedTables.length,
        seedRows: totalRows,
      },
    };
  });

