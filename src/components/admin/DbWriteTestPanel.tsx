import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type LatestRow = { id: string; name: string; phone: string | null; source: string; created_at: string };

export function DbWriteTestPanel() {
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<LatestRow | null>(null);
  const [log, setLog] = useState<string>("");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  async function runTest() {
    setBusy(true);
    setLog("");
    const payload = {
      name: "测试录入",
      phone: "0000000000",
      source: "系统测试",
    };
    const lines: string[] = [];
    lines.push(`[配置] Supabase URL: ${supabaseUrl}`);
    lines.push(`[配置] 目标表: registrations`);
    lines.push(`[请求] payload: ${JSON.stringify(payload)}`);
    console.log("[DbWriteTest]", { supabaseUrl, table: "registrations", payload });

    const { data, error } = await supabase
      .from("registrations")
      .insert(payload as never)
      .select();

    console.log("[DbWriteTest] data:", data, "error:", error);
    lines.push(`[响应] data: ${JSON.stringify(data)}`);
    lines.push(`[响应] error: ${JSON.stringify(error)}`);

    if (error) {
      const parts = [
        `message: ${error.message}`,
        error.code ? `code: ${error.code}` : "",
        error.details ? `details: ${error.details}` : "",
        error.hint ? `hint: ${error.hint}` : "",
      ].filter(Boolean).join(" | ");
      toast.error(`写入失败 — ${parts}`, { duration: 15000 });
      setLog(lines.join("\n"));
      setBusy(false);
      return;
    }

    toast.success("写入成功，正在读取最新一条…");

    const { data: read, error: readErr } = await supabase
      .from("registrations")
      .select("id, name, phone, source, created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("[DbWriteTest] read:", read, "readErr:", readErr);
    lines.push(`[读取] data: ${JSON.stringify(read)}`);
    lines.push(`[读取] error: ${JSON.stringify(readErr)}`);

    if (readErr) {
      toast.error(`读取失败 — ${readErr.message}（可能未登录管理员账号，被 RLS 拦截）`, { duration: 15000 });
    } else if (read && read.length > 0) {
      setLatest(read[0] as LatestRow);
    }
    setLog(lines.join("\n"));
    setBusy(false);
  }

  return (
    <section className="bg-card border border-amber-500/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-xl">🔧 数据库写入测试</h2>
          <p className="text-xs text-muted-foreground mt-1">
            向 <code>registrations</code> 表插入一条测试数据并立即读取最新一条，用于诊断写入/RLS问题。
          </p>
        </div>
        <Button onClick={runTest} disabled={busy} variant="default">
          {busy ? "测试中…" : "运行写入测试"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">
        Supabase URL：<code>{supabaseUrl}</code>
      </div>

      {latest && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 text-sm">
          <div className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">✓ 最新一条记录</div>
          <div>id: <code>{latest.id}</code></div>
          <div>姓名: {latest.name}</div>
          <div>电话: {latest.phone ?? "(空)"}</div>
          <div>来源: {latest.source}</div>
          <div>时间: {new Date(latest.created_at).toLocaleString()}</div>
        </div>
      )}

      {log && (
        <pre className="bg-muted/40 border border-border/50 rounded-md p-3 text-[11px] leading-relaxed whitespace-pre-wrap overflow-auto max-h-72">
{log}
        </pre>
      )}
    </section>
  );
}
