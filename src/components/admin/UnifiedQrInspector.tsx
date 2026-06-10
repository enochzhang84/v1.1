import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { getPublicOrigin } from "@/lib/public-origin";

/**
 * 统一二维码检查面板（只新增，不影响已有二维码组件）。
 * 核心四项：① 二维码名称  ② 状态检测 🟢/🔴/🟡  ③ 测试二维码  ④ 检查二维码
 */

type QrLevel = "ok" | "warn" | "fail" | "unknown";

type QrItem = {
  id: string;
  name: string;
  url: string;
  source: string; // 来源说明
};

type QrStatus = {
  level: QrLevel;
  label: string;
  detail?: string;
  checking?: boolean;
};

function dot(level: QrLevel) {
  if (level === "ok") return "🟢";
  if (level === "warn") return "🟡";
  if (level === "fail") return "🔴";
  return "⚪";
}

async function probe(url: string, currentOrigin: string): Promise<QrStatus> {
  if (!url || url.includes("undefined") || url.trim() === "") {
    return { level: "fail", label: "🔴 链接为空 / 无效" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { level: "fail", label: "🔴 链接格式错误" };
  }

  const sameOrigin = parsed.origin === currentOrigin;

  try {
    // 跨域时只能 no-cors 探测，无法读状态码 → 标 🟡
    if (!sameOrigin) {
      await fetch(url, { method: "GET", mode: "no-cors" });
      return {
        level: "warn",
        label: "🟡 跨域链接（无法读取状态码）",
        detail: `二维码指向 ${parsed.origin}，与当前站点 ${currentOrigin} 不一致`,
      };
    }
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    if (res.status === 404) return { level: "fail", label: "🔴 页面不存在（404）" };
    if (res.status >= 500) return { level: "fail", label: `🔴 页面错误（${res.status}）` };
    if (res.status === 401 || res.status === 403)
      return { level: "warn", label: "🟡 需要登录" };
    if (res.status >= 200 && res.status < 400)
      return { level: "ok", label: "🟢 正常访问", detail: `HTTP ${res.status}` };
    return { level: "warn", label: `🟡 状态 ${res.status}` };
  } catch (e) {
    return { level: "fail", label: "🔴 无法访问", detail: (e as Error).message };
  }
}

export function UnifiedQrInspector() {
  const [items, setItems] = useState<QrItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, QrStatus>>({});
  const [loading, setLoading] = useState(true);
  const origin = getPublicOrigin();

  const reload = useCallback(async () => {
    setLoading(true);
    const list: QrItem[] = [];

    // 主页设置中的二维码
    const { data: home } = await (supabase as any)
      .from("home_page_settings")
      .select("qr_newcomer_url, qr_retreat_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    list.push({
      id: "newcomer",
      name: "新人登记二维码",
      url: home?.qr_newcomer_url?.trim() || `${origin}/register`,
      source: home?.qr_newcomer_url ? "主页设置" : "系统默认",
    });
    list.push({
      id: "retreat",
      name: "退修会登记二维码",
      url: home?.qr_retreat_url?.trim() || `${origin}/retreat-register`,
      source: home?.qr_retreat_url ? "主页设置" : "系统默认",
    });
    list.push({
      id: "sunday",
      name: "主日学签到二维码",
      url: `${origin}/sunday-checkin`,
      source: "系统默认",
    });
    list.push({
      id: "fellowship",
      name: "团契签到二维码",
      url: `${origin}/fellowship-checkin`,
      source: "系统默认",
    });

    // qr_library 自定义二维码
    try {
      const { data: lib } = await (supabase as any)
        .from("qr_library")
        .select("id, name, url")
        .order("created_at", { ascending: false });
      (lib ?? []).forEach((r: { id: string; name: string; url: string }) => {
        if (r.url) {
          list.push({
            id: `lib:${r.id}`,
            name: r.name || "自定义二维码",
            url: r.url,
            source: "自定义二维码库",
          });
        }
      });
    } catch {
      // 表不存在时忽略
    }

    setItems(list);
    setStatuses({});
    setLoading(false);
  }, [origin]);

  useEffect(() => {
    reload();
  }, [reload]);

  const checkOne = useCallback(
    async (item: QrItem) => {
      setStatuses((s) => ({ ...s, [item.id]: { level: "unknown", label: "检测中…", checking: true } }));
      const st = await probe(item.url, origin);
      setStatuses((s) => ({ ...s, [item.id]: st }));
    },
    [origin],
  );

  const checkAll = useCallback(async () => {
    for (const it of items) await checkOne(it);
  }, [items, checkOne]);

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-xl p-5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold">统一二维码检查</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            当前站点：<code className="text-[11px]">{origin}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="rounded-full" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> 刷新列表
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
              <div
                key={it.id}
                className="rounded-xl border border-border/60 px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span>{it.name}</span>
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                      {it.source}
                    </span>
                  </div>
                  <code className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                    {it.url}
                  </code>
                  <div className="text-xs mt-1">
                    {st?.checking ? (
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> 检测中…
                      </span>
                    ) : st ? (
                      <span
                        className={
                          st.level === "ok"
                            ? "text-[#1f7a3a]"
                            : st.level === "warn"
                            ? "text-[#a86c00]"
                            : st.level === "fail"
                            ? "text-[#c0392b]"
                            : "text-muted-foreground"
                        }
                      >
                        {st.label}
                        {st.detail ? ` · ${st.detail}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {dot("unknown")} 未检测
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => window.open(it.url, "_blank", "noopener")}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> 测试
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => checkOne(it)}
                  >
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
