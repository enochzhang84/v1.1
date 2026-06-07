import { useEffect, useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  released_at: string | null;
  notes: string | null;
  installed_at: string;
  status: string;
  is_current: boolean;
  package_name: string | null;
  error_log: string | null;
};

type PackageInfo = {
  version: string;
  released_at?: string;
  notes?: string;
  name?: string;
};

function compareVersion(a: string, b: string) {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function isPreviewHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export function SystemUpgradePanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const preview = isPreviewHost();
  const [current, setCurrent] = useState<AppVersion | null>(null);
  const [history, setHistory] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pkgFile, setPkgFile] = useState<File | null>(null);
  const [pkgInfo, setPkgInfo] = useState<PackageInfo | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .order("installed_at", { ascending: false });
    if (!error && data) {
      const list = data as AppVersion[];
      setHistory(list);
      setCurrent(list.find((v) => v.is_current) ?? list[0] ?? null);
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
      if (!versionFile) {
        throw new Error("升级包缺少 version.json");
      }
      const text = await versionFile.async("string");
      const info = JSON.parse(text) as PackageInfo;
      if (!info.version) throw new Error("version.json 缺少 version 字段");
      setPkgInfo({ ...info, name: info.name || file.name });
      toast.success(`已识别升级包：${info.version}`);
    } catch (e: any) {
      toast.error("解析失败：" + (e?.message ?? String(e)));
    } finally {
      setParsing(false);
    }
  }

  const currentVer = current?.version ?? "v1.0.0";
  const isNewer = pkgInfo ? compareVersion(pkgInfo.version, currentVer) > 0 : false;

  async function doInstall() {
    if (!pkgFile || !pkgInfo) return;
    setInstalling(true);
    setInstallLog("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const form = new FormData();
      form.append("package", pkgFile);
      form.append("info", JSON.stringify(pkgInfo));
      const r = await fetch("/api/admin/install-package", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const text = await r.text();
      setInstallLog(text);
      if (r.ok) {
        toast.success("升级成功，系统将自动重启");
        await load();
      } else {
        toast.error("升级失败，已自动回滚到上一版本");
      }
    } catch (e: any) {
      setInstallLog(String(e?.message ?? e));
      toast.error("升级请求失败");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Current version card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">当前版本</div>
            <div className="text-2xl font-semibold">HOC3 {currentVer}</div>
            <div className="text-xs text-muted-foreground">
              发布时间：{current?.released_at ? new Date(current.released_at).toLocaleDateString() : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              安装时间：{current ? new Date(current.installed_at).toLocaleString() : "—"}
            </div>
          </div>
          <div className="text-right">
            {pkgInfo && isNewer ? (
              <span className="inline-block rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-xs dark:bg-rose-900/30 dark:text-rose-200">
                发现新版本 {pkgInfo.version}
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
            <div className="text-xs text-muted-foreground mb-1">更新说明</div>
            <pre className="whitespace-pre-wrap text-xs">{current.notes}</pre>
          </div>
        )}
      </div>

      {/* Import package */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="font-medium">导入升级包</div>
        <p className="text-xs text-muted-foreground">
          请选择官方提供的 <code>hoc3-update.zip</code> 升级包。系统将自动识别版本号与更新说明。
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

        {pkgInfo && (
          <div className="mt-2 rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">升级版本</div>
                <div className="text-lg font-semibold">HOC3 {pkgInfo.version}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {pkgInfo.released_at && <>发布：{new Date(pkgInfo.released_at).toLocaleDateString()}</>}
              </div>
            </div>
            {pkgInfo.notes && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">本次更新内容</div>
                <pre className="whitespace-pre-wrap text-xs bg-background border rounded p-2">{pkgInfo.notes}</pre>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs">
                {isNewer ? (
                  <span className="text-emerald-700 dark:text-emerald-300">
                    版本检查通过：{currentVer} → {pkgInfo.version}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">
                    升级包版本不高于当前版本（{currentVer}）
                  </span>
                )}
              </div>
              {isSuperAdmin && !preview && (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!isNewer || installing}
                >
                  {installing ? "升级中..." : "立即升级"}
                </Button>
              )}
            </div>
            {preview && (
              <p className="text-[11px] text-muted-foreground">
                当前为预览环境，不提供"立即升级"按钮（仅生产环境可用）。
              </p>
            )}
            {!isSuperAdmin && (
              <p className="text-[11px] text-muted-foreground">仅超级管理员可执行升级。</p>
            )}
          </div>
        )}
      </div>

      {/* Install log */}
      {installLog && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="font-medium">升级日志</div>
          <pre className="text-[11px] whitespace-pre-wrap bg-muted p-2 rounded max-h-72 overflow-auto">
            {installLog}
          </pre>
        </div>
      )}

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
                className="flex items-center justify-between border rounded-lg px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">{v.version}</span>
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
                <div className="text-muted-foreground">
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
            <AlertDialogTitle>确认升级到 {pkgInfo?.version}？</AlertDialogTitle>
            <AlertDialogDescription>
              系统将自动执行：备份数据库 → 备份配置 → 备份上传文件 → 安装新版本 → 重启系统。
              升级失败将自动回滚到当前版本（{currentVer}），数据不会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                doInstall();
              }}
            >
              开始升级
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Hook to check if a newer version is available — used for dashboard red-dot.
 *  In this release-package model, we don't auto-poll a remote registry. We simply
 *  expose the current version + a flag the admin can set via app_settings later.
 *  For now, always returns false (no new version) — kept for API symmetry.
 */
export function useHasNewVersion() {
  return false;
}
