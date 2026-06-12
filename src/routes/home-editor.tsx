import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HomeVisualEditor } from "@/components/admin/HomeVisualEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useAdminGuard } from "@/hooks/useAdminGuard";

export const Route = createFileRoute("/home-editor")({
  component: HomeEditorPage,
});

type State =
  | { kind: "loading"; step: string }
  | { kind: "denied"; reason: string }
  | { kind: "error"; message: string }
  | { kind: "ok" };

function HomeEditorPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading", step: "校验登录态…" });

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setState((s) => s.kind === "loading" ? { kind: "error", message: "加载超时（10 秒）。请检查网络或刷新页面再试。" } : s);
      }
    }, 10000);

    (async () => {
      try {
        setState({ kind: "loading", step: "校验登录态…" });
        const { data: sessData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw new Error("读取登录态失败：" + sessErr.message);
        const uid = sessData.session?.user?.id;
        if (!uid) {
          if (!cancelled) setState({ kind: "denied", reason: "尚未登录。请先登录管理员账号。" });
          return;
        }

        setState({ kind: "loading", step: "校验管理员权限…" });
        const { data: roles, error: roleErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        if (roleErr) throw new Error("读取角色失败：" + roleErr.message);
        const isAdmin = (roles || []).some((r) => r.role === "super_admin" || r.role === "admin");
        if (!isAdmin) {
          if (!cancelled) setState({ kind: "denied", reason: "当前账号不是管理员（super_admin / admin），无法编辑主页。" });
          return;
        }

        if (!cancelled) setState({ kind: "ok" });
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: (e as Error).message || String(e) });
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">{state.step}</p>
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <p className="text-lg max-w-md">{state.reason}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>返回后台</Button>
          <Button onClick={() => navigate({ to: "/login" })}>去登录</Button>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">加载失败</p>
        <pre className="max-w-2xl whitespace-pre-wrap text-sm bg-muted p-3 rounded border text-left">{state.message}</pre>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>返回后台</Button>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b px-4 py-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/admin" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> 返回后台
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <HomeVisualEditor />
      </div>
    </div>
  );
}
