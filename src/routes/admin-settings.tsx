import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { clearPublicAppSettingsCache } from "@/lib/auth-base-url";
import { useAdminGuard } from "@/hooks/useAdminGuard";

export const Route = createFileRoute("/admin-settings")({
  component: AdminSettingsPage,
});

const CHURCH_KEYS = [
  "church_name_cn",
  "church_name_en",
  "church_phone",
  "church_email",
  "church_website",
  "church_address",
  "sunday_service_time",
] as const;

const AUTH_KEYS = ["auth_base_url", "email_sender_name", "reply_to_email"] as const;

type SettingsState = Record<string, string>;

function AdminSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [state, setState] = useState<SettingsState>({});

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const uid = sess.session.user.id;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const ok = (roles ?? []).some(
        (r: any) => r.role === "super_admin" || r.role === "admin",
      );
      if (!ok) {
        toast.error("无权访问系统设置。");
        navigate({ to: "/admin", replace: true });
        return;
      }
      setAuthorized(true);

      const keys = [...CHURCH_KEYS, ...AUTH_KEYS];
      const { data: rows } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", keys);
      const init: SettingsState = {};
      for (const k of keys) init[k] = "";
      for (const r of (rows ?? []) as Array<{ key: string; value: string }>) {
        init[r.key] = r.value ?? "";
      }
      setState(init);
      setLoading(false);
    })();
  }, [navigate]);

  function set(k: string, v: string) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    if (state.auth_base_url && !/^https?:\/\//i.test(state.auth_base_url)) {
      toast.error("认证主域名需以 http:// 或 https:// 开头。");
      return;
    }
    setSaving(true);
    const rows = [...CHURCH_KEYS, ...AUTH_KEYS].map((k) => ({
      key: k,
      value: k === "auth_base_url" ? (state[k] || "").replace(/\/+$/, "") : state[k] ?? "",
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error(`保存失败：${error.message}`);
      return;
    }
    clearPublicAppSettingsCache();
    toast.success("已保存。");
  }

  if (!authorized || loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回后台
        </Link>
        <h1 className="font-serif text-3xl mt-4 mb-6">系统设置</h1>

        <Section title="教会资料">
          <Row label="教会中文名" k="church_name_cn" state={state} set={set} />
          <Row label="教会英文名" k="church_name_en" state={state} set={set} />
          <Row label="教会联系电话" k="church_phone" state={state} set={set} />
          <Row label="教会联系邮箱" k="church_email" state={state} set={set} type="email" />
          <Row label="教会官方网站" k="church_website" state={state} set={set} placeholder="https://" />
          <Row label="教会地址" k="church_address" state={state} set={set} textarea />
          <Row label="主日聚会时间" k="sunday_service_time" state={state} set={set} />
        </Section>

        <Section title="认证与邮件设置">
          <Row
            label="认证主域名 Auth Base URL"
            k="auth_base_url"
            state={state}
            set={set}
            hint="所有认证邮件链接都会使用该域名。例如：https://hoc3.org"
            placeholder="https://hoc3.org"
          />
          <Row
            label="系统发信显示名称"
            k="email_sender_name"
            state={state}
            set={set}
            placeholder="HOC3 Ministry Center"
          />
          <Row
            label="回复邮箱 Reply-To"
            k="reply_to_email"
            state={state}
            set={set}
            type="email"
            hint="留空则使用教会联系邮箱"
          />
        </Section>

        <div className="mt-8 flex justify-end">
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-full h-12 px-8 bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-white space-y-5 mb-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </div>
  );
}

function Row({
  label,
  k,
  state,
  set,
  type = "text",
  textarea = false,
  placeholder,
  hint,
}: {
  label: string;
  k: string;
  state: SettingsState;
  set: (k: string, v: string) => void;
  type?: string;
  textarea?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {textarea ? (
        <Textarea
          rows={2}
          value={state[k] ?? ""}
          onChange={(e) => set(k, e.target.value)}
          className="rounded-xl"
          placeholder={placeholder}
        />
      ) : (
        <Input
          type={type}
          value={state[k] ?? ""}
          onChange={(e) => set(k, e.target.value)}
          className="h-12 rounded-xl"
          placeholder={placeholder}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
