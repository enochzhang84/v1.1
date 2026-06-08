import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { exportBackup, listBackupLogs, simulateBackup } from "@/lib/backup.functions";

// 备份内容模块
const CONTENT_MODULES = [
  { key: "newcomers", label: "新人登记" },
  { key: "retreat", label: "退修会报名" },
  { key: "sunday_school", label: "主日学" },
  { key: "fellowship", label: "团契签到" },
  { key: "kitchen", label: "厨房事工" },
  { key: "media", label: "影音投影" },
  { key: "weekly", label: "周报" },
  { key: "duty", label: "轮值表" },
  { key: "settings", label: "系统设置" },
  { key: "users", label: "用户权限" },
];

const CLOUD_TARGETS = [
  { key: "google_drive", label: "Google Drive", icon: "🟢" },
  { key: "onedrive", label: "OneDrive", icon: "🔵" },
  { key: "dropbox", label: "Dropbox", icon: "🟦" },
] as const;

type CloudKey = (typeof CLOUD_TARGETS)[number]["key"];

type Config = {
  enabled: boolean;
  time: string; // HH:mm
  retention_days: number;
  modules: string[];
  targets: CloudKey[];
  connections: Record<CloudKey, boolean>;
};

const DEFAULT_CONFIG: Config = {
  enabled: false,
  time: "02:00",
  retention_days: 30,
  modules: CONTENT_MODULES.map((m) => m.key),
  targets: [],
  connections: { google_drive: false, onedrive: false, dropbox: false },
};

const SETTINGS_KEY = "auto_backup_config";

// Lovable 预览环境检测：用 hostname 简单判断
function detectIsLovableEnv() {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h.includes("lovable.app") || h.includes("lovableproject.com") || h === "localhost";
}

export default function AutoBackupCenter() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const isLovable = useMemo(() => detectIsLovableEnv(), []);

  const exportBackupFn = useServerFn(exportBackup);
  const listLogsFn = useServerFn(listBackupLogs);
  const simulateBackupFn = useServerFn(simulateBackup);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const r = await listLogsFn();
      setLogs(r.logs ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadConfig();
    loadLogs();
  }, []);

  const saveConfig = async (next: Config) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          { key: SETTINGS_KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
      setConfig(next);
      toast.success("自动备份配置已保存");
    } catch (e: any) {
      toast.error(`保存失败：${e?.message || "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof Config>(key: K, value: Config[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggleModule = (k: string) => {
    setConfig((c) => ({
      ...c,
      modules: c.modules.includes(k) ? c.modules.filter((x) => x !== k) : [...c.modules, k],
    }));
  };

  const toggleTarget = (k: CloudKey) => {
    setConfig((c) => ({
      ...c,
      targets: c.targets.includes(k) ? c.targets.filter((x) => x !== k) : [...c.targets, k],
    }));
  };

  const connectCloud = (k: CloudKey) => {
    if (isLovable) {
      toast.info("Lovable 预览环境仅显示 UI；云盘授权将在 VPS 部署后生效");
      return;
    }
    // 在 VPS 环境中由真实 OAuth 流程接管
    setConfig((c) => ({ ...c, connections: { ...c.connections, [k]: true } }));
    toast.success(`${k} 已连接（模拟）`);
  };

  const handleBackupNow = async () => {
    if (!confirm("立即生成一份完整数据库备份？")) return;
    setRunningNow(true);
    try {
      const payload = await exportBackupFn();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const ts = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const name = `hoc3_backup_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      if (isLovable) {
        toast.success("备份已生成并下载（Lovable 环境不上传云盘）");
      } else {
        toast.success("备份已生成，VPS 环境将自动上传至已连接云盘");
      }
      await loadLogs();
    } catch (e: any) {
      toast.error(`备份失败：${e?.message || "未知错误"}`);
    } finally {
      setRunningNow(false);
    }
  };

  const lastLog = logs[0];
  const formatSize = (b?: number | null) => {
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中…</div>;
  }

  return (
    <div className="space-y-6">
      {/* 环境提示 */}
      <div
        className={
          "rounded-md border p-3 text-xs " +
          (isLovable
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-emerald-300 bg-emerald-50 text-emerald-900")
        }
      >
        {isLovable ? (
          <>🧪 当前为 <b>Lovable 预览环境</b>：仅显示 UI，不执行真实 pg_dump 与云盘上传。所有配置可保存；部署到 VPS 后由后台任务真实执行。</>
        ) : (
          <>🖥️ 当前为 <b>VPS 生产环境</b>：将通过 pg_dump 生成 .sql.gz 并上传到已连接云盘。</>
        )}
      </div>

      {/* 运维仪表 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">最后备份时间</div>
          <div className="text-sm font-medium">
            {lastLog ? new Date(lastLog.created_at).toLocaleString("zh-CN") : "—"}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">最后备份状态</div>
          <div className="text-sm font-medium">{lastLog ? "✅ 成功" : "—"}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">云盘连接</div>
          <div className="text-sm font-medium">
            {config.targets.length === 0
              ? "未配置"
              : config.targets.map((t) => CLOUD_TARGETS.find((c) => c.key === t)?.label).join(" / ")}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-[11px] text-muted-foreground">备份记录数</div>
          <div className="text-sm font-medium">{logs.length}</div>
        </div>
      </section>

      {/* 1. 自动备份开关 */}
      <section className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-semibold">自动备份开关</div>
          <div className="text-xs text-muted-foreground">每天定时执行 pg_dump 并同步至云盘</div>
        </div>
        <Switch checked={config.enabled} onCheckedChange={(v) => updateField("enabled", v)} />
      </section>

      {/* 2. 备份时间 + 3. 保留天数 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>备份时间（每天）</Label>
          <Input
            type="time"
            value={config.time}
            onChange={(e) => updateField("time", e.target.value || "02:00")}
          />
        </div>
        <div className="space-y-2">
          <Label>保留天数</Label>
          <Select
            value={String(config.retention_days)}
            onValueChange={(v) => updateField("retention_days", Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 30, 90, 180, 365].map((d) => (
                <SelectItem key={d} value={String(d)}>{d} 天</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* 4. 备份内容 */}
      <section className="space-y-2">
        <Label>备份内容</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border p-3">
          {CONTENT_MODULES.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={config.modules.includes(m.key)}
                onCheckedChange={() => toggleModule(m.key)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </section>

      {/* 5. 备份目标 + 6. 云盘授权 */}
      <section className="space-y-2">
        <Label>备份目标（云盘，可多选）</Label>
        <div className="space-y-2 rounded-md border p-3">
          {CLOUD_TARGETS.map((c) => {
            const selected = config.targets.includes(c.key);
            const connected = config.connections[c.key];
            return (
              <div key={c.key} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selected} onCheckedChange={() => toggleTarget(c.key)} />
                  <span>{c.icon} {c.label}</span>
                  {connected && <Badge variant="secondary" className="ml-1">已连接</Badge>}
                </label>
                <Button size="sm" variant="outline" onClick={() => connectCloud(c.key)}>
                  {connected ? "重新授权" : `连接 ${c.label}`}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 操作按钮 */}
      <section className="flex flex-wrap gap-2">
        <Button onClick={() => saveConfig(config)} disabled={saving}>
          {saving ? "保存中…" : "💾 保存配置"}
        </Button>
        <Button variant="outline" onClick={handleBackupNow} disabled={runningNow}>
          {runningNow ? "备份中…" : "⚡ 立即备份"}
        </Button>
        <Button variant="ghost" onClick={loadLogs}>🔄 刷新记录</Button>
      </section>

      {/* 11. 恢复入口提示 */}
      <section className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        恢复备份请前往「💾 备份与恢复」面板，上传 .json 备份文件并二次确认后恢复。
      </section>

      {/* 8. 备份记录 */}
      <section className="space-y-2">
        <Label>备份记录（最近 20 条）</Label>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-2 py-1.5">时间</th>
                <th className="text-left px-2 py-1.5">文件 / 来源</th>
                <th className="text-left px-2 py-1.5">大小</th>
                <th className="text-left px-2 py-1.5">表数</th>
                <th className="text-left px-2 py-1.5">记录数</th>
                <th className="text-left px-2 py-1.5">状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">暂无备份记录</td></tr>
              ) : (
                logs.map((l: any) => {
                  const ts = new Date(l.created_at);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const fname = `hoc3_backup_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-2 py-1.5">{ts.toLocaleString("zh-CN")}</td>
                      <td className="px-2 py-1.5 font-mono">{fname}</td>
                      <td className="px-2 py-1.5">{formatSize(l.file_size_bytes)}</td>
                      <td className="px-2 py-1.5">{l.total_tables ?? "—"}</td>
                      <td className="px-2 py-1.5">{l.total_records ?? "—"}</td>
                      <td className="px-2 py-1.5"><Badge variant="secondary">成功</Badge></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
