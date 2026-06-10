import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [systemInitialized, setSystemInitialized] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        window.location.assign("/admin");
        return;
      }
      const { data: inited, error } = await supabase.rpc("is_system_initialized");
      if (!error) {
        setSystemInitialized(inited !== false);
      }
      setChecking(false);
    })();
  }, [navigate]);


  function friendlyError(msg: string): string {
    if (/invalid login credentials/i.test(msg)) return "邮箱或密码不正确。";
    if (/email not confirmed/i.test(msg)) return "邮箱尚未验证，请查收验证邮件。";
    if (/rate limit|too many|frequen/i.test(msg)) return "操作过于频繁，请稍后再试。";
    if (/network|fetch/i.test(msg)) return "无法连接到后台服务，请检查网络。";
    return msg;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setLoading(false);
      toast.error(friendlyError(error?.message || "登录失败"));
      return;
    }
    const uid = data.session.user.id;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roleList = (roles ?? []).map((r) => r.role) as string[];
    const isAdmin = roleList.includes("super_admin") || roleList.includes("admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("无管理员权限：该账号未被授权进入后台，请联系超级管理员。");
      return;
    }
    toast.success("登录成功，正在进入管理后台...");
    setTimeout(() => window.location.assign("/admin"), 500);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-muted-foreground">
        正在检查系统状态...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground tracking-tight">管理员登录</h1>
          <p className="text-muted-foreground text-sm mt-2">请输入管理员账号和密码登录</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white/90 backdrop-blur rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)] border border-white"
        >
          <div className="space-y-2">
            <Label>邮箱或用户名</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-12 rounded-xl"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="h-12 rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            size="lg"
          >
            {loading ? "登录中..." : "登录"}
          </Button>
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-muted-foreground">
              新管理员需由超级管理员开通
            </span>
            <Link to="/forgot-password" className="text-primary hover:underline">
              忘记密码
            </Link>
          </div>
          {!systemInitialized && (
            <div className="pt-4 mt-2 border-t border-gray-100 text-center space-y-2">
              <p className="text-sm text-muted-foreground">首次使用？开通系统并创建超级管理员</p>
              <Link
                to="/setup"
                className="inline-block w-full rounded-full h-12 leading-[3rem] bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium"
              >
                首次开通系统 / 注册超级管理员
              </Link>
            </div>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 LioneApps · Version 2.0
        </p>
      </div>
    </div>
  );
}
