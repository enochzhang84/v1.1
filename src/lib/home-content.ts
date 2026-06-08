import DOMPurify from "dompurify";

export type HomeBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; html: string; align?: "left" | "center" | "right"; color?: string }
  | { id: string; type: "paragraph"; html: string; align?: "left" | "center" | "right"; color?: string }
  | { id: string; type: "image"; url: string; alt?: string; width?: number; align?: "left" | "center" | "right" }
  | { id: string; type: "video"; url: string; provider?: "file" | "youtube" }
  | { id: string; type: "qrcode"; mode: "auto" | "image"; value?: string; image_url?: string; label?: string; size?: number; align?: "left" | "center" | "right" }
  | { id: string; type: "button"; text: string; url: string; variant?: "primary" | "secondary" | "outline"; align?: "left" | "center" | "right" }
  | { id: string; type: "divider" };

export type HomeContent = {
  id?: string;
  slug: string;
  blocks: HomeBlock[];
  html_content?: string | null;
  css_content?: string | null;
  updated_at?: string;
};

export const SAFE_HTML_CONFIG = {
  ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "span", "br", "p", "a"],
  ALLOWED_ATTR: ["style", "href", "target", "rel"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
};

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, SAFE_HTML_CONFIG);
}

export function sanitizeBlocks(blocks: HomeBlock[]): HomeBlock[] {
  return blocks.map((b) => {
    if (b.type === "heading" || b.type === "paragraph") {
      return { ...b, html: sanitizeHtml(b.html ?? "") };
    }
    return b;
  });
}

export function newId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

// 默认模板：当前线上「基督三家主页」快照
export function defaultHomeTemplate(): HomeBlock[] {
  return [
    { id: newId(), type: "heading", level: 1, html: "基督三家事工中心", align: "center", color: "#0f172a" },
    { id: newId(), type: "heading", level: 3, html: "The Home of Christ Church III", align: "center", color: "#475569" },
    { id: newId(), type: "paragraph", html: "<em>「凡劳苦担重担的人，可以到我这里来，我就使你们得安息。」—— 马太福音 11:28</em>", align: "center", color: "#334155" },
    { id: newId(), type: "divider" },
    { id: newId(), type: "heading", level: 2, html: "欢迎来到基督三家", align: "center" },
    { id: newId(), type: "paragraph", html: "无论你是第一次来教会，还是已经认识主多年，我们都为你预备了一份温暖的迎接。愿主的恩典与平安与你同在。", align: "center" },
    { id: newId(), type: "qrcode", mode: "auto", value: "https://qr-newbie-flow.lovable.app/register", label: "新人登记", size: 200, align: "center" },
    { id: newId(), type: "button", text: "新人登记", url: "/register", variant: "primary", align: "center" },
    { id: newId(), type: "divider" },
    { id: newId(), type: "paragraph", html: "© 基督三家 · Christ Home Church III", align: "center", color: "#94a3b8" },
  ];
}
