import { useEffect, useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { emitAdminLogoUpdated } from "@/hooks/useAdminLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AppVersion = {
  id: string;
  version: string;
  database_version: string | null;
  released_at: string | null;
  notes: string | null;
  installed_at: string;
  status: string;
  is_current: boolean;
  package_name: string | null;
  error_log: string | null;
};

type PackageInfo = {
  systemVersion?: string;
  version?: string;
  databaseVersion?: string;
  releaseDate?: string;
  released_at?: string;
  release_date?: string;
  build_number?: string;
  title?: string;
  description?: string[] | string;
  notes?: string;
  name?: string;
};

function normalizeVersion(v?: string | null) {
  if (!v) return "";
  const t = v.trim();
  return t.startsWith("v") || t.startsWith("V") ? t : `v${t}`;
}

function compareVersion(a: string, b: string) {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function SystemUpgradePanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [current, setCurrent] = useState<AppVersion | null>(null);
  const [history, setHistory] = useState<AppVersion[]>([]);
  const [systemVer, setSystemVer] = useState("v1.0.0");
  const [dbVer, setDbVer] = useState("v1.0.0");
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pkgFile, setPkgFile] = useState<File | null>(null);
  const [pkgInfo, setPkgInfo] = useState<PackageInfo | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recording, setRecording] = useState(false);

  async function load() {
    setLoading(true);
    const [versions, settings, backups] = await Promise.all([
      supabase.from("app_versions").select("*").order("installed_at", { ascending: false }),
      supabase.from("app_settings").select("key,value").in("key", ["system_version", "database_version"]),
      supabase.from("backup_logs").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);
    if (!versions.error && versions.data) {
      const list = versions.data as AppVersion[];
      setHistory(list);
      setCurrent(list.find((v) => v.is_current) ?? list[0] ?? null);
    }
    if (!settings.error && settings.data) {
      for (const row of settings.data as { key: string; value: string }[]) {
        if (row.key === "system_version") setSystemVer(row.value || "v1.0.0");
        if (row.key === "database_version") setDbVer(row.value || "v1.0.0");
      }
    }
    if (!backups.error && backups.data && backups.data.length > 0) {
      setLastBackupAt((backups.data[0] as { created_at: string }).created_at);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onFile(file: File | null) {
    setPkgFile(file);
    setPkgInfo(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("请上传 .zip 升级包");
      return;
    }
    setParsing(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const versionFile =
        zip.file("version.json") ||
        zip.file("VERSION.json") ||
        zip.file("hoc3-version.json");
      if (!versionFile) throw new Error("升级包缺少 version.json");
      const text = await versionFile.async("string");
      const info = JSON.parse(text) as PackageInfo;
      const sv = normalizeVersion(info.systemVersion || info.version);
      if (!sv) throw new Error("version.json 缺少 systemVersion / version 字段");
      setPkgInfo({ ...info, name: info.name || file.name });
      toast.success(`已识别升级包：HOC3 ${sv}`);
    } catch (e: any) {
      toast.error("解析失败：" + (e?.message ?? String(e)));
    } finally {
      setParsing(false);
    }
  }

  const pkgSysVer = normalizeVersion(pkgInfo?.systemVersion || pkgInfo?.version);
  const pkgDbVer = normalizeVersion(pkgInfo?.databaseVersion);
  const pkgDescription: string[] = Array.isArray(pkgInfo?.description)
    ? (pkgInfo!.description as string[])
    : pkgInfo?.description
      ? [String(pkgInfo.description)]
      : pkgInfo?.notes
        ? [pkgInfo.notes]
        : [];

  const isNewer = pkgSysVer ? compareVersion(pkgSysVer, systemVer) > 0 : false;
  const isSameOrOlder = pkgSysVer && !isNewer;

  async function recordUpgrade() {
    if (!pkgInfo || !pkgSysVer) return;
    setRecording(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;

      // mark old current as non-current
      await supabase.from("app_versions").update({ is_current: false }).eq("is_current", true);

      const releasedAt = pkgInfo.releaseDate || pkgInfo.released_at || null;
      const { error: insErr } = await supabase.from("app_versions").insert({
        version: pkgSysVer,
        database_version: pkgDbVer || dbVer,
        released_at: releasedAt ? new Date(releasedAt).toISOString() : null,
        notes: pkgDescription.length ? pkgDescription.map((d) => `• ${d}`).join("\n") : null,
        installed_by: uid,
        status: "success",
        is_current: true,
        package_name: pkgInfo.name ?? null,
      });
      if (insErr) throw insErr;

      // upsert version settings
      const updates = [
        { key: "system_version", value: pkgSysVer, updated_at: new Date().toISOString() },
      ];
      if (pkgDbVer) {
        updates.push({ key: "database_version", value: pkgDbVer, updated_at: new Date().toISOString() });
      }
      const { error: setErr } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
      if (setErr) throw setErr;

      toast.success(`已记录升级到 HOC3 ${pkgSysVer}`);
      setPkgFile(null);
      setPkgInfo(null);
      await load();
    } catch (e: any) {
      toast.error("记录失败：" + (e?.message ?? String(e)));
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {/* System info card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">当前系统</div>
            <div className="text-2xl font-semibold">HOC3 {systemVer}</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1">
              <span>
                数据库版本：<span className="text-foreground font-medium">DB {dbVer}</span>
              </span>
              <span>
                发布时间：
                {current?.released_at ? new Date(current.released_at).toLocaleDateString() : "—"}
              </span>
              <span>
                安装时间：
                {current ? new Date(current.installed_at).toLocaleString() : "—"}
              </span>
              <span>
                最后备份：
                <span className="text-foreground">
                  {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "暂无备份"}
                </span>
              </span>
            </div>
          </div>
          <div className="text-right">
            {pkgInfo && isNewer ? (
              <span className="inline-block rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-xs dark:bg-rose-900/30 dark:text-rose-200">
                发现新版本 {pkgSysVer}
              </span>
            ) : (
              <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs dark:bg-emerald-900/30 dark:text-emerald-200">
                当前已是最新版
              </span>
            )}
          </div>
        </div>
        {current?.notes && (
          <div className="mt-4 border-t pt-3">
            <div className="text-xs text-muted-foreground mb-1">本版本更新说明</div>
            <pre className="whitespace-pre-wrap text-xs">{current.notes}</pre>
          </div>
        )}
      </div>

      {/* Import package */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">导入升级包</div>
          <div className="text-[11px] text-muted-foreground">支持 hoc3-update.zip</div>
        </div>
        <p className="text-xs text-muted-foreground">
          上传由开发团队提供的升级包，系统将自动读取 <code>version.json</code> 中的版本号与更新说明。
          升级动作目前由系统管理员在服务器上手动完成；此处仅用于记录与版本管理。
        </p>
        <div className="flex items-center gap-3">
          <label className="inline-flex">
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" asChild>
              <span>{parsing ? "解析中..." : "选择升级包"}</span>
            </Button>
          </label>
          {pkgFile && (
            <span className="text-xs text-muted-foreground">
              {pkgFile.name}（{(pkgFile.size / 1024 / 1024).toFixed(2)} MB）
            </span>
          )}
        </div>

        {pkgInfo && pkgSysVer && (
          <div className="mt-2 rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">发现新版本</div>
                <div className="text-lg font-semibold">HOC3 {pkgSysVer}</div>
                {pkgDbVer && (
                  <div className="text-xs text-muted-foreground">
                    数据库版本：<span className="text-foreground font-medium">DB {pkgDbVer}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {(pkgInfo.releaseDate || pkgInfo.released_at) && (
                  <>发布：{new Date(pkgInfo.releaseDate || pkgInfo.released_at!).toLocaleDateString()}</>
                )}
              </div>
            </div>

            {pkgDescription.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">更新内容</div>
                <ul className="text-xs bg-background border rounded p-2 space-y-1">
                  {pkgDescription.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs">
                {isNewer ? (
                  <span className="text-emerald-700 dark:text-emerald-300">
                    版本检查通过：{systemVer} → {pkgSysVer}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">
                    升级包版本不高于当前版本（{systemVer}）
                  </span>
                )}
              </div>
              {isSuperAdmin && (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!isNewer || recording}
                >
                  {recording ? "记录中..." : "标记为已安装"}
                </Button>
              )}
            </div>
            {!isSuperAdmin && (
              <p className="text-[11px] text-muted-foreground">仅超级管理员可登记新版本。</p>
            )}
            {isSameOrOlder && (
              <p className="text-[11px] text-muted-foreground">
                如果您只是查看升级包内容，无需登记。
              </p>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border bg-card p-5">
        <div className="font-medium mb-3">升级记录</div>
        {loading ? (
          <div className="text-xs text-muted-foreground">加载中...</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-muted-foreground">暂无记录</div>
        ) : (
          <div className="space-y-2">
            {history.map((v) => (
              <div
                key={v.id}
                className="flex items-start justify-between border rounded-lg px-3 py-2 text-xs gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">HOC3 {v.version}</span>
                    {v.database_version && (
                      <span className="text-muted-foreground">DB {v.database_version}</span>
                    )}
                    {v.is_current && (
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">当前</span>
                    )}
                    <span
                      className={
                        v.status === "success"
                          ? "text-emerald-600"
                          : v.status === "rolled_back"
                            ? "text-amber-600"
                            : "text-rose-600"
                      }
                    >
                      {v.status === "success"
                        ? "✓ 成功"
                        : v.status === "rolled_back"
                          ? "↺ 已回滚"
                          : "✗ 失败"}
                    </span>
                  </div>
                  {v.notes && (
                    <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground mt-1">
                      {v.notes}
                    </pre>
                  )}
                </div>
                <div className="text-muted-foreground whitespace-nowrap">
                  {new Date(v.installed_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>登记升级到 HOC3 {pkgSysVer}？</AlertDialogTitle>
            <AlertDialogDescription>
              系统将把当前版本更新为 <strong>HOC3 {pkgSysVer}</strong>
              {pkgDbVer && <> / <strong>DB {pkgDbVer}</strong></>}，并写入升级记录。
              <br />
              注意：本操作仅做版本登记，不会自动部署代码或执行数据库迁移；
              实际升级请由系统管理员在服务器上手动完成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                recordUpgrade();
              }}
            >
              确认登记
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function useHasNewVersion() {
  return false;
}
