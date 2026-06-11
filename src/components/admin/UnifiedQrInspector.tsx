import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldCheck, Loader2, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { getPublicOrigin, loadOfficialOrigin } from "@/lib/public-origin";
import { loadQrRegistry, buildQrUrl, type QrRegistryItem } from "@/lib/qr-registry";
import { scanLegacyUrls, rewriteLegacyUrls } from "@/lib/legacy-urls";

/**
 * 统一二维码检查面板。
 * 数据来源：qr_registry 注册表（route_path） + 自定义 qr_library。
 * URL 拼接：getPublicOrigin() + route_path  → 域名切换时一次性生效。
 */

type QrLevel = "ok" | "warn" | "fail" | "unknown";

type QrItem = {
  id: string;
  name: string;
  url: string;
  source: string;
};

type QrStatus = {
  level: QrLevel;
  label: string;
  detail?: string;
  checking?: boolean;
};

async function probe(url: string, currentOrigin: string): Promise<QrStatus> {
  if (!url || url.includes("undefined") || url.trim() === "") {
    return { level: "fail", label: "🔴 链接为空 / 无效" };
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { level: "fail", label: "🔴 链接格式错误" }; }
  const sameOrigin = parsed.origin === currentOrigin;
  if (sameOrigin) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      if (res.status === 404) return { level: "fail", label: "🔴 页面不存在（404）" };
      if (res.status >= 500) return { level: "fail", label: `🔴 服务器错误（${res.status}）` };
      if (res.status === 401 || res.status === 403) return { level: "warn", label: "🟡 需要登录" };
      if (res.status >= 200 && res.status < 400)
        return { level: "ok", label: "🟢 正常访问", detail: `HTTP ${res.status}` };
      return { level: "warn", label: `🟡 状态 ${res.status}` };
    } catch (e) {
      return { level: "warn", label: "🟡 检测受限（可能为跨域限制）", detail: (e as Error).message };
    }
  }
  try { await fetch(url, { method: "GET", mode: "no-cors" }); } catch { /* ignore */ }
  return {
    level: "warn",
    label: "🟡 检测受限（跨域，无法读取状态码）",
    detail: `二维码指向 ${parsed.origin}，与当前站点 ${currentOrigin} 不同源。请点击「测试」验证。`,
  };
}

export function UnifiedQrInspector() {
  const [items, setItems] = useState<QrItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, QrStatus>>({});
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [origin, setOrigin] = useState<string>(getPublicOrigin());

  const reload = useCallback(async () => {
    setLoading(true);
    const currentOrigin = getPublicOrigin();
    setOrigin(currentOrigin);

    const list: QrItem[] = [];
    const registry: QrRegistryItem[] = await loadQrRegistry();
    for (const r of registry) {
      list.push({
        id: `reg:${r.id}`,
        name: r.name,
        url: buildQrUrl(r.route_path, currentOrigin),
        source: r.is_system ? "系统注册表" : "自定义注册表",
      });
    }

    // 主页设置二维码（如果管理员手动覆盖了 URL）
    try {
      const { data: home } = await (supabase as any)
        .from("home_page_settings")
        .select("qr_newcomer_url, qr_retreat_url")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (home?.qr_newcomer_url) {
        list.push({ id: "home:newcomer", name: "新人登记（主页覆盖）", url: home.qr_newcomer_url, source: "主页设置" });
      }
      if (home?.qr_retreat_url) {
        list.push({ id: "home:retreat", name: "退修会（主页覆盖）", url: home.qr_retreat_url, source: "主页设置" });
      }
    } catch { /* ignore */ }

    // 自定义二维码库
    try {
      const { data: lib } = await (supabase as any)
        .from("qr_library")
        .select("id, name, target_url")
        .order("created_at", { ascending: false });
      (lib ?? []).forEach((r: { id: string; name: string; target_url: string }) => {
        if (r.target_url) {
          list.push({ id: `lib:${r.id}`, name: r.name || "自定义二维码", url: r.target_url, source: "自定义二维码库" });
        }
      });
    } catch { /* ignore */ }

    setItems(list);
    setStatuses({});
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const checkOne = useCallback(async (item: QrItem) => {
    setStatuses((s) => ({ ...s, [item.id]: { level: "unknown", label: "检测中…", checking: true } }));
    const st = await probe(item.url, origin);
    setStatuses((s) => ({ ...s, [item.id]: st }));
  }, [origin]);

  const checkAll = useCallback(async () => {
    for (const it of items) await checkOne(it);
  }, [items, checkOne]);

  const regenerateAll = useCallback(async () => {
    setRegenerating(true);
    try {
      await loadOfficialOrigin(); // 从 app_settings.auth_base_url 拉取并缓存
      await reload();
      toast.success(`已根据正式域名重新生成（${getPublicOrigin()}）`);
    } catch (e) {
      toast.error("重新生成失败：" + (e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }, [reload]);

  const migrateLegacy = useCallback(async () => {
    setMigrating(true);
    try {
      const target = getPublicOrigin();
      const scan = await scanLegacyUrls(target);
      if (scan.total === 0) {
        toast.success("未发现旧域名残留");
        return;
      }
      const ok = window.confirm(
        `扫描到 ${scan.total} 条旧域名记录，是否全部迁移到 ${target} ?`,
      );
      if (!ok) return;
      const res = await rewriteLegacyUrls(target);
      if (res.failed > 0) {
        toast.warning(`迁移完成：成功 ${res.updated}，失败 ${res.failed}`);
        console.warn("[QrInspector] migrate errors:", res.errors);
      } else {
        toast.success(`迁移完成：共更新 ${res.updated} 条`);
      }
      await reload();
    } catch (e) {
      toast.error("迁移失败：" + (e as Error).message);
    } finally {
      setMigrating(false);
    }
  }, [reload]);

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-xl p-5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">统一二维码检查</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            正式域名：<code className="text-[11px]">{origin}</code>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" className="rounded-full" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={regenerateAll} disabled={regenerating}>
            <RotateCw className={`w-4 h-4 mr-1.5 ${regenerating ? "animate-spin" : ""}`} /> 重新生成全部二维码
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={migrateLegacy} disabled={migrating}>
            {migrating ? "迁移中…" : "一键扫描并迁移旧域名"}
          </Button>
          <Button size="sm" className="rounded-full" onClick={checkAll} disabled={loading || items.length === 0}>
            <ShieldCheck className="w-4 h-4 mr-1.5" /> 一键检查全部
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 加载中…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">暂无二维码</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const st = statuses[it.id];
            return (
              <div key={it.id} className="rounded-xl border border-border/60 px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span>{it.name}</span>
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                      {it.source}
                    </span>
                  </div>
                  <code className="block text-[11px] text-muted-foreground mt-0.5 truncate">{it.url}</code>
                  <div className="text-xs mt-1">
                    {st?.checking ? (
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> 检测中…
                      </span>
                    ) : st ? (
                      <span className={
                        st.level === "ok" ? "text-[#1f7a3a]"
                        : st.level === "warn" ? "text-[#a86c00]"
                        : st.level === "fail" ? "text-[#c0392b]"
                        : "text-muted-foreground"
                      }>
                        {st.label}{st.detail ? ` · ${st.detail}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">⚪ 未检测</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-full"
                    onClick={() => window.open(it.url, "_blank", "noopener")}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> 测试
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => checkOne(it)}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> 检查
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
