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

  const guard = useAdminGuard();

  useEffect(() => {
    if (guard.kind === "loading") {
      setState({ kind: "loading", step: "校验登录态…" });
      return;
    }
    if (guard.kind === "unauthenticated") {
      setState({ kind: "denied", reason: "尚未登录。请先登录管理员账号。" });
      return;
    }
    if (guard.kind === "forbidden") {
      setState({ kind: "denied", reason: "当前账号不是管理员（super_admin / admin），无法编辑主页。" });
      return;
    }
    setState({ kind: "ok" });
  }, [guard.kind]);

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
