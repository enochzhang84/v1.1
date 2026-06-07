import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getPublicOrigin } from "@/lib/public-origin";

type Props = {
  title: string;
  /** Path appended to window.location.origin if no persistedUrl is set. e.g. "/retreat-register" */
  defaultPath: string;
  /** Persisted URL from DB (overrides default if non-empty). */
  persistedUrl?: string | null;
  /** Persist handler — called when user clicks 生成二维码 / saves. */
  onSave?: (url: string) => Promise<void> | void;
  /** Print metadata */
  printTitle?: string;
  printFooter?: string;
  /** Download filename without extension */
  downloadName?: string;
};

export function EventQrManager({
  title,
  defaultPath,
  persistedUrl,
  onSave,
  printTitle,
  printFooter = "基督之家第三家",
  downloadName = "qrcode",
}: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fallback = `${origin}${defaultPath}`;
  const [url, setUrl] = useState<string>(persistedUrl?.trim() ? persistedUrl : fallback);
  const [renderUrl, setRenderUrl] = useState<string>(url);
  const svgWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = persistedUrl?.trim() ? persistedUrl : fallback;
    setUrl(next);
    setRenderUrl(next);
  }, [persistedUrl, fallback]);

  function getSvgString(): string | null {
    const svg = svgWrap.current?.querySelector("svg");
    if (!svg) return null;
    const c = svg.cloneNode(true) as SVGElement;
    c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(c);
  }

  async function toPngBlob(size = 640): Promise<Blob | null> {
    const s = getSvgString();
    if (!s) return null;
    return new Promise((resolve) => {
      const img = new Image();
      const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
      const u = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(u);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(u);
        resolve(null);
      };
      img.src = u;
    });
  }

  async function generate() {
    if (!url.trim()) {
      toast.error("请填写链接地址");
      return;
    }
    setRenderUrl(url.trim());
    if (onSave) {
      try {
        await onSave(url.trim());
        toast.success("二维码已生成并保存");
      } catch (e: any) {
        toast.error(e?.message || "保存失败");
      }
    } else {
      toast.success("二维码已生成");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(renderUrl);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  function open() {
    window.open(renderUrl, "_blank", "noopener,noreferrer");
  }

  async function download() {
    const blob = await toPngBlob(640);
    if (!blob) return toast.error("无法生成 PNG");
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${downloadName}.png`;
    a.click();
    URL.revokeObjectURL(u);
  }

  function print() {
    const svg = getSvgString();
    if (!svg) return;
    const w = window.open("", "_blank", "width=820,height=1100");
    if (!w) return;
    const heading = printTitle || title;
    w.document.write(`<!doctype html><html><head><title>${heading}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
               display: flex; flex-direction: column; align-items: center; justify-content: center;
               min-height: 100vh; margin: 0; color: #111; }
        h1 { font-size: 28px; margin: 0 0 16px; }
        .qr { padding: 16px; background: #fff; border: 1px solid #ddd; }
        .url { margin-top: 18px; font-size: 14px; word-break: break-all; max-width: 600px; text-align: center; color: #333; }
        .footer { margin-top: 28px; font-size: 14px; color: #555; }
      </style></head><body>
        <h1>${heading}</h1>
        <div class="qr">${svg}</div>
        <p class="url">${renderUrl}</p>
        <p class="footer">${printFooter}</p>
        <script>window.onload=()=>{setTimeout(()=>window.print(),200);}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="border border-border/50 rounded-xl p-4">
      <p className="font-medium text-center mb-3">{title}</p>
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <div ref={svgWrap} className="flex flex-col items-center gap-2">
          <div className="bg-white p-3 rounded-md border border-border/40">
            <QRCodeSVG value={renderUrl || fallback} size={200} level="H" />
          </div>
          <p className="text-xs text-muted-foreground break-all text-center max-w-[220px]">
            {renderUrl}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">登记链接</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={fallback}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={generate}>生成二维码</Button>
            <Button size="sm" variant="outline" onClick={copy}>复制链接</Button>
            <Button size="sm" variant="outline" onClick={open}>打开</Button>
            <Button size="sm" variant="outline" onClick={download}>下载 PNG</Button>
            <Button size="sm" variant="outline" onClick={print}>打印二维码</Button>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            留空时使用当前站点 <code>{defaultPath}</code>。
          </p>
        </div>
      </div>
    </div>
  );
}
