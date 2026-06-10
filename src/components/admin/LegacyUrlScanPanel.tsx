import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { scanLegacyUrls, rewriteLegacyUrls, type LegacyHit } from "@/lib/legacy-urls";
import { getPublicOrigin } from "@/lib/public-origin";

/** 旧域名残留扫描 / 一键替换面板。 */
export function LegacyUrlScanPanel() {
  const [target, setTarget] = useState<string>(getPublicOrigin());
  const [extra, setExtra] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<LegacyHit[] | null>(null);

  function extraHosts(): string[] {
    return extra
      .split(/[\s,，;；]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        try {
          return new URL(s.startsWith("http") ? s : `https://${s}`).host;
        } catch {
          return s.toLowerCase();
        }
      });
  }

  async function doScan() {
    setBusy(true);
    try {
      const res = await scanLegacyUrls(target, extraHosts());
      setHits(res.hits);
      if (res.total === 0) toast.success("未发现旧域名残留 ✓");
      else toast.warning(`发现 ${res.total} 处旧域名残留，请确认后一键替换。`);
    } catch (e: any) {
      toast.error(`扫描失败：${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function doRewrite() {
    if (!hits || hits.length === 0) {
      toast.message("请先扫描");
      return;
    }
    if (!confirm(`确认把 ${hits.length} 处旧域名替换为 ${target} ?`)) return;
    setBusy(true);
    try {
      const res = await rewriteLegacyUrls(target, extraHosts());
      if (res.failed > 0) {
        toast.error(`完成：${res.updated} 成功 / ${res.failed} 失败。${res.errors[0] ?? ""}`);
      } else {
        toast.success(`已替换 ${res.updated} 处旧域名 ✓`);
      }
      // 重新扫描以验证
      const verify = await scanLegacyUrls(target, extraHosts());
      setHits(verify.hits);
    } catch (e: any) {
      toast.error(`替换失败：${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card border border-amber-500/40 rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="font-serif text-lg">🧹 旧域名扫描 / 一键替换</h3>
        <p className="text-xs text-muted-foreground mt-1">
          扫描数据库中的二维码地址 / 主页按钮 / 认证主域名，发现 <code>lovableproject.com</code>、
          <code>id-preview</code>、<code>localhost</code> 或下方填写的旧教会域名时，一键改写为当前系统域名。
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">目标域名（当前系统）</div>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://yourchurch.org" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">额外的旧域名（可选，逗号/空格分隔）</div>
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="oldchurch.com, old.example.org" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={doScan} disabled={busy} variant="outline">扫描旧域名</Button>
        <Button onClick={doRewrite} disabled={busy || !hits || hits.length === 0}>
          一键替换为当前域名（{hits?.length ?? 0}）
        </Button>
      </div>

      {hits && hits.length > 0 && (
        <div className="border border-amber-300/60 bg-amber-500/5 rounded-xl p-3 text-xs space-y-2 max-h-80 overflow-auto">
          {hits.map((h, i) => (
            <div key={i} className="border-b border-amber-300/30 pb-2 last:border-0 last:pb-0">
              <div className="font-medium">[{h.table}.{h.column}] {h.label}</div>
              <div className="text-red-600 break-all">旧：{h.oldUrl}</div>
              <div className="text-emerald-700 break-all">新：{h.newUrl}</div>
            </div>
          ))}
        </div>
      )}

      {hits && hits.length === 0 && (
        <div className="text-xs text-emerald-700">✓ 没有发现旧域名残留</div>
      )}
    </section>
  );
}
