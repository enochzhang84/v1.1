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

function LoginPage() {
  const doHasSuper = useServerFn(checkSuperAdminExists);
  const doInitSuper = useServerFn(initializeCurrentUserAsSuperAdmin);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/admin");
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    return msg;
  }

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
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
    if (code.length !== 6) {
      toast.error("请输入 6 位验证码");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setLoading(false);
      toast.error(friendlyError(error.message));
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid) {
      const superStatus = await doHasSuper();
      if (!superStatus.hasSuperAdmin) {
        setNeedsFirstAdmin(true);
        toast.info("系统尚未初始化管理员，请将当前用户设为首位超级管理员。");
        setLoading(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        toast.error("您的账号尚未审核，请联系主管理员授权后再登录");
        setLoading(false);
        return;
      }
    }
    toast.success("登录成功，正在进入管理后台...");
    setTimeout(() => window.location.assign("/admin"), 1200);
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

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <div className="mt-6 mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">管理后台</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {step === "email" ? "输入邮箱获取验证码登录" : `验证码已发送至 ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form
            onSubmit={handleSendCode}
            className="bg-white rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)]"
          >
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-xl"
              />
            </div>
            <Button type="submit" disabled={loading || !email} className="w-full rounded-full h-12" size="lg">
              {loading ? "发送中..." : "发送验证码"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              首次登录的邮箱会自动创建账号，仍需管理员授权才能进入系统。
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleVerify}
            className="bg-white rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)]"
          >
            {needsFirstAdmin && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-3">
                <p>系统尚未初始化管理员，是否将当前用户设为首位超级管理员？</p>
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
