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
import { scanLegacyUrls, rewriteLegacyUrls, type LegacyHit } from "@/lib/legacy-urls";
import { qrProbeUrl } from "@/lib/qr-autotest.functions";
import { BUILTIN_QR_REGISTRY, loadQrRegistry } from "@/lib/qr-registry";

export const Route = createFileRoute("/setup")({
  component: SetupWizard,
});

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface FormState {
  // 1 教会
  church_name_cn: string;
  church_name_en: string;
  church_phone: string;
  church_email: string;
  church_website: string;
  church_address: string;
  sunday_service_time: string;
  // 2 管理员
  admin_name: string;
  admin_email: string;
  password: string;
  password2: string;
  // 3 邮件
  email_sender_name: string;
  reply_to_email: string;
  // 4 域名
  formal_origin: string;
  // 6 旧域名（额外，可选）
  extra_legacy: string;
}

const empty: FormState = {
  church_name_cn: "",
  church_name_en: "",
  church_phone: "",
  church_email: "",
  church_website: "",
  church_address: "",
  sunday_service_time: "",
  admin_name: "",
  admin_email: "",
  password: "",
  password2: "",
  email_sender_name: "Ministry Center",
  reply_to_email: "",
  formal_origin: "",
  extra_legacy: "",
};

function normalizeOrigin(s: string): string {
  return s.trim().replace(/\/+$/, "");
}

function extraHosts(raw: string): string[] {
  return raw
    .split(/[\s,，;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try { return new URL(s.startsWith("http") ? s : `https://${s}`).host; }
      catch { return s.toLowerCase(); }
    });
}

type ProbeRow = {
  name: string;
  url: string;
  status: "pending" | "ok" | "warn" | "fail";
  message: string;
};

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(empty);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 步骤 6 / 7 状态
  const [legacyHits, setLegacyHits] = useState<LegacyHit[] | null>(null);
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [legacyFixed, setLegacyFixed] = useState<number | null>(null);
  const [probeRows, setProbeRows] = useState<ProbeRow[]>([]);
  const [probeBusy, setProbeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("is_system_initialized");
      if (!error && data === true) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setForm((f) => ({
        ...f,
        formal_origin: f.formal_origin || getPublicOrigin(),
      }));
      setChecking(false);
    })();
  }, [navigate]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // ---- 校验 ----
  function vChurch(): string | null {
    if (!form.church_name_cn.trim()) return "请填写教会中文名。";
    if (form.church_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.church_email))
      return "教会联系邮箱格式不正确。";
    return null;
  }
  function vAdmin(): string | null {
    if (!form.admin_name.trim()) return "请填写管理员姓名。";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) return "请填写有效的管理员邮箱。";
    if (form.password.length < 6) return "密码至少 6 位。";
    if (form.password !== form.password2) return "两次输入的密码不一致。";
    return null;
  }
  function vEmail(): string | null {
    if (!form.email_sender_name.trim()) return "请填写发信显示名称。";
    if (form.reply_to_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reply_to_email))
      return "回复邮箱格式不正确。";
    return null;
  }
  function vDomain(): string | null {
    if (!/^https?:\/\/[^\s/]+/i.test(form.formal_origin))
      return "正式域名需以 http:// 或 https:// 开头。";
    try { new URL(form.formal_origin); } catch { return "正式域名格式不正确。"; }
    return null;
  }

  function next() {
    const err =
      step === 1 ? vChurch() :
      step === 2 ? vAdmin() :
      step === 3 ? vEmail() :
      step === 4 ? vDomain() : null;
    if (err) { toast.error(err); return; }
    if (step === 1 && !form.reply_to_email) set("reply_to_email", form.church_email);
    setStep((s) => Math.min(7, s + 1) as Step);
  }
  function back() { setStep((s) => Math.max(1, s - 1) as Step); }

  // ---- 步骤 5：保存（创建管理员 + 写设置 + 写主页二维码地址）----
  async function commitSetup(): Promise<boolean> {
    setSubmitting(true);
    const origin = normalizeOrigin(form.formal_origin);
    const warnings: string[] = [];
    let userId: string | null = null;

    try {
      console.log("[setup] step5 start", { adminEmail: form.admin_email, origin });

      // 1) 创建超级管理员（多路径取 user.id，失败时记录警告而不是中断）
      try {
        const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
          email: form.admin_email,
          password: form.password,
          options: {
            data: { full_name: form.admin_name },
            emailRedirectTo: `${origin}/login`,
          },
        });
        console.log("[setup] signUp result:", { user: signUp?.user?.id, hasSession: !!signUp?.session, err: signUpErr?.message });
        if (signUpErr && !/already|registered|exists/i.test(signUpErr.message)) {
          throw signUpErr;
        }
        userId = signUp?.user?.id ?? signUp?.session?.user?.id ?? null;
      } catch (e: any) {
        console.warn("[setup] signUp threw:", e?.message);
        warnings.push(`注册：${e?.message ?? e}`);
      }

      // 2) 若未拿到 userId，尝试用密码登录获取（账号已存在场景）
      if (!userId) {
        try {
          const { data: signIn, error: siErr } = await supabase.auth.signInWithPassword({
            email: form.admin_email,
            password: form.password,
          });
          console.log("[setup] signIn fallback:", { user: signIn?.user?.id, err: siErr?.message });
          if (siErr) warnings.push(`登录回退：${siErr.message}`);
          userId = signIn?.user?.id ?? null;
        } catch (e: any) {
          warnings.push(`登录回退异常：${e?.message ?? e}`);
        }
      }

      // 3) 再从当前 session 兜底
      if (!userId) {
        const { data: u } = await supabase.auth.getUser();
        userId = u?.user?.id ?? null;
        console.log("[setup] getUser fallback:", userId);
      }

      // 4) 写入设置 + 设为 super_admin（拿到 userId 才能调 RPC）
      const settings = {
        church_name_cn: form.church_name_cn,
        church_name_en: form.church_name_en,
        church_phone: form.church_phone,
        church_email: form.church_email,
        church_website: form.church_website || origin,
        church_address: form.church_address,
        sunday_service_time: form.sunday_service_time,
        auth_base_url: origin,
        site_url: origin,
        email_sender_name: form.email_sender_name,
        reply_to_email: form.reply_to_email || form.church_email,
        admin_logo_title_zh: form.church_name_cn,
        admin_logo_title_en: form.church_name_en || form.email_sender_name,
      };

      if (userId) {
        const { error: rpcErr } = await supabase.rpc("complete_initial_setup", {
          admin_user_id: userId,
          settings,
        });
        console.log("[setup] complete_initial_setup err:", rpcErr?.message);
        if (rpcErr) {
          warnings.push(`系统设置写入失败：${rpcErr.message}`);
        } else {
          clearPublicAppSettingsCache();
        }
      } else {
        warnings.push("未能获取管理员 ID，已跳过 super_admin 授权（请稍后手动登录后再次运行向导补建角色）。");
      }

      // 5) 初始化主页二维码地址（无论 userId 是否拿到都执行）
      try {
        const qrPatch = {
          qr_newcomer_url: `${origin}/register`,
          qr_retreat_url: `${origin}/retreat-register`,
        };
        const { data: rows } = await (supabase as any)
          .from("home_page_settings").select("id").limit(1);
        if (rows && rows.length > 0) {
          await (supabase as any).from("home_page_settings").update(qrPatch).eq("id", rows[0].id);
        } else {
          await (supabase as any).from("home_page_settings").insert(qrPatch);
        }
        console.log("[setup] qr init done", qrPatch);
      } catch (e: any) {
        warnings.push(`二维码初始化失败：${e?.message ?? e}`);
        console.error("[setup] qr init err:", e);
      }

      // 5b) 防御性补齐 qr_registry 内置项（万一新副本未跑该迁移）
      try {
        for (const item of BUILTIN_QR_REGISTRY) {
          await (supabase as any)
            .from("qr_registry")
            .upsert(item, { onConflict: "route_path" });
        }
        console.log("[setup] qr_registry seeded", BUILTIN_QR_REGISTRY.length);
      } catch (e: any) {
        warnings.push(`二维码注册表种子失败：${e?.message ?? e}`);
        console.warn("[setup] qr_registry seed err:", e);
      }

      setSubmitting(false);
      if (warnings.length > 0) {
        toast.warning(`已继续，但有 ${warnings.length} 条警告：${warnings[0]}`);
        console.warn("[setup] warnings:", warnings);
      } else {
        toast.success("系统初始化成功，正在扫描旧域名…");
      }
      return true;
    } catch (e: any) {
      setSubmitting(false);
      toast.error(`开通失败：${e?.message ?? String(e)}`);
      console.error("[setup] commit failed:", e);
      return false;
    }
  }

  // ---- 步骤 6：旧域名扫描 ----
  async function runLegacyScan() {
    setLegacyBusy(true);
    try {
      const origin = normalizeOrigin(form.formal_origin);
      const res = await scanLegacyUrls(origin, extraHosts(form.extra_legacy));
      setLegacyHits(res.hits);
      if (res.total === 0) toast.success("未发现旧域名残留 ✓");
      else toast.warning(`发现 ${res.total} 处旧域名残留`);
    } catch (e: any) {
      toast.error(`扫描失败：${e?.message ?? String(e)}`);
    } finally {
      setLegacyBusy(false);
    }
  }
  async function runLegacyFix() {
    setLegacyBusy(true);
    try {
      const origin = normalizeOrigin(form.formal_origin);
      const res = await rewriteLegacyUrls(origin, extraHosts(form.extra_legacy));
      setLegacyFixed(res.updated);
      if (res.failed > 0) toast.error(`${res.updated} 成功 / ${res.failed} 失败`);
      else toast.success(`已替换 ${res.updated} 处旧域名 ✓`);
      const verify = await scanLegacyUrls(origin, extraHosts(form.extra_legacy));
      setLegacyHits(verify.hits);
    } catch (e: any) {
      toast.error(`替换失败：${e?.message ?? String(e)}`);
    } finally {
      setLegacyBusy(false);
    }
  }

  // ---- 步骤 7：二维码健康检查 ----
  async function runHealthCheck() {
    const origin = normalizeOrigin(form.formal_origin);
    // 从 qr_registry 拉取全部已注册模块；失败则回退到内置清单
    let entries: Array<{ name: string; route_path: string }>;
    try {
      const reg = await loadQrRegistry();
      entries = reg.length > 0 ? reg : BUILTIN_QR_REGISTRY;
    } catch {
      entries = BUILTIN_QR_REGISTRY;
    }
    const list: ProbeRow[] = [
      { name: "主页", url: `${origin}/`, status: "pending", message: "" },
      ...entries.map((e) => ({
        name: e.name,
        url: `${origin}${e.route_path}`,
        status: "pending" as const,
        message: "",
      })),
    ];
    setProbeRows(list);
    setProbeBusy(true);
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      try {
        const res = await qrProbeUrl({ data: { qrName: r.name, url: r.url } });
        const enteredAuth = res.detectedAuthRedirect;
        const devHost = res.detectedDevHost;
        let status: ProbeRow["status"] = "ok";
        const parts: string[] = [];
        if (res.httpStatus) parts.push(`HTTP ${res.httpStatus}`);
        if (res.finalUrl && res.finalUrl !== r.url) parts.push(`→ ${res.finalUrl}`);
        if (enteredAuth) { status = "fail"; parts.push("跳转到登录/管理页 ✗"); }
        else if (devHost) { status = "warn"; parts.push("仍含开发域名 ⚠"); }
        else if (!res.ok) { status = "fail"; parts.push(res.errorMessage ?? "请求失败"); }
        list[i] = { ...r, status, message: parts.join(" · ") };
      } catch (e: any) {
        list[i] = { ...r, status: "warn", message: `检测跳过：${e?.message ?? "未登录"}` };
      }
      setProbeRows([...list]);
    }
    setProbeBusy(false);
  }

  async function finish() {
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    window.location.assign("/login");
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-muted-foreground">
        正在检查系统状态...
      </div>
    );
  }

  const stepTitles = [
    "教会基础信息", "管理员账号", "邮件设置",
    "系统域名配置", "二维码初始化", "旧域名扫描", "二维码健康检查",
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground rounded-full border border-gray-200 bg-white/80 px-4 py-2 backdrop-blur">退出</Link>
      </div>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="font-serif text-4xl text-foreground tracking-tight">欢迎使用系统管理中心</h1>
          <p className="text-muted-foreground text-sm mt-2">首次开通向导 · 第 {step} / 7 步 · {stepTitles[step - 1]}</p>
        </div>

        {/* 进度条 */}
        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-emerald-500" : "bg-gray-200"}`} />
          ))}
        </div>

        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 space-y-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.12)] border border-white">
          {step === 1 && (
            <>
              <h2 className="text-lg font-medium">教会基础信息</h2>
              <Field label="教会中文名 *"><Input className="h-11 rounded-xl" value={form.church_name_cn} onChange={(e) => set("church_name_cn", e.target.value)} /></Field>
              <Field label="教会英文名"><Input className="h-11 rounded-xl" value={form.church_name_en} onChange={(e) => set("church_name_en", e.target.value)} /></Field>
              <Field label="教会联系电话"><Input className="h-11 rounded-xl" value={form.church_phone} onChange={(e) => set("church_phone", e.target.value)} /></Field>
              <Field label="教会联系邮箱"><Input type="email" className="h-11 rounded-xl" value={form.church_email} onChange={(e) => set("church_email", e.target.value)} /></Field>
              <Field label="教会官方网站"><Input className="h-11 rounded-xl" value={form.church_website} onChange={(e) => set("church_website", e.target.value)} placeholder="https://" /></Field>
              <Field label="教会地址"><Textarea className="rounded-xl" rows={2} value={form.church_address} onChange={(e) => set("church_address", e.target.value)} /></Field>
              <Field label="主日聚会时间"><Input className="h-11 rounded-xl" value={form.sunday_service_time} onChange={(e) => set("sunday_service_time", e.target.value)} placeholder="例如：每周日上午 10:00" /></Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-medium">创建超级管理员账号</h2>
              <Field label="管理员姓名"><Input className="h-11 rounded-xl" value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} /></Field>
              <Field label="管理员邮箱"><Input type="email" className="h-11 rounded-xl" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="admin@example.com" /></Field>
              <Field label="密码（至少 6 位）"><Input type="password" className="h-11 rounded-xl" value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
              <Field label="确认密码"><Input type="password" className="h-11 rounded-xl" value={form.password2} onChange={(e) => set("password2", e.target.value)} /></Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-medium">邮件设置</h2>
              <Field label="发信显示名称 *">
                <Input className="h-11 rounded-xl" value={form.email_sender_name} onChange={(e) => set("email_sender_name", e.target.value)} placeholder="Ministry Center" />
              </Field>
              <Field label="回复邮箱 Reply-To" hint="默认使用教会联系邮箱">
                <Input type="email" className="h-11 rounded-xl" value={form.reply_to_email} onChange={(e) => set("reply_to_email", e.target.value)} placeholder={form.church_email || "reply@yourchurch.org"} />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-medium">系统域名配置</h2>
              <Field
                label="正式域名 *"
                hint="所有二维码、认证邮件链接、主页地址都将使用此域名。例如：https://gracechurch.lioneapps.com"
              >
                <Input className="h-11 rounded-xl" value={form.formal_origin} onChange={(e) => set("formal_origin", e.target.value)} placeholder="https://gracechurch.lioneapps.com" />
              </Field>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1">
                <div className="font-medium text-emerald-800">保存后将自动写入：</div>
                <div>• Site URL = <code>{form.formal_origin || "—"}</code></div>
                <div>• Auth Base URL = <code>{form.formal_origin || "—"}</code></div>
                <div>• 主页 / 登记 / 二维码地址 = <code>{form.formal_origin || "—"}/...</code></div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-lg font-medium">二维码初始化</h2>
              <p className="text-sm text-muted-foreground">
                即将创建管理员账号、写入系统设置，并按正式域名生成主页二维码地址：
              </p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs space-y-1 font-mono">
                <div>qr_newcomer_url = <span className="text-emerald-700">{normalizeOrigin(form.formal_origin)}/register</span></div>
                <div>qr_retreat_url  = <span className="text-emerald-700">{normalizeOrigin(form.formal_origin)}/retreat-register</span></div>
              </div>
              <p className="text-xs text-muted-foreground">
                完成本步后会自动进入第 6 步「旧域名扫描」，自动改写 qr_library / 主页按钮等其它残留 URL。
              </p>
              {!submitting && (
                <Button
                  className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={async () => { const ok = await commitSetup(); if (ok) { setStep(6); setTimeout(runLegacyScan, 300); } }}
                >
                  完成开通并继续 →
                </Button>
              )}
              {submitting && <div className="text-center text-sm text-muted-foreground">正在创建账号与写入设置…</div>}
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="text-lg font-medium">旧域名扫描</h2>
              <p className="text-sm text-muted-foreground">
                扫描 <code>home_page_settings</code> / <code>qr_library</code> / <code>app_settings</code> 中残留的
                <code> lovableproject.com</code>、<code>id-preview</code>、<code>localhost</code> 及下方填写的旧教会域名。
              </p>
              <Field label="额外的旧域名（可选，逗号或空格分隔）">
                <Input className="h-11 rounded-xl" value={form.extra_legacy} onChange={(e) => set("extra_legacy", e.target.value)} placeholder="oldchurch.org, old.example.com" />
              </Field>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={runLegacyScan} disabled={legacyBusy}>{legacyBusy ? "扫描中…" : "重新扫描"}</Button>
                <Button onClick={runLegacyFix} disabled={legacyBusy || !legacyHits || legacyHits.length === 0}>
                  一键修复（{legacyHits?.length ?? 0}）
                </Button>
              </div>
              {legacyHits && legacyHits.length === 0 && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  ✓ 没有旧域名残留{legacyFixed !== null ? `（已修复 ${legacyFixed} 处）` : ""}
                </div>
              )}
              {legacyHits && legacyHits.length > 0 && (
                <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-xs space-y-2 max-h-64 overflow-auto">
                  <div className="font-medium text-amber-800">⚠ 发现旧域名残留，是否自动替换为当前系统域名？</div>
                  {legacyHits.map((h, i) => (
                    <div key={i} className="border-b border-amber-200 pb-2 last:border-0">
                      <div className="font-medium">[{h.table}.{h.column}] {h.label}</div>
                      <div className="text-red-600 break-all">旧：{h.oldUrl}</div>
                      <div className="text-emerald-700 break-all">新：{h.newUrl}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => { setStep(7); setTimeout(runHealthCheck, 300); }}>
                  下一步：健康检查 →
                </Button>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <h2 className="text-lg font-medium">二维码健康检查</h2>
              <p className="text-sm text-muted-foreground">
                自动请求二维码地址，检查最终跳转、是否进入公开登记页、是否误跳登录页。
              </p>
              {probeRows.length === 0 && !probeBusy && (
                <Button variant="outline" onClick={runHealthCheck}>开始检查</Button>
              )}
              {probeRows.length > 0 && (
                <div className="space-y-2">
                  {probeRows.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 text-sm ${
                        r.status === "ok" ? "bg-emerald-50 border-emerald-200" :
                        r.status === "warn" ? "bg-amber-50 border-amber-200" :
                        r.status === "fail" ? "bg-red-50 border-red-200" :
                        "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {r.status === "ok" ? "✓" : r.status === "warn" ? "⚠" : r.status === "fail" ? "✗" : "…"} {r.name}
                        </span>
                        <code className="text-xs text-muted-foreground truncate max-w-[60%]">{r.url}</code>
                      </div>
                      {r.message && <div className="text-xs text-muted-foreground mt-1">{r.message}</div>}
                    </div>
                  ))}
                </div>
              )}
              {probeBusy && <div className="text-xs text-muted-foreground">检查中…</div>}
              <div className="flex justify-between items-center pt-3">
                <Button variant="ghost" onClick={runHealthCheck} disabled={probeBusy}>重新检查</Button>
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={finish}>
                  全部完成 · 去登录
                </Button>
              </div>
            </>
          )}

          {/* 通用导航 */}
          {step <= 4 && (
            <div className="flex items-center justify-between pt-2">
              {step > 1 ? (
                <Button variant="ghost" disabled={submitting} onClick={back}>← 上一步</Button>
              ) : (
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">已有管理员，去登录</Link>
              )}
              <Button className="rounded-full h-11 px-6 bg-emerald-600 hover:bg-emerald-700" onClick={next}>下一步 →</Button>
            </div>
          )}
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
