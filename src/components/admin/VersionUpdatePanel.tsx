import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type LatestCommit = {
  sha: string;
  message: string;
  date: string;
  author: string;
  url: string;
};

const LS_KEY = "version-update-config-v1";

// Build-time info injected by Vite (best effort; not all envs provide it).
const BUILD_COMMIT: string =
  (import.meta as any).env?.VITE_BUILD_COMMIT ||
  (import.meta as any).env?.VITE_GIT_COMMIT ||
  "";
const BUILD_TIME: string =
  (import.meta as any).env?.VITE_BUILD_TIME ||
  (import.meta as any).env?.VITE_BUILD_DATE ||
  "";

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

export function VersionUpdatePanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const preview = useMemo(isPreviewHost, []);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<LatestCommit | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string>("");
  const [updateOk, setUpdateOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.owner) setOwner(j.owner);
        if (j.repo) setRepo(j.repo);
        if (j.branch) setBranch(j.branch);
      }
    } catch {}
  }, []);

  function persist(next: { owner?: string; repo?: string; branch?: string }) {
    const merged = { owner, repo, branch, ...next };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {}
  }

  async function checkUpdate() {
    if (!owner || !repo) {
      toast.error("请先填写 GitHub 仓库（owner / repo）");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch || "main")}`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!r.ok) {
        throw new Error(`GitHub API ${r.status}`);
      }
      const j: any = await r.json();
      setLatest({
        sha: j.sha,
        message: (j.commit?.message || "").split("\n")[0] || "",
        date: j.commit?.author?.date || j.commit?.committer?.date || "",
        author: j.commit?.author?.name || "",
        url: j.html_url || "",
      });
      toast.success("已获取最新提交");
    } catch (e: any) {
      toast.error("检测失败：" + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  const hasNew = latest && BUILD_COMMIT && !latest.sha.startsWith(BUILD_COMMIT.slice(0, 7));
  const unknownLocal = !BUILD_COMMIT;

  async function doUpdate() {
    setUpdating(true);
    setUpdateLog("");
    setUpdateOk(null);
    try {
      const r = await fetch("/api/admin/self-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch }),
      });
      const text = await r.text();
      setUpdateLog(text);
      setUpdateOk(r.ok);
      if (r.ok) toast.success("更新已完成");
      else toast.error("更新失败，已保留当前可运行版本");
    } catch (e: any) {
      setUpdateOk(false);
      setUpdateLog(String(e?.message ?? e));
      toast.error("更新请求失败");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="font-medium">当前部署版本</div>
        <div className="grid grid-cols-[120px_1fr] gap-y-1 gap-x-3 text-xs">
          <div className="text-muted-foreground">Commit</div>
          <div className="font-mono">{BUILD_COMMIT || "未知（构建时未注入 VITE_BUILD_COMMIT）"}</div>
          <div className="text-muted-foreground">构建时间</div>
          <div>{BUILD_TIME || "未知"}</div>
          <div className="text-muted-foreground">环境</div>
          <div>{preview ? "Lovable 预览 / 本地（不可执行更新）" : "VPS 部署"}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="font-medium">GitHub 仓库</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Owner</Label>
            <Input
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                persist({ owner: e.target.value });
              }}
              placeholder="your-org"
            />
          </div>
          <div>
            <Label className="text-xs">Repo</Label>
            <Input
              value={repo}
              onChange={(e) => {
                setRepo(e.target.value);
                persist({ repo: e.target.value });
              }}
              placeholder="your-repo"
            />
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <Input
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                persist({ branch: e.target.value });
              }}
              placeholder="main"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={checkUpdate} disabled={loading} variant="outline">
            {loading ? "检测中..." : "检测更新"}
          </Button>
        </div>
      </div>

      {latest && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">GitHub 最新提交</div>
            {hasNew ? (
              <span className="text-xs rounded bg-amber-100 text-amber-900 px-2 py-0.5 dark:bg-amber-900/30 dark:text-amber-200">
                发现新版本
              </span>
            ) : unknownLocal ? (
              <span className="text-xs text-muted-foreground">本地版本未知</span>
            ) : (
              <span className="text-xs text-muted-foreground">已是最新</span>
            )}
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-y-1 gap-x-3 text-xs">
            <div className="text-muted-foreground">SHA</div>
            <div className="font-mono">{latest.sha.slice(0, 12)}</div>
            <div className="text-muted-foreground">消息</div>
            <div>{latest.message}</div>
            <div className="text-muted-foreground">作者</div>
            <div>{latest.author}</div>
            <div className="text-muted-foreground">时间</div>
            <div>{latest.date ? new Date(latest.date).toLocaleString() : "-"}</div>
            <div className="text-muted-foreground">链接</div>
            <div>
              <a href={latest.url} target="_blank" rel="noreferrer" className="text-primary underline">
                在 GitHub 查看
              </a>
            </div>
          </div>

          {isSuperAdmin && !preview && (
            <div className="pt-2">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={updating || !hasNew}
                variant="default"
              >
                {updating ? "更新中..." : "立即更新"}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">
                更新前会自动备份当前版本到 <code>.backup-&lt;timestamp&gt;</code>，并执行
                git fetch / pull → npm install → npm run build → pm2 restart。
              </p>
            </div>
          )}
          {preview && (
            <p className="text-[11px] text-muted-foreground">
              当前为 Lovable 预览环境，不提供"立即更新"按钮（仅 VPS 部署可用）。
            </p>
          )}
          {!isSuperAdmin && (
            <p className="text-[11px] text-muted-foreground">仅超级管理员可执行更新。</p>
          )}
        </div>
      )}

      {updateLog && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="font-medium">
            更新日志 {updateOk === true ? "✅" : updateOk === false ? "❌" : ""}
          </div>
          <pre className="text-[11px] whitespace-pre-wrap bg-muted p-2 rounded max-h-80 overflow-auto">
            {updateLog}
          </pre>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认执行更新？</AlertDialogTitle>
            <AlertDialogDescription>
              将自动备份当前版本，然后拉取 GitHub 最新代码、安装依赖、构建并重启服务。
              失败时会保留当前可运行版本。是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                doUpdate();
              }}
            >
              确认更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
