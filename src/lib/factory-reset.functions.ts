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

    return {
      ok: violations.length === 0,
      violations,
      cleared,
      preserved: {
        superAdminBefore: beforeSuperAdmin ?? 0,
        superAdminAfter: afterSuperAdmin ?? 0,
        rolesBefore: beforeRoles ?? 0,
        rolesAfter: afterRoles ?? 0,
      },
      totalDeleted: cleared.reduce((s, r) => s + r.deleted, 0),
    };
  });
