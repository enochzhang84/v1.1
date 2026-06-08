// HOC3 一键导出部署文件
// 仅 super_admin 可调用。生成 4 个 SQL/配置 文件 + 1 个 README，
// 客户端再用 JSZip 打包下载。不导出任何用户隐私数据。
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";
import { BACKUP_TABLES } from "@/lib/backup.functions";

const supabaseAdmin = _supabaseAdmin as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: any) => any;
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

// 默认配置/字典类表 —— 可以导出种子数据
const SEED_TABLES = [
  "app_settings",
  "home_page_settings",
  "display_screens",
  "display_playlists",
  "display_playlist_items",
  "display_posters",
  "fellowships",
  "service_projects",
  "ministries",
  "sunday_school_courses",
  "meal_types",
  "events",
  "qr_categories",
  "qr_library",
] as const;

// 公开扫码相关：anon 允许 INSERT 的表
const ANON_INSERT_TABLES = [
  "registrations",
  "retreat_registrations",
  "fellowship_checkins",
  "adult_class_checkins",
  "sunday_school_checkins",
  "service_applications",
  "feedbacks",
  "messages",
  "chat_messages",
];

// 公开扫码相关：anon 允许 SELECT 公开字段的配置表
const ANON_SELECT_TABLES = [
  "fellowships",
  "service_projects",
  "events",
  "sunday_school_courses",
  "home_page_settings",
  "display_screens",
  "display_playlists",
  "display_playlist_items",
  "display_posters",
];

function pgType(dataType: string): string {
  // information_schema.data_type → 可用于 CREATE TABLE 的类型
  const t = (dataType || "").toLowerCase();
  if (t === "character varying") return "text";
  if (t === "character") return "text";
  if (t === "timestamp with time zone") return "timestamptz";
  if (t === "timestamp without time zone") return "timestamp";
  if (t === "time with time zone") return "timetz";
  if (t === "time without time zone") return "time";
  if (t === "double precision") return "double precision";
  if (t === "user-defined") return "text"; // 枚举降级；正式部署请走 supabase db dump
  if (t === "array") return "text[]";
  return t || "text";
}

function quoteLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

export const exportDeployPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    const tablesArg = [...BACKUP_TABLES];

    // ===== 读取当前版本号（用于 version.json） =====
    let systemVersion = "v2.0.0";
    let databaseVersion = "v1.0.0";
    try {
      const { data: vers } = await supabaseAdmin
        .from("app_settings")
        .select("key,value")
        .in("key", ["system_version", "database_version"]);
      for (const r of (vers || []) as Array<{ key: string; value: string }>) {
        if (r.key === "system_version" && r.value) systemVersion = r.value;
        if (r.key === "database_version" && r.value) databaseVersion = r.value;
      }
    } catch {
      /* ignore */
    }

    // 拉结构
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
      const { data } = await supabaseAdmin.rpc("get_table_columns_info", {
        _tables: tablesArg,
      });
      columns = data || [];
    } catch {
      /* ignore */
    }
    try {
      const { data } = await supabaseAdmin.rpc("get_table_policies_info", {
        _tables: tablesArg,
      });
      policies = data || [];
    } catch {
      /* ignore */
    }

    // ========== 1. hoc3_database_init_v1.sql ==========
    const lines: string[] = [];
    lines.push("-- HOC3 数据库结构初始化");
    lines.push("-- 仅包含表结构、主键、RLS 启用与基础 GRANTS / Policy");
    lines.push("-- 不包含外键、索引、触发器、自定义函数的完整版本");
    lines.push("-- 如需完整结构，请在源数据库执行: supabase db dump --schema public");
    lines.push("");
    lines.push("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    lines.push("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    lines.push("");
    lines.push("-- ===== 角色枚举 =====");
    lines.push("DO $$ BEGIN");
    lines.push("  CREATE TYPE public.app_role AS ENUM ('super_admin','admin','worker','viewer');");
    lines.push("EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    lines.push("");

    // 按表分组
    const byTable = new Map<string, typeof columns>();
    for (const c of columns) {
      const arr = byTable.get(c.table_name) || [];
      arr.push(c);
      byTable.set(c.table_name, arr);
    }

    for (const table of tablesArg) {
      const cols = (byTable.get(table) || []).sort(
        (a, b) => a.ordinal_position - b.ordinal_position,
      );
      if (!cols.length) {
        lines.push(`-- (skip ${table}: no column metadata)`);
        continue;
      }
      lines.push(`-- ===== ${table} =====`);
      lines.push(`CREATE TABLE IF NOT EXISTS public.${table} (`);
      const colDefs = cols.map((c) => {
        const nullable = c.is_nullable === "NO" ? " NOT NULL" : "";
        const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
        return `  ${c.column_name} ${pgType(c.data_type)}${def}${nullable}`;
      });
      const pks = cols.filter((c) => c.is_primary_key).map((c) => c.column_name);
      if (pks.length) {
        colDefs.push(`  PRIMARY KEY (${pks.join(", ")})`);
      }
      lines.push(colDefs.join(",\n"));
      lines.push(");");
      lines.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      lines.push(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated;`,
      );
      lines.push(`GRANT ALL ON public.${table} TO service_role;`);
      lines.push("");
    }

    // 重建 policies（来自当前库）
    lines.push("-- ===== Row Level Security Policies =====");
    for (const p of policies) {
      const polName = p.policy_name.replace(/"/g, '""');
      lines.push(
        `DROP POLICY IF EXISTS "${polName}" ON public.${p.table_name};`,
      );
      const cmd = (p.cmd || "ALL").toUpperCase();
      const roles = (p.roles || "public").trim() || "public";
      const using = p.qual ? ` USING (${p.qual})` : "";
      const wcheck = p.with_check ? ` WITH CHECK (${p.with_check})` : "";
      lines.push(
        `CREATE POLICY "${polName}" ON public.${p.table_name} FOR ${cmd} TO ${roles}${using}${wcheck};`,
      );
    }
    const databaseInitSql = lines.join("\n") + "\n";

    // ========== 2. hoc3_seed_data_v1.sql ==========
    const seedLines: string[] = [];
    seedLines.push("-- HOC3 默认种子数据");
    seedLines.push("-- 仅包含系统设置 / 主页 / 屏幕 / 团契 / 课程等基础配置");
    seedLines.push("-- 不包含任何用户隐私数据（新人登记 / 报名 / 签到 / 聊天 等）");
    seedLines.push("-- 全部使用 INSERT ... ON CONFLICT DO NOTHING，可重复执行");
    seedLines.push("");
    for (const table of SEED_TABLES) {
      const cols = (byTable.get(table) || []).sort(
        (a, b) => a.ordinal_position - b.ordinal_position,
      );
      if (!cols.length) continue;
      const { data: rows } = await supabaseAdmin
        .from(table)
        .select("*")
        .limit(1000);
      const list = (rows || []) as Array<Record<string, unknown>>;
      if (!list.length) continue;
      seedLines.push(`-- ${table}: ${list.length} 行`);
      const colNames = cols.map((c) => c.column_name);
      const pks = cols.filter((c) => c.is_primary_key).map((c) => c.column_name);
      const conflict = pks.length ? pks.join(", ") : colNames[0];
      for (const row of list) {
        const values = colNames.map((cn) => quoteLiteral(row[cn]));
        seedLines.push(
          `INSERT INTO public.${table} (${colNames.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT (${conflict}) DO NOTHING;`,
        );
      }
      seedLines.push("");
    }
    const seedSql = seedLines.join("\n") + "\n";

    // ========== 3. hoc3_rls_dev_open.sql ==========
    const rlsLines: string[] = [];
    rlsLines.push("-- HOC3 RLS 开发/测试阶段快速开放");
    rlsLines.push("-- ⚠ 仅用于开发环境。正式上线请使用 hoc3_rls_production_secure.sql");
    rlsLines.push("-- 幂等：使用 DROP POLICY IF EXISTS + CREATE POLICY");
    rlsLines.push("-- 不关闭 RLS，不允许 anon 读取隐私名单");
    rlsLines.push("");
    rlsLines.push("-- 通用 helper（如不存在则创建）");
    rlsLines.push(`CREATE OR REPLACE FUNCTION public.is_admin_or_above(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('super_admin','admin'))
$$;`);
    rlsLines.push("");
    for (const t of tablesArg) {
      rlsLines.push(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      rlsLines.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO authenticated;`);
      rlsLines.push(`GRANT ALL ON public.${t} TO service_role;`);
      rlsLines.push(`DROP POLICY IF EXISTS "dev_authenticated_all_${t}" ON public.${t};`);
      rlsLines.push(
        `CREATE POLICY "dev_authenticated_all_${t}" ON public.${t} FOR ALL TO authenticated USING (true) WITH CHECK (true);`,
      );
      rlsLines.push("");
    }
    rlsLines.push("-- 公开扫码：允许 anon INSERT");
    for (const t of ANON_INSERT_TABLES) {
      rlsLines.push(`GRANT INSERT ON public.${t} TO anon;`);
      rlsLines.push(`DROP POLICY IF EXISTS "dev_anon_insert_${t}" ON public.${t};`);
      rlsLines.push(
        `CREATE POLICY "dev_anon_insert_${t}" ON public.${t} FOR INSERT TO anon WITH CHECK (true);`,
      );
    }
    rlsLines.push("");
    rlsLines.push("-- 公开扫码：允许 anon SELECT 公开配置（不含隐私名单）");
    for (const t of ANON_SELECT_TABLES) {
      rlsLines.push(`GRANT SELECT ON public.${t} TO anon;`);
      rlsLines.push(`DROP POLICY IF EXISTS "dev_anon_select_${t}" ON public.${t};`);
      rlsLines.push(
        `CREATE POLICY "dev_anon_select_${t}" ON public.${t} FOR SELECT TO anon USING (true);`,
      );
    }
    rlsLines.push("");
    rlsLines.push("-- 显式收回：禁止 anon 读取隐私名单");
    const PRIVATE_TABLES = [
      "registrations",
      "retreat_registrations",
      "fellowship_checkins",
      "adult_class_checkins",
      "sunday_school_checkins",
      "service_applications",
      "feedbacks",
      "decisions",
      "baptisms",
      "contacts",
      "messages",
      "chat_messages",
      "user_profiles",
      "user_roles",
    ];
    for (const t of PRIVATE_TABLES) {
      rlsLines.push(`REVOKE SELECT ON public.${t} FROM anon;`);
    }
    const rlsDevSql = rlsLines.join("\n") + "\n";

    // ========== 4. .env.example ==========
    const envExample = `# HOC3 部署环境变量模板
# 复制为 .env 后填入 Supabase 项目实际值

# ===== Supabase 公开配置（浏览器可见） =====
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key

# ===== 服务端运行时（SSR / server functions），与上面同值 =====
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key

# ===== 仅服务端使用，绝不暴露到前端 =====
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ===== 站点信息 =====
VITE_SITE_URL=https://your-domain.com
VITE_APP_NAME=HOC3
VITE_APP_ENV=production
VITE_BUILD_COMMIT=
VITE_BUILD_TIME=

# ===== 可选：Lovable AI Gateway（如果使用 AI 功能） =====
# LOVABLE_API_KEY=

# ===== 可选：公开数据查看 Token =====
# PUBLIC_VIEW_TOKEN=
`;

    // ========== 5. README_DEPLOY.md ==========
    const readme = `# HOC3 部署说明

> 本压缩包仅生成部署文件，不会自动修改 Supabase、不会自动执行 SQL、不会自动 git pull。

## 包含文件

| 文件 | 用途 |
| --- | --- |
| hoc3_database_init_v1.sql | 数据库结构（CREATE TABLE / RLS 启用 / 基础 Policy） |
| hoc3_seed_data_v1.sql     | 默认配置数据（系统设置 / 主页 / 屏幕 / 团契 / 课程） |
| hoc3_rls_dev_open.sql     | 开发阶段 RLS 快速开放（authenticated 全权限 + anon 公开扫码） |
| .env.example              | VPS 环境变量模板 |

## 部署顺序

1. 在 Supabase 新建一个项目
2. 在 Supabase SQL Editor 执行 \`hoc3_database_init_v1.sql\`
3. 在 Supabase SQL Editor 执行 \`hoc3_seed_data_v1.sql\`
4. 在 Supabase SQL Editor 执行 \`hoc3_rls_dev_open.sql\`
5. 在 VPS 上配置 \`.env\`（基于 .env.example）
6. \`git pull\`
7. \`npm install\`（或 \`bun install\`）
8. \`npm run build\`
9. \`pm2 restart hoc3\`

## 注意

- 本包不含任何用户隐私数据（新人登记 / 报名 / 签到 / 聊天 / 电话 / 微信 / 邮箱）。
- \`hoc3_rls_dev_open.sql\` 仅适合开发/测试环境。正式上线请改用更严格的 RLS。
- 如需完整 schema（含外键、索引、触发器、函数），请在源数据库执行：
  \`supabase db dump --schema public > full_schema.sql\`
- 第一个登录的账号将自动成为超级管理员（由 handle_new_user 触发器处理）。
`;

    return {
      files: {
        "hoc3_database_init_v1.sql": databaseInitSql,
        "hoc3_seed_data_v1.sql": seedSql,
        "hoc3_rls_dev_open.sql": rlsDevSql,
        ".env.example": envExample,
        "README_DEPLOY.md": readme,
      },
      generatedAt: new Date().toISOString(),
    };
  });
