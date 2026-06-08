import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/pip-output")({
  component: PipOutputPage,
});

type Layout =
  | "ppt-main-video-pip"
  | "video-main-ppt-pip"
  | "side-by-side"
  | "stacked"
  | "video-only"
  | "ppt-only";

type State = {
  layout: Layout;
  videoKind: "youtube" | "url" | "camera" | "capture";
  youtubeUrl: string;
  videoUrl: string;
  pptKind: "image" | "url" | "capture";
  pptImage: string;
  pptUrl: string;
  pipPos: { x: number; y: number };
  pipSize: number;
  pipRounded: boolean;
  pipBorder: boolean;
  pipOpacity: number;
  resolution: string; // "1920x1080" | "1280x720" | "3840x2160" | "auto"
  ts: number;
};

const DEFAULT_STATE: State = {
  layout: "ppt-main-video-pip",
  videoKind: "youtube",
  youtubeUrl: "",
  videoUrl: "",
  pptKind: "image",
  pptImage: "",
  pptUrl: "",
  pipPos: { x: 70, y: 70 },
  pipSize: 28,
  pipRounded: true,
  pipBorder: true,
  pipOpacity: 100,
  resolution: "auto",
  ts: 0,
};

function ytId(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0] || "";
    if (host.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v") || "";
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "live" || p === "embed" || p === "shorts");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return "";
  } catch {
    const m = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : "";
  }
}

function VideoView({ s }: { s: State }) {
  if (s.videoKind === "youtube") {
    const id = ytId(s.youtubeUrl);
    if (!id) return <Placeholder text="未设置 YouTube 地址" />;
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0`}
        title="video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0 bg-black"
      />
    );
  }
  if (s.videoKind === "url" && s.videoUrl) {
    return <video src={s.videoUrl} autoPlay loop muted playsInline className="w-full h-full bg-black object-cover" />;
  }
  return <Placeholder text="此视频源（摄像头/采集卡）无法跨窗口输出" />;
}

function PptView({ s }: { s: State }) {
  if (s.pptKind === "image") {
    if (!s.pptImage) return <Placeholder text="未设置 PPT 图片" dark />;
    return (
      <div className="w-full h-full bg-neutral-900 flex items-center justify-center overflow-hidden">
        <img src={s.pptImage} alt="ppt" className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  if (s.pptKind === "url") {
    if (!s.pptUrl) return <Placeholder text="未设置网页地址" dark />;
    return <iframe src={s.pptUrl} title="ppt" className="w-full h-full border-0 bg-white" />;
  }
  return <Placeholder text="PPT 采集卡无法跨窗口输出" dark />;
}

function Placeholder({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <div
      className={`w-full h-full flex items-center justify-center text-sm text-white/60 ${
        dark ? "bg-neutral-900" : "bg-black"
      }`}
    >
      {text}
    </div>
  );
}

function PipOutputPage() {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("pip_output_state");
        if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
      } catch {
        // ignore
      }
    };
    load();
    const bc = new BroadcastChannel("pip-output");
    bc.onmessage = (e) => {
      if (e.data && typeof e.data === "object") {
        setState((prev) => ({ ...prev, ...e.data }));
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pip_output_state") load();
    };
    window.addEventListener("storage", onStorage);

    // Hide scrollbars
    const prevHtml = document.documentElement.style.cssText;
    const prevBody = document.body.style.cssText;
    document.documentElement.style.cssText = "margin:0;padding:0;background:#000;overflow:hidden;height:100%";
    document.body.style.cssText = "margin:0;padding:0;background:#000;overflow:hidden;height:100%";

    return () => {
      bc.close();
      window.removeEventListener("storage", onStorage);
      document.documentElement.style.cssText = prevHtml;
      document.body.style.cssText = prevBody;
    };
  }, []);

  // Resolution sizing
  const resStyle = (() => {
    if (state.resolution === "auto" || !state.resolution.includes("x")) {
      return { width: "100vw", height: "100vh" } as React.CSSProperties;
    }
    const [w, h] = state.resolution.split("x").map(Number);
    return {
      width: `${w}px`,
      height: `${h}px`,
      transform: "translate(-50%, -50%)",
      position: "absolute" as const,
      top: "50%",
      left: "50%",
    };
  })();

  const video = <VideoView s={state} />;
  const ppt = <PptView s={state} />;

  let body: React.ReactNode;
  if (state.layout === "side-by-side") {
    body = (
      <div className="absolute inset-0 grid grid-cols-2">
        <div className="overflow-hidden">{video}</div>
        <div className="overflow-hidden">{ppt}</div>
      </div>
    );
  } else if (state.layout === "stacked") {
    body = (
      <div className="absolute inset-0 grid grid-rows-2">
        <div className="overflow-hidden">{video}</div>
        <div className="overflow-hidden">{ppt}</div>
      </div>
    );
  } else if (state.layout === "video-only") {
    body = <div className="absolute inset-0">{video}</div>;
  } else if (state.layout === "ppt-only") {
    body = <div className="absolute inset-0">{ppt}</div>;
  } else {
    const main = state.layout === "video-main-ppt-pip" ? video : ppt;
    const pip = state.layout === "video-main-ppt-pip" ? ppt : video;
    body = (
      <>
        <div className="absolute inset-0">{main}</div>
        <div
          className={`absolute overflow-hidden shadow-2xl ${state.pipRounded ? "rounded-xl" : ""} ${
            state.pipBorder ? "ring-2 ring-white/80" : ""
          }`}
          style={{
            left: `${state.pipPos.x}%`,
            top: `${state.pipPos.y}%`,
            width: `${state.pipSize}%`,
            aspectRatio: "16 / 9",
            opacity: state.pipOpacity / 100,
          }}
        >
          {pip}
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div ref={containerRef} className="relative bg-black" style={resStyle}>
        {body}
      </div>
    </div>
  );
}
