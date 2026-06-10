import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, FileSearch, Link2, FlaskConical, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";
import { useCurrentPermissions } from "@/hooks/useCurrentPermissions";
import {
  qrProbeUrl,
  qrFullTestRegistration,
  qrListLogs,
  type QrProbeResult,
  type QrSubmitTestResult,
  type QrLogRow,
} from "@/lib/qr-autotest.functions";

type QrItem = {
  source: string;
  name: string;
  url: string;
  isRegister?: boolean;
};

type Row = QrItem & {
  probing?: boolean;
  probe?: QrProbeResult;
  fullTesting?: boolean;
  fullTest?: QrSubmitTestResult;
};

function badge(status: "ok" | "warn" | "fail") {
  const map = {
    ok: { bg: "#f1faf3", color: "#1f7a3a", text: "🟢 正常" },
    warn: { bg: "#fff8e6", color: "#a86c00", text: "🟡 警告" },
    fail: { bg: "#fff1f0", color: "#c0392b", text: "🔴 失败" },
  } as const;
  const s = map[status];
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.text}
    </span>
  );
}

function rowStatus(r: Row): "ok" | "warn" | "fail" {
  if (!r.probe) return "warn";
  if (r.probe.detectedAuthRedirect) return "fail";
  if (!r.probe.ok) return "fail";
  if (r.fullTest && (!r.fullTest.insertOk || !r.fullTest.databaseInserted)) return "fail";
  if (r.probe.detectedDevHost) return "warn";
  if (r.fullTest && !r.fullTest.cleanedUp) return "warn";
  return "ok";
}

export function QrAutoTestPanel() {
  const probeFn = useServerFn(qrProbeUrl);
  const fullTestFn = useServerFn(qrFullTestRegistration);
  const listLogsFn = useServerFn(qrListLogs);
  const { isSuperAdmin } = useCurrentPermissions();

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [runningFull, setRunningFull] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<QrLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadQrList = useCallback(async () => {
    setLoadingList(true);
    try {
      const origin = getPublicOrigin();
      const items: QrItem[] = [];

      const { data: home } = await supabase
        .from("home_page_settings")
        .select("qr_newcomer_url, qr_retreat_url")
        .limit(1)
        .maybeSingle();
      items.push({
        source: "主页配置",
        name: "新人登记二维码",
        url: home?.qr_newcomer_url?.trim() || `${origin}/register`,
        isRegister: true,
      });
      items.push({
        source: "主页配置",
        name: "退修会二维码",
        url: home?.qr_retreat_url?.trim() || `${origin}/retreat-register`,
      });
      items.push({ source: "系统内置", name: "主日学签到二维码", url: `${origin}/sunday-checkin` });
      items.push({ source: "系统内置", name: "团契签到二维码", url: `${origin}/fellowship-checkin` });

      const { data: lib } = await supabase
        .from("qr_library")
        .select("name, target_url, usage_type");
      for (const r of (lib ?? []) as Array<{ name: string; target_url: string | null; usage_type: string | null }>) {
        items.push({
          source: `自定义 / ${r.usage_type ?? "qr_library"}`,
          name: r.name || "(未命名)",
          url: r.target_url ?? "",
        });
      }
      setRows(items.map((it) => ({ ...it })));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadQrList();
  }, [loadQrList]);

  const probeOne = useCallback(
    async (idx: number) => {
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, probing: true } : r)));
      try {
        const r = rows[idx];
        const probe = await probeFn({ data: { qrName: r.name, url: r.url } });
        setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, probe, probing: false } : x)));
        return probe;
      } catch (e) {
        setRows((rs) =>
          rs.map((x, i) =>
            i === idx
              ? {
                  ...x,
                  probing: false,
                  probe: {
                    ok: false,
                    httpStatus: null,
                    finalUrl: null,
                    redirected: false,
                    htmlSnippet: null,
                    detectedAuthRedirect: false,
                    detectedDevHost: false,
                    errorMessage: (e as Error).message,
                  },
                }
              : x,
          ),
        );
        return null;
      }
    },
    [rows, probeFn],
  );

  const probeAll = useCallback(async () => {
    setRunningAll(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        await probeOne(i);
      }
    } finally {
      setRunningAll(false);
    }
  }, [rows.length, probeOne]);

  const fullTestAll = useCallback(async () => {
    if (!isSuperAdmin) return;
    setRunningFull(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const probe = await probeOne(i);
        const r = rows[i];
        if (!r.isRegister) continue;
        if (!probe || !probe.ok) continue;
        setRows((rs) => rs.map((x, j) => (j === i ? { ...x, fullTesting: true } : x)));
        try {
          const fullTest = await fullTestFn({
            data: { qrName: r.name, qrUrl: r.url, htmlSnippet: probe.htmlSnippet },
          });
          setRows((rs) =>
            rs.map((x, j) => (j === i ? { ...x, fullTest, fullTesting: false } : x)),
          );
        } catch (e) {
          setRows((rs) =>
            rs.map((x, j) =>
              j === i
                ? {
                    ...x,
                    fullTesting: false,
                    fullTest: {
                      insertOk: false,
                      insertedId: null,
                      databaseInserted: false,
                      cleanedUp: false,
                      enteredFormPage: false,
                      error: (e as Error).message,
                    },
                  }
                : x,
            ),
          );
        }
      }
    } finally {
      setRunningFull(false);
    }
  }, [isSuperAdmin, rows, probeOne, fullTestFn]);

  const openLogs = useCallback(async () => {
    setShowLogs(true);
    setLogsLoading(true);
    try {
      const data = await listLogsFn();
      setLogs(data);
    } finally {
      setLogsLoading(false);
    }
  }, [listLogsFn]);

  return (
    <div
      className="rounded-2xl bg-white/85 backdrop-blur-xl p-5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#34c759]" />
          <h3 className="text-sm font-semibold">二维码自动检测工具</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadQrList}
            disabled={loadingList}
            className="rounded-full h-8"
          >
            {loadingList ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            刷新列表
          </Button>
          <Button
            size="sm"
            onClick={probeAll}
            disabled={runningAll || runningFull || rows.length === 0}
            className="rounded-full h-8 bg-[#0a84ff] hover:bg-[#0066cc] text-white"
          >
            {runningAll ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
            检测所有二维码（仅链接）
          </Button>
          {isSuperAdmin && (
            <Button
              size="sm"
              onClick={fullTestAll}
              disabled={runningAll || runningFull || rows.length === 0}
              className="rounded-full h-8 bg-[#34c759] hover:bg-[#28a745] text-white"
            >
              {runningFull ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
              完整检测（含提交测试数据）
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={openLogs}
            className="rounded-full h-8"
          >
            <FileSearch className="w-3 h-3 mr-1" />
            查看检测日志
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        自动探测二维码链接是否可达、是否跳转登录页；新人登记二维码可由超级管理员一键提交→入库回查→自动清理。
        {!isSuperAdmin && <span className="ml-1">（仅超级管理员可使用「完整检测」功能）</span>}
      </p>

      <div className="space-y-2">
        {rows.length === 0 && !loadingList && (
          <div className="text-sm text-muted-foreground py-8 text-center">未发现二维码</div>
        )}
        {rows.map((r, i) => {
          const status = rowStatus(r);
          return (
            <div
              key={i}
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: status === "ok" ? "#f5f5f7" : status === "warn" ? "#fff8e6" : "#fff1f0" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {badge(status)}
                    <span>{r.name}</span>
                    <span className="text-xs text-muted-foreground">[{r.source}]</span>
                    {r.isRegister && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e5f1ff] text-[#0a84ff]">登记页</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground break-all mt-1">{r.url || "(空)"}</div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full text-xs"
                    onClick={() => probeOne(i)}
                    disabled={r.probing || r.fullTesting}
                  >
                    {r.probing ? <Loader2 className="w-3 h-3 animate-spin" /> : "检测链接"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full text-xs"
                    onClick={() => window.open(r.url, "_blank")}
                  >
                    打开
                  </Button>
                </div>
              </div>
              {r.probe && (
                <div className="text-xs mt-2 grid sm:grid-cols-2 gap-x-3 gap-y-0.5">
                  <div>HTTP 状态: <b>{r.probe.httpStatus ?? "—"}</b></div>
                  <div>是否跳转: <b>{r.probe.redirected ? "是" : "否"}</b></div>
                  <div className="sm:col-span-2 break-all">
                    最终地址: <b>{r.probe.finalUrl || "—"}</b>
                  </div>
                  {r.probe.detectedAuthRedirect && (
                    <div className="sm:col-span-2 text-[#c0392b]">
                      ⚠ 检测到跳转至登录/认证页面，微信扫码可能进入登录界面。
                    </div>
                  )}
                  {r.probe.detectedDevHost && !r.probe.detectedAuthRedirect && (
                    <div className="sm:col-span-2 text-[#a86c00]">
                      ⚠ 二维码指向开发域名（lovable.app / lovableproject.com / localhost）。
                    </div>
                  )}
                  {r.probe.errorMessage && (
                    <div className="sm:col-span-2 text-[#c0392b]">错误：{r.probe.errorMessage}</div>
                  )}
                </div>
              )}
              {r.fullTest && (
                <div className="text-xs mt-2 grid sm:grid-cols-2 gap-x-3 gap-y-0.5 border-t pt-2">
                  <div>表单字段识别: <b>{r.fullTest.enteredFormPage ? "✓" : "✗"}</b></div>
                  <div>提交成功: <b>{r.fullTest.insertOk ? "✓" : "✗"}</b></div>
                  <div>数据库写入: <b>{r.fullTest.databaseInserted ? "✓" : "✗"}</b></div>
                  <div>
                    清理测试数据:{" "}
                    <b className={r.fullTest.cleanedUp ? "" : "text-[#c0392b]"}>
                      {r.fullTest.cleanedUp ? "✓" : "✗ 请管理员手动删除"}
                    </b>
                  </div>
                  {r.fullTest.error && (
                    <div className="sm:col-span-2 text-[#c0392b]">错误：{r.fullTest.error}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showLogs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLogs(false)}>
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">检测日志（最近 50 条）</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowLogs(false)}>关闭</Button>
            </div>
            {logsLoading ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">暂无日志</div>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: l.status === "ok" ? "#f1faf3" : l.status === "warn" ? "#fff8e6" : "#fff1f0" }}
                  >
                    <div className="flex justify-between flex-wrap gap-2">
                      <b>{l.qr_name}</b>
                      <span className="text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("zh-CN", { hour12: false })}
                      </span>
                    </div>
                    <div className="break-all text-muted-foreground">{l.qr_url}</div>
                    {l.final_url && l.final_url !== l.qr_url && (
                      <div className="break-all">→ {l.final_url}</div>
                    )}
                    <div className="mt-1">
                      状态:{" "}
                      <b
                        style={{
                          color:
                            l.status === "ok" ? "#1f7a3a" : l.status === "warn" ? "#a86c00" : "#c0392b",
                        }}
                      >
                        {l.status.toUpperCase()}
                      </b>
                      {l.http_status != null && <span className="ml-2">HTTP {l.http_status}</span>}
                      {l.submitted_successfully && <span className="ml-2">已提交</span>}
                      {l.database_inserted && <span className="ml-2">已入库</span>}
                      {l.test_record_id && !l.cleaned_up && (
                        <span className="ml-2 text-[#c0392b]">未清理</span>
                      )}
                    </div>
                    {l.error_message && <div className="text-[#c0392b] mt-1">{l.error_message}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
