import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HomeVisualEditor } from "@/components/admin/HomeVisualEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/home-editor")({
  component: HomeEditorPage,
});

function HomeEditorPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { setState("denied"); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .in("role", ["super_admin", "admin"]);
      setState(data && data.length > 0 ? "ok" : "denied");
    })();
  }, []);

  if (state === "checking") return <div className="p-12 text-center text-muted-foreground">校验权限中…</div>;
  if (state === "denied") return (
    <div className="p-12 text-center space-y-4">
      <p className="text-lg">仅管理员可访问主页可视化编辑。</p>
      <Button onClick={() => navigate({ to: "/login" })}>去登录</Button>
    </div>
  );

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
