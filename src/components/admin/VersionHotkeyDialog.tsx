import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { emitAdminLogoUpdated } from "@/hooks/useAdminLogo";

/**
 * 隐藏快捷键：Ctrl + Shift + ~  → 弹出「修改系统版本号」窗口
 * 仅 super_admin 可用；写入 app_settings.system_version & admin_logo_version。
 */
export function VersionHotkeyDialog({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadCurrent = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("app_settings")
      .select("key,value")
      .in("key", ["system_version", "admin_logo_version"]);
    let sv = "";
    let lv = "";
    for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
      if (row.key === "system_version") sv = row.value ?? "";
      if (row.key === "admin_logo_version") lv = row.value ?? "";
    }
    const display = lv?.trim() || (sv ? (/^version/i.test(sv) ? sv : `Version ${sv.replace(/^v/i, "")}`) : "Version 2.0");
    setCurrent(display);
    setValue(display);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    function onKey(e: KeyboardEvent) {
      // Ctrl + Shift + ~ （按键为 Backquote，shift 时输出 ~）
      if (e.ctrlKey && e.shiftKey && (e.key === "~" || e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        loadCurrent();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSuperAdmin, loadCurrent]);

  if (!isSuperAdmin || !open) return null;

  async function save() {
    const v = value.trim();
    if (!v) {
      toast.error("版本号不能为空");
      return;
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      // 写入展示用版本号（admin_logo_version）+ 权威 system_version
      const sysVer = v.replace(/^version\s*/i, "").trim();
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          [
            { key: "admin_logo_version", value: v, updated_at: nowIso },
            { key: "system_version", value: sysVer ? (/^v/i.test(sysVer) ? sysVer : `v${sysVer}`) : v, updated_at: nowIso },
          ],
          { onConflict: "key" },
        );
      if (error) throw error;
      emitAdminLogoUpdated();
      toast.success(`版本号已更新为 ${v}`);
      setOpen(false);
    } catch (e: any) {
      toast.error("保存失败：" + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => !saving && setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[92%] max-w-md rounded-[20px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 p-6 space-y-5"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">修改系统版本号</h2>
          <p className="text-xs text-muted-foreground">仅超级管理员可见的快捷设置（Ctrl + Shift + ~）</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">当前版本号</label>
          <div className="px-3 py-2 rounded-lg bg-muted/60 text-sm font-mono">{current || "—"}</div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">新版本号</label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="例如：Version 2.1"
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-[11px] text-muted-foreground">
            保存后将同步更新：后台左上角版本号、登录页、关于系统、运维中心、页脚版权区域。
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen(false)}
            className="h-9 px-5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-9 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-sm font-medium text-white shadow-sm transition-colors"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
