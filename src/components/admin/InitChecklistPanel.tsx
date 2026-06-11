import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { clearPublicAppSettingsCache } from "@/lib/auth-base-url";
import { qrProbeUrl } from "@/lib/qr-autotest.functions";

type CheckStatus = "pending" | "ok" | "warn" | "fail";
type CheckItem = {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  fixTo?: string;
  fixLabel?: string;
  required?: boolean;
};

export function InitChecklistPanel({
  onCompleted,
}: {
  onCompleted?: () => void;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function runChecks() {
    setRunning(true);
    const next: CheckItem[] = [];

    // 1. super_admin
    let superAdminId: string | null = null;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin")
        .limit(1);
      superAdminId = (data?.[0]?.user_id as string | undefined) ?? null;
    } catch { /* ignore */ }
    next.push({
      key: "super_admin",
      label: "存在超级管理员",
      status: superAdminId ? "ok" : "fail",
      detail: superAdminId ? "已检测到 super_admin" : "未检测到 super_admin",
      required: true,
    });

    // 2~7. app_settings 批量读
    const wantKeys = [
      "church_name_cn",
      "auth_base_url",
      "site_url",
      "email_sender_name",
      "reply_to_email",
    ];
    const settingsMap: Record<string, string> = {};
    try {
      const { data: rows } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", wantKeys);
      for (const r of (rows ?? []) as Array<{ key: string; value: string }>) {
        settingsMap[r.key] = (r.value ?? "").trim();
      }
    } catch { /* ignore */ }

    next.push({
      key: "church_name_cn",
      label: "教会名称已填写",
      status: settingsMap.church_name_cn ? "ok" : "fail",
      detail: settingsMap.church_name_cn || "未填写",
      fixTo: "/admin-settings",
      fixLabel: "前往系统设置",
      required: true,
    });

    const authBase = settingsMap.auth_base_url || settingsMap.site_url || "";
    next.push({
      key: "auth_base_url",
      label: "Site URL / Auth Base URL 已设置",
      status: authBase ? "ok" : "fail",
      detail: authBase || "未设置",
      fixTo: "/admin-settings",
      fixLabel: "前往系统设置",
      required: true,
    });

    next.push({
      key: "smtp",
      label: "邮件发件人已配置",
      status: settingsMap.email_sender_name ? "ok" : "warn",
      detail: settingsMap.email_sender_name
        ? `发件人：${settingsMap.email_sender_name}${settingsMap.reply_to_email ? ` · 回复：${settingsMap.reply_to_email}` : ""}`
        : "未配置发件人显示名称（可选）",
      fixTo: "/admin-settings",
      fixLabel: "前往系统设置",
    });

    // 3. home_page_settings 二维码
    let qrNewcomer = "";
    try {
      const { data } = await (supabase as any)
        .from("home_page_settings")
        .select("qr_newcomer_url")
        .limit(1);
      qrNewcomer = (data?.[0]?.qr_newcomer_url as string | undefined) ?? "";
    } catch { /* ignore */ }
    next.push({
      key: "qr_newcomer_url",
      label: "新人登记二维码地址已生成",
      status: qrNewcomer ? "ok" : "warn",
      detail: qrNewcomer || "未生成（可在主页设置中配置）",
      fixTo: "/home-editor",
      fixLabel: "前往主页设置",
    });

    // 4. /update-password 路由（前端固定存在）
    next.push({
      key: "update_password_route",
      label: "找回密码页面 /update-password 已就绪",
      status: "ok",
      detail: "前端路由已就绪",
    });

    setItems([...next]);

    // 5. 主页二维码探测
    const probeTargets = [
      { key: "probe_home", label: "首页二维码可访问", url: authBase ? `${authBase}/` : "" },
      { key: "probe_register", label: "新人登记二维码可访问", url: qrNewcomer || (authBase ? `${authBase}/register` : "") },
    ];
    for (const t of probeTargets) {
      let item: CheckItem;
      if (!t.url) {
        item = { key: t.key, label: t.label, status: "warn", detail: "缺少地址，跳过" };
      } else {
        try {
          const res = await qrProbeUrl({ data: { qrName: t.label, url: t.url } });
          if (res.detectedAuthRedirect) {
            item = { key: t.key, label: t.label, status: "fail", detail: `跳到登录/管理页：${res.finalUrl ?? t.url}` };
          } else if (res.detectedDevHost) {
            item = { key: t.key, label: t.label, status: "warn", detail: `含开发域名：${res.finalUrl ?? t.url}` };
          } else if (!res.ok) {
            item = { key: t.key, label: t.label, status: "fail", detail: res.errorMessage ?? `HTTP ${res.httpStatus ?? "?"}` };
          } else {
            item = { key: t.key, label: t.label, status: "ok", detail: `HTTP ${res.httpStatus ?? 200}` };
          }
        } catch (e: any) {
          item = { key: t.key, label: t.label, status: "warn", detail: `检测跳过：${e?.message ?? "未登录"}` };
        }
      }
      next.push(item);
      setItems([...next]);
    }

    setRunning(false);
  }

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRequiredFail = items.some((i) => i.required && i.status === "fail");
  const hasAnyFail = items.some((i) => i.status === "fail");

  async function confirmCompletion() {
    if (hasRequiredFail) {
      toast.error("仍有必填项未通过，请先修复。");
      return;
    }
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("未登录，无法确认初始化。");
      const { error } = await supabase.rpc("complete_initial_setup", {
        admin_user_id: uid,
        settings: {} as any,
      });
      if (error) throw error;
      clearPublicAppSettingsCache();
      toast.success("已确认初始化完成 ✓");
      onCompleted?.();
    } catch (e: any) {
      toast.error(`确认失败：${e?.message ?? String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">初始化检查</h2>
        <Button size="sm" variant="outline" onClick={runChecks} disabled={running}>
          {running ? "检查中..." : "重新检查"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        系统已检测到现有配置，无需重新填写表单。请确认下列项目，全部通过后点击「确认初始化完成」。
      </p>

      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3"
          >
            <StatusBadge status={it.status} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{it.label}</div>
              {it.detail && (
                <div className="text-xs text-muted-foreground break-all mt-0.5">{it.detail}</div>
              )}
            </div>
            {it.fixTo && (it.status === "fail" || it.status === "warn") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: it.fixTo! })}
              >
                {it.fixLabel ?? "前往修复"}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
        {hasAnyFail && !hasRequiredFail && (
          <span className="text-xs text-amber-600">
            存在非必填的警告项，可继续确认完成。
          </span>
        )}
        <Button
          onClick={confirmCompletion}
          disabled={running || submitting || hasRequiredFail}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {submitting ? "提交中..." : "确认初始化完成"}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; cls: string }> = {
    pending: { label: "…", cls: "bg-gray-200 text-gray-700" },
    ok: { label: "✓", cls: "bg-emerald-100 text-emerald-700" },
    warn: { label: "!", cls: "bg-amber-100 text-amber-700" },
    fail: { label: "✗", cls: "bg-rose-100 text-rose-700" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}
