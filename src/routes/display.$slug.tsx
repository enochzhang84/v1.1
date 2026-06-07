import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";

export const Route = createFileRoute("/display/$slug")({
  component: DisplayScreen,
});

type Screen = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  orientation: "landscape" | "portrait" | string;
  current_content_type: string;
  current_content_payload: Record<string, unknown> | null;
  playlist_id: string | null;
  is_active: boolean;
};

type PlaylistItem = {
  id: string;
  sort_order: number;
  content_type: string;
  content_payload: Record<string, unknown> | null;
  duration_seconds: number | null;
};

type Playlist = {
  id: string;
  name: string;
  interval_seconds: number;
  loop_enabled: boolean;
};

function DisplayScreen() {
  const { slug } = Route.useParams();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [notFound, setNotFound] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("display_screens" as never)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setScreen(data as Screen);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Realtime subscribe to screen row
  useEffect(() => {
    if (!screen?.id) return;
    const ch = supabase
      .channel(`display-screen-${screen.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_screens", filter: `id=eq.${screen.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotFound(true);
          } else if (payload.new) {
            setScreen(payload.new as Screen);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [screen?.id]);

  // Load playlist + items when applicable
  useEffect(() => {
    if (!screen) return;
    const pid = screen.current_content_type === "playlist" ? screen.playlist_id : null;
    if (!pid) {
      setPlaylist(null);
      setItems([]);
      setPageIdx(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: pl }, { data: it }] = await Promise.all([
        supabase.from("display_playlists" as never).select("*").eq("id", pid).maybeSingle(),
        supabase
          .from("display_playlist_items" as never)
          .select("*")
          .eq("playlist_id", pid)
          .order("sort_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setPlaylist((pl as unknown as Playlist) ?? null);
      setItems((it as PlaylistItem[]) ?? []);
      setPageIdx(0);
    })();

    const ch = supabase
      .channel(`display-playlist-${pid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_playlists", filter: `id=eq.${pid}` },
        (payload) => {
          if (payload.new) setPlaylist(payload.new as Playlist);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_playlist_items", filter: `playlist_id=eq.${pid}` },
        async () => {
          const { data: it } = await supabase
            .from("display_playlist_items" as never)
            .select("*")
            .eq("playlist_id", pid)
            .order("sort_order", { ascending: true });
          setItems((it as PlaylistItem[]) ?? []);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [screen?.current_content_type, screen?.playlist_id, screen]);

  // Rotate playlist
  useEffect(() => {
    if (screen?.current_content_type !== "playlist") return;
    if (items.length <= 1) return;
    const cur = items[pageIdx % items.length];
    const sec = cur.duration_seconds ?? playlist?.interval_seconds ?? 10;
    const ms = Math.max(2, sec) * 1000;
    const t = setTimeout(() => {
      setPageIdx((i) => {
        const next = i + 1;
        if (next >= items.length && playlist?.loop_enabled === false) return i;
        return next % items.length;
      });
    }, ms);
    return () => clearTimeout(t);
  }, [screen?.current_content_type, items, pageIdx, playlist?.interval_seconds, playlist?.loop_enabled]);

  // Heartbeat
  useEffect(() => {
    if (!screen?.slug) return;
    const ping = () => {
      void supabase.rpc("touch_display_screen" as never, { _slug: screen.slug } as never);
    };
    ping();
    const t = setInterval(ping, 20_000);
    return () => clearInterval(t);
  }, [screen?.slug]);

  // Hide page chrome / scrollbars
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (notFound) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center text-3xl">
        屏幕未注册：{slug}
      </div>
    );
  }
  if (!screen) {
    return (
      <div className="fixed inset-0 bg-[#FAF3E3]" />
    );
  }

  const isPortrait = screen.orientation === "portrait";

  // Build the active slide(s). For non-playlist content, render a single slide.
  if (screen.current_content_type !== "playlist" || items.length === 0) {
    const contentType = screen.current_content_type;
    const payload = screen.current_content_payload ?? {};
    return (
      <div
        className={`fixed inset-0 ${
          contentType === "emergency" ? "bg-red-700 text-white" : "bg-[#FAF3E3] text-stone-900"
        }`}
      >
        <ContentRenderer type={contentType} payload={payload} screen={screen} portrait={isPortrait} />
        <div className="absolute bottom-3 right-4 text-xs opacity-50">
          {screen.name} · {screen.location ?? ""} · /{screen.slug}
        </div>
      </div>
    );
  }

  return (
    <PlaylistCarousel
      items={items}
      pageIdx={pageIdx}
      screen={screen}
      portrait={isPortrait}
    />
  );
}

function PlaylistCarousel({
  items,
  pageIdx,
  screen,
  portrait,
}: {
  items: PlaylistItem[];
  pageIdx: number;
  screen: Screen;
  portrait: boolean;
}) {
  // Track up to two layers for crossfade
  const idx = ((pageIdx % items.length) + items.length) % items.length;
  const nextIdx = (idx + 1) % items.length;

  // Preload images for current + next item (and a couple ahead) silently
  useEffect(() => {
    const preloadIdxs = [idx, nextIdx, (idx + 2) % items.length];
    preloadIdxs.forEach((i) => {
      const it = items[i];
      const p = (it?.content_payload ?? {}) as Record<string, unknown>;
      const url = (p.image_url as string) || (p.url as string) || "";
      if (!url) return;
      // Heuristic: preload image URLs
      if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url)) {
        const img = new Image();
        img.src = url;
      } else if (it.content_type === "embed") {
        // Hidden iframe prefetch
        const f = document.createElement("link");
        f.rel = "prefetch";
        f.href = url;
        document.head.appendChild(f);
        setTimeout(() => f.remove(), 30_000);
      }
    });
  }, [idx, nextIdx, items]);

  const cur = items[idx];
  const curType = cur.content_type;
  const curPayload = (cur.content_payload ?? {}) as Record<string, unknown>;

  return (
    <div
      className={`fixed inset-0 ${
        curType === "emergency" ? "bg-red-700 text-white" : "bg-[#FAF3E3] text-stone-900"
      }`}
    >
      {items.map((it, i) => {
        const visible = i === idx;
        // Only mount current + adjacent for memory
        const mounted = visible || i === nextIdx || i === (idx - 1 + items.length) % items.length;
        if (!mounted) return null;
        const p = (it.content_payload ?? {}) as Record<string, unknown>;
        return (
          <div
            key={it.id}
            className="absolute inset-0 transition-opacity duration-500 ease-in-out"
            style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
          >
            <ContentRenderer
              type={it.content_type}
              payload={p}
              screen={screen}
              portrait={portrait}
            />
          </div>
        );
      })}
      <div className="absolute bottom-3 right-4 text-xs opacity-50 z-10">
        {screen.name} · {screen.location ?? ""} · /{screen.slug}
      </div>
    </div>
  );
}

function ContentRenderer({
  type,
  payload,
  screen,
  portrait,
}: {
  type: string;
  payload: Record<string, unknown>;
  screen: Screen;
  portrait: boolean;
}) {
  const title = (payload.title as string) || "";
  const message = (payload.message as string) || "";
  const url = (payload.url as string) || "";

  const headingSize = portrait ? "text-7xl" : "text-8xl";
  const subSize = portrait ? "text-3xl" : "text-4xl";

  switch (type) {
    case "broadcast": {
      const level = (payload.level as string) || "normal";
      const body = (payload.body as string) || message;
      const bg =
        level === "urgent"
          ? "bg-red-700 text-white"
          : level === "important"
            ? "bg-amber-500 text-stone-900"
            : "bg-sky-600 text-white";
      const tag =
        level === "urgent" ? "🚨 紧急通知" : level === "important" ? "⚠ 重要通知" : "📢 通知";
      return (
        <div className={`absolute inset-0 ${bg} flex flex-col items-center justify-center text-center px-12 gap-6`}>
          <div className={`${subSize} opacity-90 font-medium`}>{tag}</div>
          <div className={`${headingSize} font-serif font-extrabold`}>{title || "教会广播"}</div>
          {body && <div className={`${subSize} whitespace-pre-line max-w-5xl opacity-95`}>{body}</div>}
        </div>
      );
    }
    case "embed": {
      const src = url || "/";
      return (
        <iframe
          src={src}
          title={title || src}
          className="flex-1 w-full h-full border-0 bg-white"
          allow="autoplay; fullscreen"
        />
      );
    }
    case "welcome":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-8">
          <div className={`${headingSize} font-serif font-bold`}>
            {title || "欢迎来到教会"}
          </div>
          <div className={`${subSize} opacity-80 max-w-5xl`}>
            {message || "Welcome — 愿主的平安与你同在"}
          </div>
        </div>
      );
    case "qrcode":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-8">
          <div className={`${headingSize} font-serif`}>{title || "扫码"}</div>
          {url ? (
            <div className="bg-white p-6 rounded-2xl">
              <QRCodeSVG value={url} size={portrait ? 480 : 560} />
            </div>
          ) : (
            <div className={subSize}>请在后台设置二维码地址</div>
          )}
          {message && <div className={`${subSize} opacity-80 max-w-4xl`}>{message}</div>}
        </div>
      );
    case "worship":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "主日崇拜"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>
            {message || "诗歌敬拜 · 证道 · 圣餐"}
          </div>
        </div>
      );
    case "retreat":
      return (
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="bg-white p-6 rounded-2xl">
              <QRCodeSVG value={url || `${typeof window !== "undefined" ? window.location.origin : ""}/retreat-register`} size={portrait ? 380 : 460} />
            </div>
            <div className="text-left">
              <div className={`${headingSize} font-serif font-bold mb-4`}>{title || "退修会报名"}</div>
              <div className={`${subSize} opacity-80 whitespace-pre-line max-w-2xl`}>
                {message || "扫码立即报名"}
              </div>
            </div>
          </div>
        </div>
      );
    case "meal":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "今日用餐通知"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>{message}</div>
        </div>
      );
    case "announcement":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
          <div className={`${headingSize} font-serif font-bold`}>{title || "教会公告"}</div>
          <div className={`${subSize} opacity-80 whitespace-pre-line max-w-5xl`}>{message}</div>
        </div>
      );
    case "emergency":
      return (
        <EmergencyBlink>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
            <div className={`${headingSize} font-serif font-extrabold`}>⚠ {title || "紧急通知"}</div>
            <div className={`${subSize} whitespace-pre-line max-w-5xl`}>{message}</div>
          </div>
        </EmergencyBlink>
      );
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-3xl opacity-60">
          未知内容类型：{type}
        </div>
      );
  }
}

function EmergencyBlink({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 800);
    return () => clearInterval(t);
  }, []);
  return <div className={on ? "opacity-100" : "opacity-70"}>{children}</div>;
}