import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe, Link2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getPublicOrigin,
  isDevOrigin,
  setPreferredQrOrigin,
  loadOfficialOrigin,
} from "@/lib/public-origin";
import { clearPublicAppSettingsCache } from "@/lib/auth-base-url";
import { rewriteLegacyUrls, scanLegacyUrls } from "@/lib/legacy-urls";

/**
 * 当前系统域名绑定面板。
 * - 显示并允许编辑「当前系统域名」（默认 window.location.origin）
 * - 保存写入 app_settings.auth_base_url 与 site_url
 * - 一键绑定：保存后自动扫描并替换数据库内残留的旧域名
 *   （home_page_settings / qr_library / app_settings.auth_base_url）
 */
export function DomainBindingPanel() {
  const [stored, setStored] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [binding, setBinding] = useState(false);
  const [report, setReport] = useState<{
    scanned: number;
    updated: number;
    failed: number;
    finishedAt: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("get_public_app_settings");
        const rows = (data ?? []) as Array<{ key: string; value: string }>;
        const row = rows.find((r) => r.key === "auth_base_url");
        const fromDb = row?.value?.trim() ?? "";
        setStored(fromDb);
        const fallback =
          typeof window !== "undefined" && !isDevOrigin(window.location.origin)
            ? window.location.origin
            : getPublicOrigin();
        setInput(fromDb || fallback);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function normalize(v: string) {
    return v.trim().replace(/\/+$/, "");
  }

  function validate(v: string): string | null {
    const n = normalize(v);
    if (!/^https?:\/\//i.test(n)) return "必须以 http:// 或 https:// 开头";
    if (isDevOrigin(n))
      return "不能使用开发域名 (lovableproject.com / id-preview / localhost)";
    return null;
  }

  async function saveOnly() {
    const err = validate(input);
    if (err) return toast.error(err);
    const n = normalize(input);
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          [
            { key: "auth_base_url", value: n, updated_at: new Date().toISOString() },
            { key: "site_url", value: n, updated_at: new Date().toISOString() },
          ],
          { onConflict: "key" },
        );
      if (error) throw error;
      setPreferredQrOrigin(n);
      clearPublicAppSettingsCache();
      await loadOfficialOrigin();
      setStored(n);
      toast.success("已保存当前系统域名");
    } catch (e) {
      toast.error("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function bindAll() {
    const err = validate(input);
    if (err) return toast.error(err);
    const n = normalize(input);
    setBinding(true);
    setReport(null);
    try {
      // 1. 先保存域名
      const { error: upErr } = await (supabase as any)
        .from("app_settings")
        .upsert(
          [
            { key: "auth_base_url", value: n, updated_at: new Date().toISOString() },
            { key: "site_url", value: n, updated_at: new Date().toISOString() },
          ],
          { onConflict: "key" },
        );
      if (upErr) throw upErr;
      setPreferredQrOrigin(n);
      clearPublicAppSettingsCache();
      await loadOfficialOrigin();
      setStored(n);

      // 2. 扫描旧域名
      const scan = await scanLegacyUrls(n);
      // 3. 一键替换
      const res = await rewriteLegacyUrls(n);
      setReport({
        scanned: scan.total,
        updated: res.updated,
        failed: res.failed,
        finishedAt: new Date().toLocaleString(),
      });
      if (res.failed > 0) {
        toast.warning(`绑定完成：更新 ${res.updated}，失败 ${res.failed}`);
        console.warn("[DomainBindingPanel] errors", res.errors);
      } else {
        toast.success(
          scan.total === 0
            ? `已绑定 ${n}（未发现旧域名残留）`
            : `已绑定 ${n}，共更新 ${res.updated} 条旧域名记录`,
        );
      }
    } catch (e) {
      toast.error("绑定失败：" + (e as Error).message);
    } finally {
      setBinding(false);
    }
  }

  const liveOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const inputIsLiveOrigin = normalize(input) === normalize(liveOrigin);

  return (
    <div
      className="rounded-2xl bg-white/85 backdrop-blur-xl p-5 space-y-4"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#eaf3ff] p-2.5">
          <Globe className="w-5 h-5 text-[#1862c4]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">当前系统域名</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            所有二维码、邮件链接、找回密码跳转都会使用此域名。
            修改后点击「一键绑定当前系统域名」会自动替换数据库内残留的旧域名。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 读取中…
        </div>
      ) : (
        <>
          <div>
            <Label className="text-xs">系统域名</Label>
            <div className="mt-1.5 flex gap-2 flex-wrap">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://your-church.lovable.app"
                className="flex-1 min-w-[260px]"
              />
              {!inputIsLiveOrigin && liveOrigin && !isDevOrigin(liveOrigin) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setInput(liveOrigin)}
                >
                  使用当前外部地址
                </Button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
              <div>
                已保存：<code>{stored || "（未设置）"}</code>
              </div>
              <div>
                当前浏览器地址：<code>{liveOrigin}</code>
                {isDevOrigin(liveOrigin) && (
                  <span className="text-[#a86c00] ml-1">（开发域名，不会被采纳）</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={saveOnly}
              disabled={saving || binding}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              仅保存域名
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              onClick={bindAll}
              disabled={saving || binding}
            >
              {binding ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-1.5" />
              )}
              一键绑定当前系统域名（保存 + 替换旧域名）
            </Button>
          </div>

          {report && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
              <div className="font-medium text-sm mb-1">绑定报告</div>
              <div>扫描旧域名记录：{report.scanned} 条</div>
              <div>已成功替换：{report.updated} 条</div>
              <div>失败：{report.failed} 条</div>
              <div className="text-muted-foreground">完成时间：{report.finishedAt}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
