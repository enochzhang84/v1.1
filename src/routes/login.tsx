import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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

/**
 * 管理员登录页（母本统一实现）
 *
 * 关键规范：
 *  - 进入页面先查询 user_roles 状态：
 *      hasAnyRoles=true  → 严格管理员登录模式
 *                          · 文案：「请输入管理员邮箱登录」「仅已授权管理员可以进入系统」
 *                          · 不显示「首次登录自动创建账号」
 *                          · OTP 使用 shouldCreateUser: false，禁止隐式注册
 *      hasAnyRoles=false → 首次系统初始化模式（仅在 user_roles 完全为空时）
 *                          · 允许自动创建账号并提升为首位 super_admin
 *  - 登录成功后：
 *      · 是管理员（super_admin / admin / worker） → 进入 /admin
 *      · 非管理员 → 立即 signOut 并提示「无管理员权限」，停留在登录页
 *      · 绝不跳回首页，绝不卡在验证码页
 */
function LoginPage() {
  const doHasSuper = useServerFn(checkSuperAdminExists);
  const doInitSuper = useServerFn(initializeCurrentUserAsSuperAdmin);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState<"unknown" | "strict" | "bootstrap">("unknown");
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/admin");
    });
    // 加载引导状态，决定是「严格管理员登录」还是「首次系统初始化」
    doHasSuper()
      .then((s) => setBootstrapMode(s.hasAnyRoles ? "strict" : "bootstrap"))
      .catch(() => setBootstrapMode("strict")); // 失败时按严格模式处理，更安全
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [doHasSuper]);

  function startCooldown(sec = 60) {
    setCooldown(sec);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function friendlyError(msg: string): string {
    if (/rate limit|too many|frequen/i.test(msg)) return "发送过于频繁，请稍后再试。";
    if (/invalid|expired|otp/i.test(msg)) return "验证码错误或已过期，请重新获取。";
    if (/network|fetch/i.test(msg)) return "无法连接到后台服务，请检查网络。";
    if (/signups? (not allowed|disabled)|user not found|not exist/i.test(msg)) {
      return "该邮箱未被授权为管理员账户，请联系系统管理员。";
    }
    return msg;
  }

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return;
    // 再次确认引导状态（防止页面停留过久后状态变化）
    let allowCreate = false;
    try {
      const s = await doHasSuper();
      allowCreate = !s.hasAnyRoles;
      setBootstrapMode(allowCreate ? "bootstrap" : "strict");
    } catch {
      allowCreate = false;
      setBootstrapMode("strict");
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: allowCreate },
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success("验证码已发送，请查收邮箱（含垃圾箱）");
    setStep("code");
    startCooldown(60);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 4) {
      toast.error("请输入邮箱验证码");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      setLoading(false);
      toast.error(friendlyError(error.message));
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setLoading(false);
      toast.error("登录失败：未获取到会话，请重试。");
      return;
    }

    // 首次系统初始化：仅当 user_roles 完全为空时允许
    const status = await doHasSuper();
    if (!status.hasAnyRoles) {
      setNeedsFirstAdmin(true);
      toast.info("系统尚未初始化任何账户，请将当前邮箱设为首位超级管理员。");
      setLoading(false);
      return;
    }

    // 严格模式：必须已是管理员（super_admin / admin / worker）
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const roleList = (roles ?? []).map((r) => r.role) as string[];
    const isAdmin =
      roleList.includes("super_admin") ||
      roleList.includes("admin") ||
      roleList.includes("worker");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      setStep("email");
      setCode("");
      toast.error("无管理员权限：该账号未被授权进入后台，请联系超级管理员。");
      return;
    }
    toast.success("登录成功，正在进入管理后台...");
    setTimeout(() => window.location.assign("/admin"), 800);
  }

  async function handleInitFirstAdmin() {
    setLoading(true);
    try {
      await doInitSuper();
      toast.success("已设为首位超级管理员，正在进入后台...");
      window.location.assign("/admin");
    } catch (e: any) {
      toast.error(`初始化失败：${e?.message || e}`);
      setLoading(false);
    }
  }

  const isBootstrap = bootstrapMode === "bootstrap";

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">
            {isBootstrap ? "系统首次初始化" : "管理员登录"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {step === "email"
              ? isBootstrap
                ? "尚未初始化任何账户，首位登录用户将自动成为超级管理员。"
                : "请输入管理员邮箱登录"
              : `验证码已发送至 ${email}`}
          </p>
          {step === "email" && !isBootstrap && (
            <p className="text-xs text-muted-foreground mt-1">仅已授权管理员可以进入系统</p>
          )}
        </div>

        {step === "email" ? (
          <form
            onSubmit={handleSendCode}
            className="bg-white rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)]"
          >
            <div className="space-y-2">
              <Label>管理员邮箱</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="h-12 rounded-xl"
              />
            </div>
            <Button type="submit" disabled={loading || !email || bootstrapMode === "unknown"} className="w-full rounded-full h-12" size="lg">
              {loading ? "发送中..." : "发送验证码"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleVerify}
            className="bg-white rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)]"
          >
            {needsFirstAdmin && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-3">
                <p>系统尚未初始化任何账户，是否将当前用户设为首位超级管理员？</p>
                <Button type="button" size="sm" onClick={handleInitFirstAdmin} disabled={loading}>
                  初始化为首位超级管理员
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>6 位验证码</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-full h-12"
              size="lg"
            >
              {loading ? "验证中..." : "验证并登录"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setNeedsFirstAdmin(false);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ← 换个邮箱
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => handleSendCode()}
                className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `${cooldown}s 后可重发` : "重新发送验证码"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
