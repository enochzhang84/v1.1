import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { checkSuperAdminExists, initializeCurrentUserAsSuperAdmin } from "@/lib/bootstrap-admin.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "login" | "register";

function LoginPage() {
  const doHasSuper = useServerFn(checkSuperAdminExists);
  const doInitSuper = useServerFn(initializeCurrentUserAsSuperAdmin);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState<"unknown" | "strict" | "bootstrap">("unknown");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/admin");
    });
    doHasSuper()
      .then((s) => setBootstrapMode(s.hasAnyRoles ? "strict" : "bootstrap"))
      .catch(() => setBootstrapMode("strict"));
  }, [doHasSuper]);

  function friendlyError(msg: string): string {
    if (/invalid login credentials/i.test(msg)) return "邮箱或密码不正确。";
    if (/email not confirmed/i.test(msg)) return "邮箱尚未验证，请查收验证邮件。";
    if (/rate limit|too many|frequen/i.test(msg)) return "操作过于频繁，请稍后再试。";
    if (/network|fetch/i.test(msg)) return "无法连接到后台服务，请检查网络。";
    if (/user already registered|already exists/i.test(msg)) return "该邮箱已注册，请直接登录。";
    if (/password.*(short|weak|least|6)/i.test(msg)) return "密码强度不足，至少 6 位。";
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast.error("密码至少 6 位。");
      return;
    }
    if (password !== password2) {
      toast.error("两次输入的密码不一致。");
      return;
    }
    // 再次确认 user_roles 是否为空
    setLoading(true);
    try {
      const s = await doHasSuper();
      if (s.hasAnyRoles) {
        setBootstrapMode("strict");
        setLoading(false);
        toast.error("系统已有管理员，请联系超级管理员开通账号。");
        return;
      }
    } catch {
      setLoading(false);
      toast.error("无法确认系统初始化状态，请稍后重试。");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setLoading(false);
      toast.error(friendlyError(error.message));
      return;
    }

    // 若已有 session（项目关闭了邮箱确认），立即初始化为 super_admin
    if (data.session) {
      try {
        await doInitSuper();
        toast.success("注册成功，已设为首位超级管理员。");
        setTimeout(() => window.location.assign("/admin"), 500);
        return;
      } catch (e: any) {
        setLoading(false);
        toast.error(`初始化失败：${e?.message || e}`);
        return;
      }
    }

    // 需要邮箱验证
    setLoading(false);
    toast.success("注册邮件已发送，请在邮箱中点击验证链接后回到本页登录。");
    setMode("login");
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("请先填写邮箱。");
      return;
    }
    setLoading(true);
    const { getPublicOrigin } = await import("@/lib/public-origin");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getPublicOrigin()}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success("重置密码邮件已发送，请查收。");
  }

  const isBootstrap = bootstrapMode === "bootstrap";
  const canRegister = isBootstrap;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground tracking-tight">
            {mode === "login" ? "管理员登录" : "注册管理员账号"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "login"
              ? "请输入管理员账号和密码登录"
              : isBootstrap
                ? "系统尚未初始化，注册即成为首位超级管理员"
                : "请联系超级管理员开通账号"}
          </p>
        </div>

        {mode === "login" ? (
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
              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                注册管理员账号
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-primary hover:underline disabled:text-muted-foreground"
                disabled={loading}
              >
                忘记密码
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleRegister}
            className="bg-white/90 backdrop-blur rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)] border border-white"
          >
            {!canRegister && bootstrapMode !== "unknown" && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                系统已存在管理员账户。新管理员只能由现有超级管理员在后台开通，
                此处不允许自助注册。
              </div>
            )}
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="h-12 rounded-xl"
                autoComplete="email"
                disabled={!canRegister}
              />
            </div>
            <div className="space-y-2">
              <Label>密码（至少 6 位）</Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="设置一个密码"
                className="h-12 rounded-xl"
                autoComplete="new-password"
                disabled={!canRegister}
              />
            </div>
            <div className="space-y-2">
              <Label>确认密码</Label>
              <Input
                type="password"
                required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="再次输入密码"
                className="h-12 rounded-xl"
                autoComplete="new-password"
                disabled={!canRegister}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !canRegister || !email || !password || !password2}
              className="w-full rounded-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              size="lg"
            >
              {loading ? "注册中..." : "注册并成为超级管理员"}
            </Button>
            <div className="text-center text-sm pt-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                ← 返回登录
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 LioneApps · Version 2.0
        </p>
      </div>
    </div>
  );
}
