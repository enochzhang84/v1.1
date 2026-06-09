import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 统一的引导/启动状态检查。
 *
 * - hasAnyRoles：user_roles 表是否存在任何记录。决定登录页是否允许「首次自动创建账号」。
 * - hasSuperAdmin：是否已有 super_admin。决定 /admin 是否需要恢复首位超级管理员。
 *
 * 核心原则（母本规范，确保所有副本一致）：
 *  - 空 user_roles → 允许首位登录用户初始化为 super_admin（仅此场景下）。
 *  - 已有任何 user_roles → 必须走标准管理员登录验证，禁止自动创建。
 */
export const checkSuperAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  const totalRoles = count ?? 0;

  const { data: superRows, error: superErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (superErr) throw new Error(superErr.message);

  return {
    hasSuperAdmin: (superRows?.length ?? 0) > 0,
    hasAnyRoles: totalRoles > 0,
    rolesCount: totalRoles,
  };
});

export const initializeCurrentUserAsSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 严格条件：仅当 user_roles 完全为空时才允许自动初始化首位超级管理员。
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("系统已存在管理员账户，禁止自动初始化。请联系现有管理员授权。");
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "super_admin" },
        { onConflict: "user_id,role" },
      );
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });
