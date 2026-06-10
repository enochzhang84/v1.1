import { QRCodeSVG } from "qrcode.react";
import { Link } from "@tanstack/react-router";
import type { HomeBlock } from "@/lib/home-content";
import { sanitizeHtml } from "@/lib/home-content";
import { sanitizePublicUrl } from "@/lib/public-origin";

function alignClass(a?: string) {
  return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
}
function alignFlex(a?: string) {
  return a === "center" ? "justify-center" : a === "right" ? "justify-end" : "justify-start";
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}
function youtubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

export function HomeBlocksRenderer({ blocks, css }: { blocks: HomeBlock[]; css?: string | null }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {blocks.map((b) => {
        switch (b.type) {
          case "heading": {
            const sizes: Record<number, string> = { 1: "text-4xl md:text-5xl font-bold", 2: "text-3xl md:text-4xl font-bold", 3: "text-xl md:text-2xl font-semibold" };
            const cls = `${sizes[b.level]} ${alignClass(b.align)}`;
            const style = { color: b.color || undefined };
            const inner = { __html: sanitizeHtml(b.html) };
            if (b.level === 1) return <h1 key={b.id} className={cls} style={style} dangerouslySetInnerHTML={inner} />;
            if (b.level === 2) return <h2 key={b.id} className={cls} style={style} dangerouslySetInnerHTML={inner} />;
            return <h3 key={b.id} className={cls} style={style} dangerouslySetInnerHTML={inner} />;
          }
          case "paragraph":
            return (
              <p
                key={b.id}
                className={`text-base md:text-lg leading-relaxed ${alignClass(b.align)}`}
                style={{ color: b.color || undefined }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }}
              />
            );
          case "image":
            return (
              <div key={b.id} className={`flex ${alignFlex(b.align)}`}>
                <img src={b.url} alt={b.alt || ""} style={{ maxWidth: "100%", width: b.width ? `${b.width}px` : undefined }} className="rounded-lg" />
              </div>
            );
          case "video":
            if (isYouTube(b.url)) {
              return (
                <div key={b.id} className="aspect-video w-full">
                  <iframe src={youtubeEmbed(b.url)} title="video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full rounded-lg" />
                </div>
              );
            }
            return (
              <video key={b.id} src={b.url} controls className="w-full rounded-lg" />
            );
          case "qrcode": {
            const size = b.size ?? 200;
            const qrUrl = sanitizePublicUrl(b.value);
            return (
              <div key={b.id} className={`flex flex-col items-center gap-2`} style={{ alignItems: b.align === "left" ? "flex-start" : b.align === "right" ? "flex-end" : "center" }}>
                {b.mode === "image" && b.image_url ? (
                  <img src={b.image_url} alt={b.label || "QR"} style={{ width: size, height: size }} />
                ) : qrUrl ? (
                  <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                    <QRCodeSVG value={qrUrl} size={size} />
                  </div>
                ) : null}
                {b.label ? <div className="text-sm text-muted-foreground">{b.label}</div> : null}
              </div>
            );
          }
          case "button": {
            const variantClass =
              b.variant === "secondary"
                ? "bg-secondary text-secondary-foreground"
                : b.variant === "outline"
                  ? "border border-input bg-background"
                  : "bg-primary text-primary-foreground";
            const cls = `inline-flex items-center justify-center px-6 py-3 rounded-md font-medium hover:opacity-90 transition ${variantClass}`;
            const isExternal = /^https?:/i.test(b.url);
            return (
              <div key={b.id} className={`flex ${alignFlex(b.align)}`}>
                {isExternal ? (
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className={cls}>{b.text}</a>
                ) : (
                  <Link to={b.url} className={cls}>{b.text}</Link>
                )}
              </div>
            );
          }
          case "divider":
            return <hr key={b.id} className="border-t border-border my-4" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
