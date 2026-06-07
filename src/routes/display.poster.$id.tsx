import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";

export const Route = createFileRoute("/display/poster/$id")({
  component: PosterDisplay,
});

type Poster = {
  id: string;
  slug: string | null;
  kind: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  background: string | null;
  is_active: boolean;
};

function PosterDisplay() {
  const { id } = Route.useParams();
  const [poster, setPoster] = useState<Poster | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Allow lookup by id OR slug
      const isUuid = /^[0-9a-f-]{36}$/i.test(id);
      const q = supabase.from("display_posters" as never).select("*");
      const { data } = isUuid
        ? await q.eq("id", id).maybeSingle()
        : await q.eq("slug", id).maybeSingle();
      if (cancelled) return;
      if (!data) setNotFound(true);
      else setPoster(data as Poster);
    };
    load();
    const ch = supabase
      .channel(`poster-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "display_posters" },
        load,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (notFound) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center text-2xl">
        宣传内容不存在
      </div>
    );
  }
  if (!poster) {
    return (
      <div className="fixed inset-0 bg-[#FAF3E3] flex items-center justify-center text-2xl text-stone-700">
        正在加载…
      </div>
    );
  }

  const bg = poster.background || "#FAF3E3";

  if (poster.kind === "external" && poster.link_url) {
    // PDFs can't reliably be embedded in an iframe (ERR_BLOCKED_BY_CLIENT,
    // X-Frame-Options, Chrome PDF viewer restrictions). Hand off to the
    // browser's native PDF viewer in this tab instead.
    if (/\.pdf(\?|$)/i.test(poster.link_url)) {
      if (typeof window !== "undefined") {
        window.location.replace(poster.link_url);
      }
      return (
        <div className="fixed inset-0 bg-[#FAF3E3] flex items-center justify-center text-2xl text-stone-700">
          正在打开 PDF…
          <a href={poster.link_url} className="ml-4 underline" target="_blank" rel="noopener noreferrer">手动打开</a>
        </div>
      );
    }
    return (
      <iframe
        src={poster.link_url}
        title={poster.title}
        className="fixed inset-0 w-full h-full border-0 bg-white"
        allow="autoplay; fullscreen"
      />
    );
  }

  if (poster.kind === "page" && poster.link_url) {
    if (/\.pdf(\?|$)/i.test(poster.link_url)) {
      if (typeof window !== "undefined") {
        window.location.replace(poster.link_url);
      }
      return (
        <div className="fixed inset-0 bg-[#FAF3E3] flex items-center justify-center text-2xl text-stone-700">
          正在打开 PDF…
          <a href={poster.link_url} className="ml-4 underline" target="_blank" rel="noopener noreferrer">手动打开</a>
        </div>
      );
    }
    return (
      <iframe
        src={poster.link_url}
        title={poster.title}
        className="fixed inset-0 w-full h-full border-0 bg-white"
      />
    );
  }

  if (poster.kind === "image" && poster.image_url) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: bg }}
      >
        <img
          src={poster.image_url}
          alt={poster.title}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  // text poster
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center text-center px-12 gap-8 text-stone-900"
      style={{ background: bg }}
    >
      <div className="text-7xl md:text-8xl font-serif font-bold leading-tight max-w-6xl">
        {poster.title}
      </div>
      {poster.subtitle && (
        <div className="text-3xl md:text-4xl opacity-80 max-w-5xl">
          {poster.subtitle}
        </div>
      )}
      {poster.image_url && (
        <img
          src={poster.image_url}
          alt=""
          className="max-h-[40vh] object-contain rounded-2xl shadow-lg"
        />
      )}
      {poster.body && (
        <div className="text-2xl md:text-3xl opacity-75 whitespace-pre-line max-w-5xl leading-relaxed">
          {poster.body}
        </div>
      )}
      {poster.link_url && (
        <div className="flex items-center gap-6 mt-4">
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG
              value={
                poster.link_url.startsWith("http")
                  ? poster.link_url
                  : `${getPublicOrigin()}${poster.link_url}`
              }
              size={220}
            />
          </div>
          <div className="text-xl opacity-70">扫码查看 / 报名</div>
        </div>
      )}
    </div>
  );
}