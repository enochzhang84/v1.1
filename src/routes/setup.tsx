import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { clearPublicAppSettingsCache } from "@/lib/auth-base-url";
import { getPublicOrigin } from "@/lib/public-origin";
import { rewriteLegacyUrls } from "@/lib/legacy-urls";

export const Route = createFileRoute("/setup")({
  component: SetupWizard,
});

type Step = 1 | 2 | 3;

interface FormState {
  // step1
  admin_name: string;
  admin_email: string;
  password: string;
  password2: string;
  // step2
  church_name_cn: string;
  church_name_en: string;
  church_phone: string;
  church_email: string;
  church_website: string;
  church_address: string;
  sunday_service_time: string;
  // step3
  auth_base_url: string;
  email_sender_name: string;
  reply_to_email: string;
}

const empty: FormState = {
  admin_name: "",
  admin_email: "",
  password: "",
  password2: "",
  church_name_cn: "",
  church_name_en: "",
  church_phone: "",
  church_email: "",
  church_website: "",
  church_address: "",
  sunday_service_time: "",
  auth_base_url: "",
  email_sender_name: "",
  reply_to_email: "",
};

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(empty);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 反向守卫：已初始化则跳到登录
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("is_system_initialized");
      if (!error && data === true) {
        navigate({ to: "/login", replace: true });
        return;
      }
      // 预填默认值
      setForm((f) => ({
        ...f,
        auth_base_url: f.auth_base_url || getPublicOrigin(),
        email_sender_name: f.email_sender_name || "Ministry Center",
      }));
      setChecking(false);
    })();
  }, [navigate]);


  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validateStep1(): string | null {
    if (!form.admin_name.trim()) return "请填写管理员姓名。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) return "请填写有效的管理员邮箱。";
    if (form.password.length < 6) return "密码至少 6 位。";
    if (form.password !== form.password2) return "两次输入的密码不一致。";
    return null;
  }
  function validateStep2(): string | null {
    if (!form.church_name_cn.trim()) return "请填写教会中文名。";
    if (form.church_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.church_email))
      return "教会联系邮箱格式不正确。";
    return null;
  }
  function validateStep3(): string | null {
    if (!/^https?:\/\/[^\s]+$/i.test(form.auth_base_url))
      return "认证主域名需以 http:// 或 https:// 开头。";
    if (!form.email_sender_name.trim()) return "请填写发信显示名称。";
    if (form.reply_to_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reply_to_email))
      return "回复邮箱格式不正确。";
    return null;
  }

  function next() {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (err) {
      toast.error(err);
      return;
    }
    if (step === 2 && !form.reply_to_email) {
      set("reply_to_email", form.church_email);
    }
    setStep((s) => (s + 1) as Step);
  }

  async function submit() {
    const err = validateStep3();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      // 1) 创建超级管理员账号
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email: form.admin_email,
        password: form.password,
        options: {
          data: { full_name: form.admin_name },
          emailRedirectTo: `${form.auth_base_url.replace(/\/+$/, "")}/login`,
        },
      });
      if (signUpErr) throw signUpErr;

      let userId = signUp.user?.id ?? null;
      // 若关闭了邮箱确认且自动登录，userId 在 session 中
      if (!userId && signUp.session) userId = signUp.session.user.id;
      if (!userId) {
        // 尝试以新账号登入（少数情况下 signUp 不返回 user）
        const { data: signIn } = await supabase.auth.signInWithPassword({
          email: form.admin_email,
          password: form.password,
        });
        userId = signIn?.user?.id ?? null;
      }
      if (!userId) throw new Error("未能获取新管理员账号 ID，请稍后到登录页重试。");

      // 2) 写入所有设置 + 设为 super_admin
      const settings = {
        church_name_cn: form.church_name_cn,
        church_name_en: form.church_name_en,
        church_phone: form.church_phone,
        church_email: form.church_email,
        church_website: form.church_website,
        church_address: form.church_address,
        sunday_service_time: form.sunday_service_time,
        auth_base_url: form.auth_base_url.replace(/\/+$/, ""),
        email_sender_name: form.email_sender_name,
        reply_to_email: form.reply_to_email || form.church_email,
        admin_logo_title_zh: form.church_name_cn,
        admin_logo_title_en: form.church_name_en || form.email_sender_name,
      };
      const { error: rpcErr } = await supabase.rpc("complete_initial_setup", {
        admin_user_id: userId,
        settings,
      });
      if (rpcErr) throw rpcErr;

      clearPublicAppSettingsCache();
      // 退出当前会话，强制走标准登录流程
      try { await supabase.auth.signOut(); } catch { /* noop */ }
      toast.success("系统初始化成功，请登录管理员账户。");
      setTimeout(() => {
        window.location.assign("/login");
      }, 800);
    } catch (e: any) {
      setSubmitting(false);
      const msg = e?.message || String(e);
      toast.error(`开通失败：${msg}`);
      console.error("[setup] complete failed:", e);
    }
  }


  if (checking) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-muted-foreground">
        正在检查系统状态...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground rounded-full border border-gray-200 bg-white/80 px-4 py-2 backdrop-blur">
          退出
        </Link>
      </div>
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-foreground tracking-tight">欢迎使用系统管理中心</h1>
          <p className="text-muted-foreground text-sm mt-2">首次开通向导 · 第 {step} / 3 步</p>
        </div>


        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)] border border-white">
          {step === 1 && (
            <>
              <h2 className="text-lg font-medium">创建超级管理员账号</h2>
              <Field label="管理员姓名"><Input className="h-12 rounded-xl" value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} /></Field>
              <Field label="管理员邮箱"><Input type="email" className="h-12 rounded-xl" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="admin@example.com" /></Field>
              <Field label="密码（至少 6 位）"><Input type="password" className="h-12 rounded-xl" value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
              <Field label="确认密码"><Input type="password" className="h-12 rounded-xl" value={form.password2} onChange={(e) => set("password2", e.target.value)} /></Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-medium">教会基础信息</h2>
              <Field label="教会中文名 *"><Input className="h-12 rounded-xl" value={form.church_name_cn} onChange={(e) => set("church_name_cn", e.target.value)} /></Field>
              <Field label="教会英文名"><Input className="h-12 rounded-xl" value={form.church_name_en} onChange={(e) => set("church_name_en", e.target.value)} /></Field>
              <Field label="教会联系电话"><Input className="h-12 rounded-xl" value={form.church_phone} onChange={(e) => set("church_phone", e.target.value)} /></Field>
              <Field label="教会联系邮箱"><Input type="email" className="h-12 rounded-xl" value={form.church_email} onChange={(e) => set("church_email", e.target.value)} /></Field>
              <Field label="教会官方网站"><Input className="h-12 rounded-xl" value={form.church_website} onChange={(e) => set("church_website", e.target.value)} placeholder="https://" /></Field>
              <Field label="教会地址"><Textarea className="rounded-xl" rows={2} value={form.church_address} onChange={(e) => set("church_address", e.target.value)} /></Field>
              <Field label="主日聚会时间"><Input className="h-12 rounded-xl" value={form.sunday_service_time} onChange={(e) => set("sunday_service_time", e.target.value)} placeholder="例如：每周日上午 10:00" /></Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-medium">认证与邮件设置</h2>
              <Field label="认证主域名 Auth Base URL *" hint="所有认证邮件链接都会使用该域名。例如：https://hoc3.org">
                <Input className="h-12 rounded-xl" value={form.auth_base_url} onChange={(e) => set("auth_base_url", e.target.value)} placeholder="https://hoc3.org" />
              </Field>
              <Field label="系统发信显示名称 *">
                <Input className="h-12 rounded-xl" value={form.email_sender_name} onChange={(e) => set("email_sender_name", e.target.value)} placeholder="Ministry Center" />
              </Field>
              <Field label="回复邮箱 Reply-To" hint="默认使用教会联系邮箱">
                <Input type="email" className="h-12 rounded-xl" value={form.reply_to_email} onChange={(e) => set("reply_to_email", e.target.value)} placeholder={form.church_email || "reply@yourchurch.org"} />
              </Field>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <Button variant="ghost" disabled={submitting} onClick={() => setStep((s) => (s - 1) as Step)}>← 上一步</Button>
            ) : (
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">已有管理员，去登录</Link>
            )}
            {step < 3 ? (
              <Button className="rounded-full h-12 px-6 bg-emerald-600 hover:bg-emerald-700" onClick={next}>下一步</Button>
            ) : (
              <Button className="rounded-full h-12 px-6 bg-emerald-600 hover:bg-emerald-700" disabled={submitting} onClick={submit}>
                {submitting ? "正在开通..." : "完成开通"}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">© 2026 LioneApps · Version 2.0</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
