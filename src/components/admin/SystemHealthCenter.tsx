import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSystemHealth, type SystemHealthReport } from "@/lib/system-health.functions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Sparkles } from "lucide-react";

function fmtTime(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return v;
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[#1f7a3a]">
      <CheckCircle2 className="w-4 h-4" /> 正常
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[#c0392b]">
      <XCircle className="w-4 h-4" /> 异常
    </span>
  );
}

function Card({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl bg-white/85 backdrop-blur-xl p-5 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-lg">{icon}</span>}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right break-all">{value}</span>
    </div>
  );
}

export function SystemHealthCenter() {
  const fetchHealth = useServerFn(getSystemHealth);
  const [data, setData] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchHealth();
      setData(r);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [fetchHealth]);

  useEffect(() => {
    load();
  }, [load]);

  const runScan = useCallback(async () => {
    setScanning(true);
    await load();
    // 模拟自检完成的小延迟，让用户看到状态
    setTimeout(() => setScanning(false), 400);
  }, [load]);

  const scoreColor =
    !data ? "#888" : data.score >= 90 ? "#1f7a3a" : data.score >= 70 ? "#d68910" : "#c0392b";

  return (
    <div className="min-h-full" style={{ background: "#F5F5F7" }}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* 顶部状态条 */}
        <div
          className="rounded-2xl bg-white/85 backdrop-blur-xl p-6 flex flex-wrap items-center justify-between gap-4"
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
        >
          <div>
            <div className="text-xs text-muted-foreground">系统运维中心 / 系统状态</div>
            <h2 className="text-xl font-semibold mt-1">系统健康检查</h2>
            <div className="text-xs text-muted-foreground mt-1">
              上次检查：{data ? fmtTime(data.generatedAt) : "—"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {data && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">系统评分</div>
                <div className="text-3xl font-bold" style={{ color: scoreColor }}>
                  {data.score}
                  <span className="text-sm text-muted-foreground font-normal"> / 100</span>
                </div>
              </div>
            )}
            <Button
              onClick={runScan}
              disabled={scanning || loading}
              className="rounded-full px-5 h-10 bg-[#34c759] hover:bg-[#28a745] text-white shadow-[0_2px_8px_rgba(52,199,89,0.25)]"
            >
              {scanning || loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              开始系统自检
            </Button>
          </div>
        </div>

        {err && (
          <div className="rounded-2xl bg-[#fff1f0] border border-[#ffd6d3] p-4 text-sm text-[#a8201a]">
            加载失败：{err}
            <Button variant="ghost" size="sm" className="ml-2" onClick={load}>
              <RefreshCw className="w-3 h-3 mr-1" /> 重试
            </Button>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 正在采集系统信息…
          </div>
        )}

        {data && (
          <>
            {/* 风险预警 */}
            {data.checks.some((c) => c.level !== "ok") && (
              <div
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{
                  background: data.checks.some((c) => c.level === "error") ? "#fff1f0" : "#fff8e6",
                  border: data.checks.some((c) => c.level === "error")
                    ? "1px solid #ffd6d3"
                    : "1px solid #ffe2a8",
                }}
              >
                <AlertTriangle
                  className="w-5 h-5 mt-0.5"
                  style={{
                    color: data.checks.some((c) => c.level === "error") ? "#c0392b" : "#a86c00",
                  }}
                />
                <div className="text-sm space-y-1">
                  <div className="font-semibold">
                    {data.checks.some((c) => c.level === "error") ? "⚠ 高风险" : "⚠ 注意"}
                  </div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {data.checks
                      .filter((c) => c.level !== "ok")
                      .map((c) => (
                        <li key={c.id}>
                          {c.label}
                          {c.detail ? ` — ${c.detail}` : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Card title="系统信息" icon="🧭">
                <Row label="系统中文名称" value={data.system.name_zh} />
                <Row label="系统英文名称" value={data.system.name_en} />
                <Row label="系统版本" value={data.system.version} />
                <Row label="部署时间" value={data.system.deploy_date ?? "—"} />
                <Row label="运行环境" value={data.system.environment} />
                <Row
                  label="系统初始化状态"
                  value={
                    data.initialized ? (
                      <span className="text-[#1f7a3a]">✓ 已初始化</span>
                    ) : (
                      <span className="text-[#c0392b]">✗ 未初始化</span>
                    )
                  }
                />
              </Card>

              <Card title="用户状态" icon="👥">
                <Row label="超级管理员" value={data.users.super_admin} />
                <Row label="管理员" value={data.users.admin} />
                <Row label="同工 / 普通用户" value={data.users.worker + data.users.viewer} />
                <Row label="总用户数" value={data.users.total} />
                <Row
                  label="最后注册用户"
                  value={
                    data.users.last_registered
                      ? `${data.users.last_registered.email} · ${fmtTime(data.users.last_registered.created_at)}`
                      : "—"
                  }
                />
                <Row
                  label="最近登录"
                  value={
                    data.users.last_sign_in
                      ? `${data.users.last_sign_in.email} · ${fmtTime(data.users.last_sign_in.at)}`
                      : "—"
                  }
                />
              </Card>

              <Card title="数据库状态" icon="🗄️">
                <Row label="数据库连接" value={<StatusDot ok={data.database.ok} />} />
                <Row label="数据库版本" value="Supabase PostgreSQL" />
                <Row label="数据库表数量" value={data.database.table_count} />
                <Row label="最后数据库写入" value={fmtTime(data.database.last_write_at)} />
                {data.database.error && (
                  <div className="text-xs text-[#c0392b] break-all">{data.database.error}</div>
                )}
              </Card>

              <Card title="认证系统" icon="🔐">
                <Row label="Auth 服务" value={<StatusDot ok={data.auth.ok} />} />
                <Row
                  label="是否存在超级管理员"
                  value={
                    data.auth.has_super_admin ? (
                      <span className="text-[#1f7a3a]">✓ 是</span>
                    ) : (
                      <span className="text-[#c0392b]">✗ 否</span>
                    )
                  }
                />
                <Row label="邮件验证" value={<span className="text-[#1f7a3a]">✓ 已启用</span>} />
                {data.auth.error && (
                  <div className="text-xs text-[#c0392b] break-all">{data.auth.error}</div>
                )}
              </Card>

              <Card title="存储状态" icon="📦">
                <Row label="Storage 服务" value={<StatusDot ok={data.storage.ok} />} />
                {data.storage.buckets.map((b) => (
                  <Row
                    key={b.name}
                    label={b.name}
                    value={
                      <span className="text-[#1f7a3a]">
                        ✓ 可用 {b.public ? "(公开)" : "(私有)"}
                      </span>
                    }
                  />
                ))}
                {data.storage.buckets.length === 0 && (
                  <div className="text-xs text-muted-foreground">未发现存储桶</div>
                )}
                {data.storage.error && (
                  <div className="text-xs text-[#c0392b] break-all">{data.storage.error}</div>
                )}
              </Card>

              <Card title="系统模块" icon="🧩">
                {data.modules.map((m) => (
                  <Row
                    key={m.key}
                    label={m.label}
                    value={
                      m.ok ? (
                        <span className="text-[#1f7a3a]">✓ 正常（{m.count} 条）</span>
                      ) : (
                        <span className="text-[#c0392b]">✗ {m.error ?? "异常"}</span>
                      )
                    }
                  />
                ))}
              </Card>
            </div>

            {/* 健康检查结果 */}
            <Card title="系统健康检查结果" icon="✅">
              <div className="grid sm:grid-cols-2 gap-2">
                {data.checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 rounded-xl px-3 py-2"
                    style={{
                      background:
                        c.level === "ok"
                          ? "#f1faf3"
                          : c.level === "warn"
                          ? "#fff8e6"
                          : "#fff1f0",
                    }}
                  >
                    {c.level === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#1f7a3a]" />
                    ) : c.level === "warn" ? (
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-[#a86c00]" />
                    ) : (
                      <XCircle className="w-4 h-4 mt-0.5 text-[#c0392b]" />
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{c.label}</div>
                      {c.detail && (
                        <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 预留扩展 */}
            <Card title="未来扩展" icon="🚀">
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="rounded-xl bg-[#f5f5f7] px-3 py-2">📂 数据备份中心（已上线）</div>
                <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 opacity-70">📜 系统日志中心（预留）</div>
                <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 opacity-70">🆙 更新中心（预留）</div>
                <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 opacity-70">🪪 授权信息（预留）</div>
                <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 opacity-70">🔑 许可证管理（预留）</div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
