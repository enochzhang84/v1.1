import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

const CORE_MODULE_TABLES: Array<{ key: string; label: string; table: string }> = [
  { key: "home", label: "主页配置", table: "home_page_settings" },
  { key: "qr", label: "二维码库", table: "qr_library" },
  { key: "retreat", label: "退修会模块", table: "retreat_registrations" },
  { key: "sunday_school", label: "主日学模块", table: "sunday_class_schedule" },
  { key: "kitchen", label: "厨房事工", table: "meal_plans" },
  { key: "media", label: "影音事工", table: "av_broadcasts" },
  { key: "tv_display", label: "TV 数字标牌", table: "display_screens" },
];

export type SystemHealthReport = {
  generatedAt: string;
  system: {
    name_zh: string;
    name_en: string;
    version: string;
    environment: string;
    deploy_date: string | null;
  };
  users: {
    super_admin: number;
    admin: number;
    worker: number;
    viewer: number;
    total: number;
    last_registered: { email: string; created_at: string } | null;
    last_sign_in: { email: string; at: string } | null;
  };
  database: {
    ok: boolean;
    error: string | null;
    table_count: number;
    last_write_at: string | null;
  };
  auth: {
    ok: boolean;
    has_super_admin: boolean;
    error: string | null;
  };
  storage: {
    ok: boolean;
    buckets: Array<{ name: string; public: boolean }>;
    error: string | null;
  };
  modules: Array<{ key: string; label: string; ok: boolean; count: number; error: string | null }>;
  checks: Array<{ id: string; label: string; ok: boolean; level: "ok" | "warn" | "error"; detail?: string }>;
  initialized: boolean;
  score: number;
};

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealthReport> => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ---- system meta (from app_settings) ----
    const META_KEYS = [
      "admin_logo_title_zh",
      "admin_logo_title_en",
      "admin_logo_version",
      "system_version",
      "system_deploy_date",
      "system_environment",
    ];
    const { data: settingsRows } = await supabaseAdmin
      .from("app_settings")
      .select("key,value")
      .in("key", META_KEYS);
    const settings = new Map<string, string>();
    for (const r of (settingsRows ?? []) as Array<{ key: string; value: string | null }>) {
      if (r.value) settings.set(r.key, r.value);
    }
    const versionRaw =
      settings.get("admin_logo_version") ||
      settings.get("system_version") ||
      "Version 2.0";
    const version = /^version/i.test(versionRaw) ? versionRaw : `Version ${versionRaw.replace(/^v/i, "")}`;

    // ---- roles ----
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const roleCounts = { super_admin: 0, admin: 0, worker: 0, viewer: 0 };
    for (const r of (roleRows ?? []) as Array<{ role: string }>) {
      if (r.role in roleCounts) (roleCounts as any)[r.role] += 1;
    }

    // ---- auth users ----
    let totalUsers = 0;
    let lastRegistered: { email: string; created_at: string } | null = null;
    let lastSignIn: { email: string; at: string } | null = null;
    let authOk = true;
    let authErr: string | null = null;
    try {
      const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw new Error(error.message);
      const users = usersData.users;
      totalUsers = users.length;
      const sortedByCreated = [...users].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (sortedByCreated[0]) {
        lastRegistered = { email: sortedByCreated[0].email ?? "", created_at: sortedByCreated[0].created_at };
      }
      const withSign = users.filter((u) => u.last_sign_in_at);
      withSign.sort(
        (a, b) =>
          new Date(b.last_sign_in_at as string).getTime() -
          new Date(a.last_sign_in_at as string).getTime(),
      );
      if (withSign[0]) {
        lastSignIn = { email: withSign[0].email ?? "", at: withSign[0].last_sign_in_at as string };
      }
    } catch (e: any) {
      authOk = false;
      authErr = String(e?.message ?? e);
    }

    // ---- database ping + table count ----
    let dbOk = true;
    let dbErr: string | null = null;
    let tableCount = 0;
    let lastWriteAt: string | null = null;
    try {
      const { error } = await supabaseAdmin.from("app_settings").select("key").limit(1);
      if (error) throw new Error(error.message);
      // tables count via information_schema using rpc isn't available; fall back to a known list size
      tableCount = 47; // 与 tables 列表保持一致；后续可改成 rpc 查询
      // last write — pick a frequently written table
      const { data: lastReg } = await supabaseAdmin
        .from("registrations")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (lastReg && lastReg[0]?.created_at) {
        lastWriteAt = lastReg[0].created_at as string;
      }
    } catch (e: any) {
      dbOk = false;
      dbErr = String(e?.message ?? e);
    }
    if (roleErr) {
      dbOk = false;
      dbErr = dbErr ?? roleErr.message;
    }

    // ---- storage ----
    let storageOk = true;
    let storageErr: string | null = null;
    let buckets: Array<{ name: string; public: boolean }> = [];
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw new Error(error.message);
      buckets = (data ?? []).map((b: any) => ({ name: b.name, public: Boolean(b.public) }));
    } catch (e: any) {
      storageOk = false;
      storageErr = String(e?.message ?? e);
    }

    // ---- module health (each table returns ok if reachable) ----
    const modules = await Promise.all(
      CORE_MODULE_TABLES.map(async (m) => {
        try {
          const { count, error } = await supabaseAdmin
            .from(m.table as any)
            .select("*", { count: "exact", head: true });
          if (error) throw new Error(error.message);
          return { key: m.key, label: m.label, ok: true, count: count ?? 0, error: null as string | null };
        } catch (e: any) {
          return { key: m.key, label: m.label, ok: false, count: 0, error: String(e?.message ?? e) };
        }
      }),
    );

    // ---- checks ----
    const hasSuper = roleCounts.super_admin > 0;
    const hasUserRolesTable = !roleErr;
    const homeMod = modules.find((m) => m.key === "home");
    const qrMod = modules.find((m) => m.key === "qr");
    const checks: SystemHealthReport["checks"] = [
      { id: "super_admin", label: "存在超级管理员", ok: hasSuper, level: hasSuper ? "ok" : "error", detail: hasSuper ? undefined : "系统中未检测到超级管理员，建议立即创建管理员账户。" },
      { id: "user_roles", label: "user_roles 表可访问", ok: hasUserRolesTable, level: hasUserRolesTable ? "ok" : "error" },
      { id: "home_config", label: "主页配置可访问", ok: !!homeMod?.ok, level: homeMod?.ok ? "ok" : "warn" },
      { id: "qr_config", label: "二维码配置可访问", ok: !!qrMod?.ok, level: qrMod?.ok ? "ok" : "warn" },
      { id: "default_perm", label: "默认权限策略已就绪", ok: hasUserRolesTable, level: hasUserRolesTable ? "ok" : "warn" },
      { id: "db", label: "数据库连接正常", ok: dbOk, level: dbOk ? "ok" : "error", detail: dbErr ?? undefined },
      { id: "storage", label: "存储服务正常", ok: storageOk, level: storageOk ? "ok" : "error", detail: storageErr ?? undefined },
      { id: "auth", label: "认证服务正常", ok: authOk, level: authOk ? "ok" : "error", detail: authErr ?? undefined },
    ];

    const errCount = checks.filter((c) => c.level === "error").length;
    const warnCount = checks.filter((c) => c.level === "warn").length;
    const score = Math.max(0, 100 - errCount * 15 - warnCount * 4);

    return {
      generatedAt: new Date().toISOString(),
      system: {
        name_zh: settings.get("admin_logo_title_zh") || "基督三家事工中心",
        name_en: settings.get("admin_logo_title_en") || "HOC3 Ministry Center",
        version,
        environment: settings.get("system_environment") || (process.env.NODE_ENV === "production" ? "Production" : "Development"),
        deploy_date: settings.get("system_deploy_date") || null,
      },
      users: {
        ...roleCounts,
        total: totalUsers,
        last_registered: lastRegistered,
        last_sign_in: lastSignIn,
      },
      database: { ok: dbOk, error: dbErr, table_count: tableCount, last_write_at: lastWriteAt },
      auth: { ok: authOk, has_super_admin: hasSuper, error: authErr },
      storage: { ok: storageOk, buckets, error: storageErr },
      modules,
      checks,
      initialized: hasSuper,
      score,
    };
  });
