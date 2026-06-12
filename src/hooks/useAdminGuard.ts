import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 统一管理员路由守卫。
 *
 * 解决问题：部分后台模块在挂载时直接调用 supabase.auth.getSession()，
 * 如果 supabase 客户端尚未从 localStorage 恢复 session，会立即被判定为未登录
 * 并跳转 /login，造成「已经登录但进入子模块又要重新登录」。
 *
 * 本 hook 的做法：
 * 1. 订阅 onAuthStateChange，等到 INITIAL_SESSION / SIGNED_IN 才下结论；
 * 2. 同时 await getSession() 兜底（Supabase v2 内部会等待 storage 恢复完成）；
 * 3. 仅在确认没有 session 时才返回 'unauthenticated'。
 *
 * 全站后台模块必须复用同一份 supabase 实例（@/integrations/supabase/client），
 * 不要在模块内重新 createClient——否则不会共享 localStorage session。
 */
export type AdminGuardStatus =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; userId: string }
  | { kind: "authorized"; userId: string };

export function useAdminGuard(): AdminGuardStatus {
  const [status, setStatus] = useState<AdminGuardStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let resolved = false;

    async function evaluate(userId: string | null) {
      if (cancelled) return;
      if (!userId) {
        resolved = true;
        setStatus({ kind: "unauthenticated" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (cancelled) return;
      const ok = (roles ?? []).some(
        (r: { role: string }) => r.role === "super_admin" || r.role === "admin",
      );
      resolved = true;
      setStatus(ok ? { kind: "authorized", userId } : { kind: "forbidden", userId });
    }

    // 1. onAuthStateChange 会在客户端完成 storage 恢复后首先发出 INITIAL_SESSION。
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void evaluate(session?.user?.id ?? null);
      } else if (event === "SIGNED_OUT") {
        resolved = true;
        if (!cancelled) setStatus({ kind: "unauthenticated" });
      }
    });

    // 2. 兜底：直接读一次当前 session（Supabase v2 内部已 await storage 恢复）。
    void supabase.auth.getSession().then(({ data }) => {
      if (resolved || cancelled) return;
      void evaluate(data.session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return status;
}
