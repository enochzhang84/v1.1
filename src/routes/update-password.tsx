// /update-password 是 Password Recovery 邮件按钮的目标地址。
// 与 /reset-password 共用同一个组件，确保新副本不会因为 Lovable 默认
// auth-bridge 拒绝跳转回旧路径而出现 Access denied。
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/update-password")({
  component: UpdatePasswordPage,
});

function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("密码至少 6 位");
    if (password !== confirm) return toast.error("两次输入的密码不一致");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("密码已更新,请重新登录");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">← 返回登录</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">设置新密码</h1>
          <p className="text-muted-foreground text-sm mt-2">请输入并确认您的新密码</p>
        </div>
        {!ready ? (
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-sm">
            正在验证重置链接...
            <p className="text-xs mt-3">如果长时间无响应,请回到登录页重新申请找回密码。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-8 space-y-4 shadow-sm">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
              {loading ? "更新中..." : "更新密码"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
