import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, QrCode, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";
import { runQrInsertTest } from "@/lib/qr-health.functions";

/** Front-end uses this table to INSERT; admin list uses the same to SELECT. */
const FRONTEND_INSERT_TABLE = "registrations";
const ADMIN_READ_TABLE = "registrations";

type Level = "pass" | "warn" | "fail";

type QrItem = {
  source: string; // 来源说明
  name: string;
  url: string;
  expectedPath?: string; // 如 /register；缺省则不检查路径
};

type QrCheckResult = QrItem & {
  level: Level;
  reasons: string[];
  httpStatus?: number | null;
  qrHost: string;
  currentHost: string;
};

function statusIcon(level: Level) {
  if (level === "pass") return <CheckCircle2 className="w-4 h-4 text-[#1f7a3a]" />;
  if (level === "warn") return <AlertTriangle className="w-4 h-4 text-[#a86c00]" />;
  return <XCircle className="w-4 h-4 text-[#c0392b]" />;
}

function levelBg(level: Level) {
  return level === "pass" ? "#f1faf3" : level === "warn" ? "#fff8e6" : "#fff1f0";
}

function levelLabel(level: Level) {
  return level === "pass" ? "PASS" : level === "warn" ? "WARN" : "FAIL";
}

/** PASS 条件：二维码域名 == 当前项目域名。
 *  FAIL 条件：空 / undefined / URL 非法 / 域名不一致 / 路径不符 / HTTP 不可达。
 *  不再因为出现 lovable.app 就直接 FAIL — 仅以「是否等于当前站点域名」为准。 */
function classifyUrl(
  url: string,
  currentOrigin: string,
  expectedPath?: string,
): { level: Level; reasons: string[]; qrHost: string; currentHost: string } {
  const reasons: string[] = [];
  const currentHost = (() => {
    try { return new URL(currentOrigin).host.toLowerCase(); } catch { return ""; }
  })();

  if (!url || !url.trim()) {
    return { level: "fail", reasons: ["空链接"], qrHost: "", currentHost };
  }
  if (/undefined|null/i.test(url)) reasons.push("URL 包含 undefined / null");

  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return { level: "fail", reasons: ["URL 格式无效"], qrHost: "", currentHost };
  }
  const host = parsed.host.toLowerCase();

  if (expectedPath && !parsed.pathname.startsWith(expectedPath)) {
    reasons.push(`路径应为 ${expectedPath}`);
  }
  if (currentHost && host !== currentHost) {
    reasons.push(`域名不一致：二维码 ${host} ≠ 当前 ${currentHost}`);
  }

  if (reasons.length > 0) return { level: "fail", reasons, qrHost: host, currentHost };
  return { level: "pass", reasons: [], qrHost: host, currentHost };
}

type ProbeResult = { reachable: boolean; status: number | null; restricted: boolean; note?: string };

async function probeUrl(url: string, currentOrigin: string): Promise<ProbeResult> {
  if (!url) return { reachable: false, status: null, restricted: false, note: "空链接" };
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { reachable: false, status: null, restricted: false, note: "URL 无效" }; }
  const sameOrigin = parsed.origin === currentOrigin;
  if (sameOrigin) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      // 200-399 视为可达；401/403 也视为「页面存在」（公开页本身不应 401，但 fetch 可能携带 cookie 触发跳转）
      return { reachable: res.status < 500, status: res.status, restricted: false };
    } catch (e) {
      return { reachable: false, status: null, restricted: false, note: (e as Error).message };
    }
  }
  // 跨域：no-cors 拿不到状态码，只能判断「网络层是否通」。
  try {
    await fetch(url, { method: "GET", mode: "no-cors" });
    return { reachable: true, status: null, restricted: true, note: "跨域，仅能验证网络可达" };
  } catch (e) {
    return { reachable: false, status: null, restricted: true, note: "跨域 + 网络失败：" + (e as Error).message };
  }
}


export function QrHealthCheckPanel() {
  const insertTestFn = useServerFn(runQrInsertTest);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<null | {
    generatedAt: string;
    origin: string;
    domain: { authBaseUrl: string | null; siteUrl: string; authRedirect: string };
    qrs: QrCheckResult[];
    sync: { frontTable: string; backTable: string; match: boolean };
    insertTest: { insertOk: boolean; readOk: boolean; deleteOk: boolean; error: string | null };
    summary: {
      domain: Level;
      qr: Level;
      db: Level;
      sync: Level;
      overall: Level;
    };
  }>(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const origin = getPublicOrigin();

      // ----- 1. 域名相关 -----
      const { data: settingsRows } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ["auth_base_url"]);
      const authBaseUrl =
        (settingsRows ?? []).find((r) => r.key === "auth_base_url")?.value || null;

      // ----- 2. 收集所有二维码 -----
      const items: QrItem[] = [];

      // 主页配置中的二维码字段
      const { data: home } = await supabase
        .from("home_page_settings")
        .select("qr_newcomer_url, qr_retreat_url")
        .limit(1)
        .maybeSingle();
      items.push({
        source: "主页配置",
        name: "新人登记二维码",
        url: home?.qr_newcomer_url?.trim() || `${origin}/register`,
        expectedPath: "/register",
      });
      items.push({
        source: "主页配置",
        name: "退修会二维码",
        url: home?.qr_retreat_url?.trim() || `${origin}/retreat-register`,
        expectedPath: "/retreat-register",
      });

      // 系统内置（动态）二维码
      items.push({
        source: "系统内置",
        name: "主日学签到二维码",
        url: `${origin}/sunday-checkin`,
        expectedPath: "/sunday-checkin",
      });
      items.push({
        source: "系统内置",
        name: "团契签到二维码",
        url: `${origin}/fellowship-checkin`,
        expectedPath: "/fellowship-checkin",
      });

      // qr_library 自定义二维码
      const { data: libRows } = await supabase
        .from("qr_library")
        .select("name, target_url, usage_type");
      for (const r of (libRows ?? []) as Array<{
        name: string;
        target_url: string | null;
        usage_type: string | null;
      }>) {
        items.push({
          source: `自定义 / ${r.usage_type ?? "qr_library"}`,
          name: r.name || "(未命名)",
          url: r.target_url ?? "",
        });
      }

      // ----- 3. 分类 + HTTP 探测 -----
      const qrs: QrCheckResult[] = await Promise.all(
        items.map(async (it) => {
          const cls = classifyUrl(it.url, origin, it.expectedPath);
          let httpStatus: number | null = null;
          if (cls.level !== "fail" && it.url) {
            const probe = await probeUrl(it.url, origin);
            httpStatus = probe.status;
            if (!probe.reachable) {
              cls.reasons.push(probe.note || "HTTP 请求失败 / 不可达");
              cls.level = "fail";
            } else if (probe.restricted) {
              // 跨域检测受限：不算失败，仅提示
              cls.reasons.push("检测受限（跨域，无法读取状态码）— 请使用「打开测试」验证");
              if (cls.level === "pass") cls.level = "warn";
            }
          }
          return { ...it, ...cls, httpStatus };
        }),
      );

      // ----- 4. INSERT 测试（可选，未授权时跳过而不是 FAIL） -----
      const insertTest = await insertTestFn().catch((e: Error) => ({
        insertOk: false,
        readOk: false,
        deleteOk: false,
        insertedId: null,
        error: /Unauthorized|No authorization/i.test(e.message)
          ? "已跳过（当前会话未授权，公开页面无需此检查）"
          : e.message,
        skipped: /Unauthorized|No authorization/i.test(e.message),
      })) as { insertOk: boolean; readOk: boolean; deleteOk: boolean; insertedId: string | null; error: string | null; skipped?: boolean };


      // ----- 5. 同步检查 -----
      const sync = {
        frontTable: FRONTEND_INSERT_TABLE,
        backTable: ADMIN_READ_TABLE,
        match: FRONTEND_INSERT_TABLE === ADMIN_READ_TABLE,
      };

      // ----- 6. 汇总 -----
      const qrLevel: Level = qrs.some((q) => q.level === "fail")
        ? "fail"
        : qrs.some((q) => q.level === "warn")
          ? "warn"
          : "pass";
      const domainLevel: Level = origin && /^https?:\/\//.test(origin) ? "pass" : "fail";
      const dbLevel: Level = insertTest.skipped
        ? "warn"
        : insertTest.insertOk && insertTest.readOk && insertTest.deleteOk ? "pass" : "fail";
      const syncLevel: Level = sync.match ? "pass" : "fail";
      const overall: Level =
        [qrLevel, domainLevel, dbLevel, syncLevel].includes("fail")
          ? "fail"
          : [qrLevel, domainLevel, dbLevel, syncLevel].includes("warn")
            ? "warn"
            : "pass";

      setReport({
        generatedAt: new Date().toISOString(),
        origin,
        domain: {
          authBaseUrl,
          siteUrl: origin,
          authRedirect: `${origin}/reset-password`,
        },
        qrs,
        sync,
        insertTest: {
          insertOk: insertTest.insertOk,
          readOk: insertTest.readOk,
          deleteOk: insertTest.deleteOk,
          error: insertTest.error,
        },
        summary: { domain: domainLevel, qr: qrLevel, db: dbLevel, sync: syncLevel, overall },
      });
    } finally {
      setRunning(false);
    }
  }, [insertTestFn]);

  return (
    <div
      className="rounded-2xl bg-white/85 backdrop-blur-xl p-5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#34c759]" />
          <h3 className="text-sm font-semibold">二维码健康检查</h3>
        </div>
        <Button
          onClick={run}
          disabled={running}
          className="rounded-full px-5 h-9 bg-[#34c759] hover:bg-[#28a745] text-white"
        >
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          {running ? "检测中…" : "开始二维码自检"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        检查域名 / 所有二维码 / 数据库写入 / 前后台表名一致性，并生成最终报告。
      </p>

      {!report && !running && (
        <div className="text-sm text-muted-foreground py-8 text-center">点击右上「开始二维码自检」执行检查。</div>
      )}

      {report && (
        <div className="space-y-5">
          {/* 最终报告卡 */}
          <div
            className="rounded-xl p-4"
            style={{
              background: levelBg(report.summary.overall),
              border:
                report.summary.overall === "fail"
                  ? "1px solid #ffd6d3"
                  : report.summary.overall === "warn"
                    ? "1px solid #ffe2a8"
                    : "1px solid #c8eed1",
            }}
          >
            <div className="text-xs text-muted-foreground mb-1">最终报告</div>
            <div className="flex items-center gap-2 text-lg font-bold">
              {statusIcon(report.summary.overall)}
              {report.summary.overall === "pass"
                ? "✅ 可以上线"
                : report.summary.overall === "warn"
                  ? "⚠ 上线前建议复查"
                  : "❌ 不建议上线"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              <div>域名状态: <b>{levelLabel(report.summary.domain)}</b></div>
              <div>二维码状态: <b>{levelLabel(report.summary.qr)}</b></div>
              <div>数据库状态: <b>{levelLabel(report.summary.db)}</b></div>
              <div>后台同步: <b>{levelLabel(report.summary.sync)}</b></div>
            </div>
          </div>

          {/* 域名检查 */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">【1】域名检查</div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-[#f5f5f7] px-3 py-2">
                <div className="text-xs text-muted-foreground">当前 Site URL</div>
                <div className="break-all font-medium">{report.origin}</div>
              </div>
              <div className="rounded-xl bg-[#f5f5f7] px-3 py-2">
                <div className="text-xs text-muted-foreground">Auth Base URL (app_settings)</div>
                <div className="break-all font-medium">
                  {report.domain.authBaseUrl || <span className="text-[#c0392b]">✗ 未设置</span>}
                </div>
              </div>
              <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Auth Redirect URL</div>
                <div className="break-all font-medium">{report.domain.authRedirect}</div>
              </div>
            </div>
          </div>

          {/* 二维码列表 */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              【2】二维码检查（共 {report.qrs.length} 个）
            </div>
            <div className="space-y-2">
              {report.qrs.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{ background: levelBg(q.level) }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 font-medium">
                      {statusIcon(q.level)}
                      <span>{q.name}</span>
                      <span className="text-xs text-muted-foreground">[{q.source}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">
                        {levelLabel(q.level)}
                        {q.httpStatus != null && <span className="ml-1 text-muted-foreground">HTTP {q.httpStatus}</span>}
                      </span>
                      {q.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-7 px-3 text-xs"
                          onClick={() => window.open(q.url, "_blank", "noopener")}
                        >
                          打开测试
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground break-all mt-1">{q.url || "(空)"}</div>
                  <div className="text-xs mt-1 grid sm:grid-cols-3 gap-x-3">
                    <div>当前项目域名: <b>{q.currentHost || "-"}</b></div>
                    <div>二维码域名: <b>{q.qrHost || "-"}</b></div>
                    <div>
                      是否一致:{" "}
                      <b className={q.qrHost && q.currentHost && q.qrHost === q.currentHost ? "text-[#1f7a3a]" : "text-[#c0392b]"}>
                        {q.qrHost && q.currentHost && q.qrHost === q.currentHost ? "是" : "否"}
                      </b>
                    </div>
                  </div>
                  {q.reasons.length > 0 && (
                    <ul className="text-xs text-[#c0392b] mt-1 list-disc pl-5">
                      {q.reasons.map((r, j) => (<li key={j}>{r}</li>))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 数据库 + 同步 */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f5f5f7] p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">【3】数据库写入测试</div>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  {report.insertTest.insertOk ? statusIcon("pass") : statusIcon("fail")}
                  INSERT (QR_TEST / 9999999999)
                </li>
                <li className="flex items-center gap-2">
                  {report.insertTest.readOk ? statusIcon("pass") : statusIcon("fail")}
                  读取回写记录
                </li>
                <li className="flex items-center gap-2">
                  {report.insertTest.deleteOk ? statusIcon("pass") : statusIcon("fail")}
                  自动清理测试记录
                </li>
                {report.insertTest.error && (
                  <li className="text-xs text-[#c0392b] break-all">{report.insertTest.error}</li>
                )}
              </ul>
            </div>
            <div className="rounded-xl bg-[#f5f5f7] p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">【4】前后台同步检查</div>
              <ul className="space-y-1 text-sm">
                <li>前台写入表：<b>{report.sync.frontTable}</b></li>
                <li>后台读取表：<b>{report.sync.backTable}</b></li>
                <li className="flex items-center gap-2">
                  {report.sync.match ? statusIcon("pass") : statusIcon("fail")}
                  {report.sync.match ? "表名一致" : "ERROR: 表名不一致"}
                </li>
              </ul>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground text-right">
            生成时间：{new Date(report.generatedAt).toLocaleString("zh-CN", { hour12: false })}
          </div>
        </div>
      )}
    </div>
  );
}
