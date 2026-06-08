import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Layers,
  Video,
  Image as ImageIcon,
  Maximize2,
  Camera,
  Youtube,
  Globe,
  Upload,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Cable,
  RefreshCw,
  Monitor,
  MonitorPlay,
  Radio,
  Copy as CopyIcon,
  Square,
  ExternalLink,
  ImageDown,
} from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { cn } from "@/lib/utils";
import PipAudioMonitor from "./PipAudioMonitor";

type OutputMode = "preview" | "second-screen" | "fullscreen" | "obs" | "ndi" | "rtmp";
type OutputStatus = "idle" | "browser" | "second" | "obs";

type VideoKind = "youtube" | "camera" | "capture" | "url";
type PptKind = "image" | "url" | "capture";
type Layout =
  | "ppt-main-video-pip"
  | "video-main-ppt-pip"
  | "side-by-side"
  | "stacked"
  | "video-only"
  | "ppt-only";
type Corner = "tl" | "tr" | "bl" | "br";

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

function VideoSourceView({
  kind,
  youtubeUrl,
  videoUrl,
  cameraStream,
  captureStream,
  className,
}: {
  kind: VideoKind;
  youtubeUrl: string;
  videoUrl: string;
  cameraStream: MediaStream | null;
  captureStream: MediaStream | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (kind === "camera" && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
    if (kind === "capture" && videoRef.current && captureStream) {
      videoRef.current.srcObject = captureStream;
    }
  }, [kind, cameraStream, captureStream]);

  if (kind === "youtube") {
    const id = ytId(youtubeUrl);
    if (!id) {
      return (
        <div className={cn("flex items-center justify-center text-xs text-white/60 bg-black", className)}>
          未设置 YouTube 地址
        </div>
      );
    }
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=1`}
        title="video-source"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={cn("border-0 bg-black", className)}
      />
    );
  }
  if (kind === "camera") {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn("bg-black object-cover", className)}
      />
    );
  }
  if (kind === "capture") {
    if (!captureStream) {
      return (
        <div className={cn("flex items-center justify-center text-xs text-white/60 bg-black", className)}>
          未连接采集设备
        </div>
      );
    }
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn("bg-black object-contain", className)}
      />
    );
  }
  if (kind === "url" && videoUrl) {
    return (
      <video src={videoUrl} autoPlay loop muted playsInline className={cn("bg-black object-cover", className)} />
    );
  }
  return (
    <div className={cn("flex items-center justify-center text-xs text-white/60 bg-black", className)}>
      未设置视频源
    </div>
  );
}

function PptSourceView({
  kind,
  imageUrl,
  pageUrl,
  captureStream,
  className,
}: {
  kind: PptKind;
  imageUrl: string;
  pageUrl: string;
  captureStream: MediaStream | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (kind === "capture" && videoRef.current && captureStream) {
      videoRef.current.srcObject = captureStream;
    }
  }, [kind, captureStream]);

  if (kind === "capture") {
    if (!captureStream) {
      return (
        <div className={cn("flex items-center justify-center text-xs text-white/60 bg-neutral-900", className)}>
          未连接 PPT 采集设备
        </div>
      );
    }
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn("bg-neutral-900 object-contain", className)}
      />
    );
  }
  if (kind === "image") {
    if (!imageUrl) {
      return (
        <div className={cn("flex items-center justify-center text-xs text-white/60 bg-neutral-900", className)}>
          未上传图片
        </div>
      );
    }
    return (
      <div className={cn("bg-neutral-900 flex items-center justify-center overflow-hidden", className)}>
        <img src={imageUrl} alt="ppt" className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  if (!pageUrl) {
    return (
      <div className={cn("flex items-center justify-center text-xs text-white/60 bg-neutral-900", className)}>
        未设置网页地址
      </div>
    );
  }
  return (
    <iframe
      src={pageUrl}
      title="ppt-source"
      className={cn("border-0 bg-white", className)}
    />
  );
}

export default function PipComposer() {
  // Video source
  const [videoKind, setVideoKind] = useState<VideoKind>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("admin_youtube_live_url") || "",
  );
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoCaptureStream, setVideoCaptureStream] = useState<MediaStream | null>(null);
  const [videoCaptureDeviceId, setVideoCaptureDeviceId] = useState<string>("");

  // PPT source
  const [pptKind, setPptKind] = useState<PptKind>("image");
  const [pptImage, setPptImage] = useState<string>("");
  const [pptUrl, setPptUrl] = useState<string>("");
  const [pptCaptureStream, setPptCaptureStream] = useState<MediaStream | null>(null);
  const [pptCaptureDeviceId, setPptCaptureDeviceId] = useState<string>("");

  // Device list
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  // Layout & PIP
  const [layout, setLayout] = useState<Layout>("ppt-main-video-pip");
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: 70, y: 70 }); // percent
  const [pipSize, setPipSize] = useState<number>(28); // percent of width
  const [pipRounded, setPipRounded] = useState<boolean>(true);
  const [pipBorder, setPipBorder] = useState<boolean>(true);
  const [pipOpacity, setPipOpacity] = useState<number>(100);

  // Output settings
  const [outputMode, setOutputMode] = useState<OutputMode>("preview");
  const [outputStatus, setOutputStatus] = useState<OutputStatus>("idle");
  const [outputResolution, setOutputResolution] = useState<string>("auto");
  const [rtmpUrl, setRtmpUrl] = useState<string>("");
  const [rtmpKey, setRtmpKey] = useState<string>("");
  const outputWindowRef = useRef<Window | null>(null);

  // Refs
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ active: boolean; offX: number; offY: number }>({
    active: false,
    offX: 0,
    offY: 0,
  });

  useEffect(() => {
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
      if (videoCaptureStream) videoCaptureStream.getTracks().forEach((t) => t.stop());
      if (pptCaptureStream) pptCaptureStream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream, videoCaptureStream, pptCaptureStream]);

  const refreshDevices = async () => {
    try {
      // Need permission first to get device labels
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore — may still list devices without labels
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter((d) => d.kind === "videoinput");
      setVideoDevices(vids);
      toast.success(`检测到 ${vids.length} 个视频输入设备`);
    } catch {
      toast.error("无法枚举视频设备");
    }
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setVideoDevices(list.filter((d) => d.kind === "videoinput"));
    }).catch(() => {});
  }, []);

  const openCapture = async (target: "video" | "ppt", deviceId: string) => {
    if (!deviceId) {
      toast.error("请先选择采集设备");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (target === "video") {
        if (videoCaptureStream) videoCaptureStream.getTracks().forEach((t) => t.stop());
        setVideoCaptureStream(s);
        setVideoKind("capture");
      } else {
        if (pptCaptureStream) pptCaptureStream.getTracks().forEach((t) => t.stop());
        setPptCaptureStream(s);
        setPptKind("capture");
      }
      toast.success("采集设备已连接");
    } catch {
      toast.error("无法打开采集设备（请检查权限/占用）");
    }
  };

  const closeCapture = (target: "video" | "ppt") => {
    if (target === "video") {
      if (videoCaptureStream) videoCaptureStream.getTracks().forEach((t) => t.stop());
      setVideoCaptureStream(null);
    } else {
      if (pptCaptureStream) pptCaptureStream.getTracks().forEach((t) => t.stop());
      setPptCaptureStream(null);
    }
    toast.message("采集设备已断开");
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(s);
      setVideoKind("camera");
      toast.success("摄像头已开启");
    } catch {
      toast.error("无法获取摄像头权限");
    }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    toast.message("摄像头已关闭");
  };

  const onUploadPpt = (file: File) => {
    const url = URL.createObjectURL(file);
    setPptImage(url);
    setPptKind("image");
    toast.success("图片已加载");
  };

  const setCorner = (c: Corner) => {
    const margin = 2;
    const size = pipSize;
    const aspect = 9 / 16;
    const hPct = size * aspect; // not exact but ok for default
    const xMax = 100 - size - margin;
    const yMax = 100 - hPct * (16 / 9) - margin; // height in % depends on stage aspect
    const positions: Record<Corner, { x: number; y: number }> = {
      tl: { x: margin, y: margin },
      tr: { x: xMax, y: margin },
      bl: { x: margin, y: Math.max(margin, yMax) },
      br: { x: xMax, y: Math.max(margin, yMax) },
    };
    setPipPos(positions[c]);
  };

  const handleDragStart = (e: React.PointerEvent) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const xPx = (pipPos.x / 100) * rect.width;
    const yPx = (pipPos.y / 100) * rect.height;
    dragState.current = {
      active: true,
      offX: e.clientX - rect.left - xPx,
      offY: e.clientY - rect.top - yPx,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState.current.active || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left - dragState.current.offX;
    const yPx = e.clientY - rect.top - dragState.current.offY;
    setPipPos({
      x: Math.max(0, Math.min(100 - pipSize, (xPx / rect.width) * 100)),
      y: Math.max(0, Math.min(95, (yPx / rect.height) * 100)),
    });
  };
  const handleDragEnd = (e: React.PointerEvent) => {
    dragState.current.active = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const goFullscreen = () => {
    if (stageRef.current?.requestFullscreen) stageRef.current.requestFullscreen();
    else toast.error("当前浏览器不支持全屏");
  };

  // ===== Output: serialize state and broadcast to /pip-output window =====
  const outputUrl = useMemo(
    () => (typeof window === "undefined" ? "/pip-output" : `${window.location.origin}/pip-output`),
    [],
  );

  const serializedState = useMemo(
    () => ({
      layout,
      videoKind,
      youtubeUrl,
      videoUrl,
      pptKind,
      pptImage,
      pptUrl,
      pipPos,
      pipSize,
      pipRounded,
      pipBorder,
      pipOpacity,
      resolution: outputResolution,
      ts: Date.now(),
    }),
    [
      layout, videoKind, youtubeUrl, videoUrl, pptKind, pptImage, pptUrl,
      pipPos, pipSize, pipRounded, pipBorder, pipOpacity, outputResolution,
    ],
  );

  useEffect(() => {
    try {
      localStorage.setItem("pip_output_state", JSON.stringify(serializedState));
    } catch { /* noop */ }
    try {
      const bc = new BroadcastChannel("pip-output");
      bc.postMessage(serializedState);
      bc.close();
    } catch { /* noop */ }
  }, [serializedState]);

  // Detect when output window closes
  useEffect(() => {
    if (!outputWindowRef.current) return;
    const id = window.setInterval(() => {
      if (outputWindowRef.current?.closed) {
        outputWindowRef.current = null;
        setOutputStatus((s) => (s === "browser" || s === "second" ? "idle" : s));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [outputStatus]);

  const usesUncapturableSource =
    videoKind === "camera" || videoKind === "capture" || pptKind === "capture";

  const openOutputWindow = (features: string) => {
    // Persist latest state first so the new tab reads it on load
    try {
      localStorage.setItem("pip_output_state", JSON.stringify(serializedState));
    } catch { /* noop */ }
    const w = window.open("/pip-output", "pip-output", features);
    if (!w) {
      toast.error("无法打开输出窗口，请允许弹出窗口");
      return null;
    }
    outputWindowRef.current = w;
    return w;
  };

  const startBrowserOutput = () => {
    if (usesUncapturableSource) {
      toast.warning("摄像头/采集卡 无法跨窗口输出，输出窗口将提示占位");
    }
    const w = openOutputWindow("popup,width=1920,height=1080");
    if (!w) return;
    setOutputStatus("browser");
    toast.success("已打开输出窗口，按 F11 进入全屏");
  };

  const startSecondScreen = async () => {
    const anyNav = navigator as any;
    if (!anyNav.getScreenDetails) {
      // Fallback: just open a popup and hint
      const w = openOutputWindow("popup,width=1920,height=1080,left=2000,top=0");
      if (!w) return;
      setOutputStatus("second");
      toast.message("浏览器不支持多屏 API，请手动将窗口拖到第二屏后按 F11");
      return;
    }
    try {
      const sd = await anyNav.getScreenDetails();
      const other = sd.screens.find((s: any) => !s.isPrimary) ?? sd.screens[0];
      const w = openOutputWindow(
        `popup,width=${other.availWidth},height=${other.availHeight},left=${other.availLeft},top=${other.availTop}`,
      );
      if (!w) return;
      setTimeout(() => {
        try { w.document.documentElement.requestFullscreen?.(); } catch { /* noop */ }
      }, 500);
      setOutputStatus("second");
      toast.success(`已输出到第二屏 (${other.availWidth}×${other.availHeight})`);
    } catch {
      toast.error("无法访问多屏信息，请授权 Window Management 权限");
    }
  };

  const stopOutput = () => {
    try { outputWindowRef.current?.close(); } catch { /* noop */ }
    outputWindowRef.current = null;
    setOutputStatus("idle");
    toast.message("已停止输出");
  };

  const copyObsLink = async () => {
    try {
      await navigator.clipboard.writeText(outputUrl);
      setOutputStatus("obs");
      toast.success("已复制 OBS Browser Source 链接");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const takeScreenshot = async () => {
    if (!stageRef.current) return;
    try {
      const dataUrl = await toPng(stageRef.current, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `pip-snapshot-${Date.now()}.png`;
      a.click();
      toast.success("已保存当前画面");
    } catch {
      toast.error("截图失败（YouTube/网页等跨域内容无法捕获）");
    }
  };


  // Layout rendering
  const renderStage = useMemo(() => {
    const video = (
      <VideoSourceView
        kind={videoKind}
        youtubeUrl={youtubeUrl}
        videoUrl={videoUrl}
        cameraStream={cameraStream}
        captureStream={videoCaptureStream}
        className="w-full h-full"
      />
    );
    const ppt = (
      <PptSourceView
        kind={pptKind}
        imageUrl={pptImage}
        pageUrl={pptUrl}
        captureStream={pptCaptureStream}
        className="w-full h-full"
      />
    );

    if (layout === "side-by-side") {
      return (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="overflow-hidden">{video}</div>
          <div className="overflow-hidden">{ppt}</div>
        </div>
      );
    }
    if (layout === "stacked") {
      return (
        <div className="absolute inset-0 grid grid-rows-2">
          <div className="overflow-hidden">{video}</div>
          <div className="overflow-hidden">{ppt}</div>
        </div>
      );
    }
    if (layout === "video-only") {
      return <div className="absolute inset-0">{video}</div>;
    }
    if (layout === "ppt-only") {
      return <div className="absolute inset-0">{ppt}</div>;
    }

    // PIP layouts
    const main = layout === "video-main-ppt-pip" ? video : ppt;
    const pip = layout === "video-main-ppt-pip" ? ppt : video;
    return (
      <>
        <div className="absolute inset-0">{main}</div>
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className={cn(
            "absolute overflow-hidden cursor-move select-none touch-none shadow-2xl",
            pipRounded && "rounded-xl",
            pipBorder && "ring-2 ring-white/80",
          )}
          style={{
            left: `${pipPos.x}%`,
            top: `${pipPos.y}%`,
            width: `${pipSize}%`,
            aspectRatio: "16 / 9",
            opacity: pipOpacity / 100,
          }}
        >
          <div className="w-full h-full pointer-events-none">{pip}</div>
        </div>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layout, videoKind, youtubeUrl, videoUrl, cameraStream, videoCaptureStream,
    pptKind, pptImage, pptUrl, pptCaptureStream,
    pipPos.x, pipPos.y, pipSize, pipRounded, pipBorder, pipOpacity,
  ]);

  const layoutOptions: { v: Layout; label: string }[] = [
    { v: "ppt-main-video-pip", label: "PPT 大画面 + 视频小窗" },
    { v: "video-main-ppt-pip", label: "视频大画面 + PPT 小窗" },
    { v: "side-by-side", label: "左右分屏" },
    { v: "stacked", label: "上下分屏" },
    { v: "video-only", label: "仅视频" },
    { v: "ppt-only", label: "仅 PPT" },
  ];

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h3 className="font-serif text-xl flex items-center gap-2">
            <Layers className="text-primary" />
            画面合成器（简易 PIP）
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            将视频源与 PPT 源合成预览，适合无 OBS 时快速预览直播画面
          </p>
        </div>
        <Button variant="outline" onClick={goFullscreen} className="gap-2">
          <Maximize2 className="size-4" />
          全屏预览
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] gap-5">
        {/* 左侧：输入源 */}
        <div className="space-y-5">
          <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Video className="size-4 text-primary" /> 视频源
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { v: "youtube", label: "YouTube", icon: <Youtube className="size-3.5" /> },
                { v: "camera", label: "摄像头", icon: <Camera className="size-3.5" /> },
                { v: "capture", label: "采集卡", icon: <Cable className="size-3.5" /> },
                { v: "url", label: "视频URL", icon: <Globe className="size-3.5" /> },
              ] as { v: VideoKind; label: string; icon: React.ReactNode }[]).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setVideoKind(o.v)}
                  className={cn(
                    "text-xs py-1.5 rounded-md border flex items-center justify-center gap-1 transition-colors",
                    videoKind === o.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted/40",
                  )}
                >
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
            {videoKind === "youtube" && (
              <Input
                placeholder="YouTube 链接"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="text-sm"
              />
            )}
            {videoKind === "url" && (
              <Input
                placeholder="视频地址 (mp4/HLS/RTMP 预留)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="text-sm"
              />
            )}
            {videoKind === "camera" && (
              <div className="flex gap-2">
                {!cameraStream ? (
                  <Button size="sm" onClick={startCamera} className="flex-1 gap-1">
                    <Camera className="size-3.5" /> 开启摄像头
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={stopCamera} className="flex-1">
                    关闭摄像头
                  </Button>
                )}
              </div>
            )}
            {videoKind === "capture" && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <select
                    value={videoCaptureDeviceId}
                    onChange={(e) => setVideoCaptureDeviceId(e.target.value)}
                    className="flex-1 text-xs border border-border rounded-md bg-background px-2 py-1.5 min-w-0"
                  >
                    <option value="">选择采集设备…</option>
                    {videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `设备 ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshDevices}
                    className="px-2"
                    title="刷新设备列表"
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {!videoCaptureStream ? (
                    <Button size="sm" onClick={() => openCapture("video", videoCaptureDeviceId)} className="flex-1 gap-1">
                      <Cable className="size-3.5" /> 连接采集卡
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => closeCapture("video")} className="flex-1">
                      断开采集卡
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  支持 USB / HDMI 视频采集卡。首次使用需授权摄像头权限以读取设备列表。
                </p>
              </div>
            )}
          </div>

          <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" /> PPT 源
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { v: "image", label: "图片" },
                { v: "url", label: "网页" },
                { v: "capture", label: "采集卡" },
              ] as { v: PptKind; label: string }[]).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setPptKind(o.v)}
                  className={cn(
                    "text-xs py-1.5 rounded-md border transition-colors",
                    pptKind === o.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted/40",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {pptKind === "image" && (
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-2 text-xs px-3 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/40">
                  <Upload className="size-3.5" />
                  上传图片
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadPpt(f);
                    }}
                  />
                </label>
                {pptImage && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    已加载：本地图片
                  </div>
                )}
              </div>
            )}
            {pptKind === "url" && (
              <Input
                placeholder="网页地址 https://..."
                value={pptUrl}
                onChange={(e) => setPptUrl(e.target.value)}
                className="text-sm"
              />
            )}
            {pptKind === "capture" && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <select
                    value={pptCaptureDeviceId}
                    onChange={(e) => setPptCaptureDeviceId(e.target.value)}
                    className="flex-1 text-xs border border-border rounded-md bg-background px-2 py-1.5 min-w-0"
                  >
                    <option value="">选择采集设备…</option>
                    {videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `设备 ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshDevices}
                    className="px-2"
                    title="刷新设备列表"
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {!pptCaptureStream ? (
                    <Button size="sm" onClick={() => openCapture("ppt", pptCaptureDeviceId)} className="flex-1 gap-1">
                      <Cable className="size-3.5" /> 连接 PPT 采集卡
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => closeCapture("ppt")} className="flex-1">
                      断开采集卡
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  可将另一台电脑的 PPT 通过 HDMI 采集卡接入，作为 PPT 源参与合成。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 中间：合成预览 */}
        <div>
          <div
            ref={stageRef}
            className="relative w-full bg-black rounded-xl overflow-hidden border border-border/60 shadow-inner"
            style={{ aspectRatio: "16 / 9" }}
          >
            {renderStage}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono">
              PREVIEW · 16:9
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            提示：PIP 小窗可直接拖动；如需推流到直播端，将在后续阶段提供 OBS Browser Source 与 RTMP 输出。
          </p>

          <PipAudioMonitor
            cameraStream={cameraStream}
            videoCaptureStream={videoCaptureStream}
            pptCaptureStream={pptCaptureStream}
            layout={layout}
            videoKind={videoKind}
            pptKind={pptKind}
            compact
          />
        </div>

        {/* 右侧：布局 / PIP 控制 */}
        <div className="space-y-4">
          <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-2">
            <div className="text-sm font-medium mb-1">布局模式</div>
            <div className="grid grid-cols-1 gap-1.5">
              {layoutOptions.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setLayout(o.v)}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md border text-left transition-colors",
                    layout === o.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted/40",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {(layout === "ppt-main-video-pip" || layout === "video-main-ppt-pip") && (
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium">PIP 小窗设置</div>

              <div>
                <Label className="text-[11px] text-muted-foreground">快速定位</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  <Button size="sm" variant="outline" className="h-8 p-0" onClick={() => setCorner("tl")}>
                    <CornerUpLeft className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 p-0" onClick={() => setCorner("tr")}>
                    <CornerUpRight className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 p-0" onClick={() => setCorner("bl")}>
                    <CornerDownLeft className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 p-0" onClick={() => setCorner("br")}>
                    <CornerDownRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">小窗大小</Label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{pipSize}%</span>
                </div>
                <Slider
                  value={[pipSize]}
                  min={15}
                  max={50}
                  step={1}
                  onValueChange={(v) => setPipSize(v[0])}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">透明度</Label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{pipOpacity}%</span>
                </div>
                <Slider
                  value={[pipOpacity]}
                  min={20}
                  max={100}
                  step={5}
                  onValueChange={(v) => setPipOpacity(v[0])}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <Label className="text-foreground/80">圆角</Label>
                <Switch checked={pipRounded} onCheckedChange={setPipRounded} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-foreground/80">边框</Label>
                <Switch checked={pipBorder} onCheckedChange={setPipBorder} />
              </div>
            </div>
          )}

          <PipAudioMonitor
            cameraStream={cameraStream}
            videoCaptureStream={videoCaptureStream}
            pptCaptureStream={pptCaptureStream}
            layout={layout}
            videoKind={videoKind}
            pptKind={pptKind}
          />
        </div>
      </div>

      {/* ===== 输出设置 Output ===== */}
      <div className="mt-6 bg-background/60 border border-border/60 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <MonitorPlay className="size-4 text-primary" />
            <h4 className="font-medium">输出设置 (Output)</h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">当前输出：</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                outputStatus === "idle"
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  outputStatus === "idle" ? "bg-muted-foreground" : "bg-emerald-500 animate-pulse",
                )}
              />
              {outputStatus === "idle" && "未输出"}
              {outputStatus === "browser" && "浏览器输出中"}
              {outputStatus === "second" && "第二屏输出中"}
              {outputStatus === "obs" && "OBS 链接已生成"}
            </span>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">输出模式</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-2">
            {([
              { v: "preview", label: "仅预览", icon: <Monitor className="size-3.5" /> },
              { v: "second-screen", label: "第二显示器输出", icon: <MonitorPlay className="size-3.5" /> },
              { v: "fullscreen", label: "浏览器全屏输出", icon: <Maximize2 className="size-3.5" /> },
              { v: "obs", label: "OBS Browser Source", icon: <ExternalLink className="size-3.5" /> },
              { v: "ndi", label: "NDI 输出（预留）", icon: <Radio className="size-3.5" /> },
              { v: "rtmp", label: "RTMP 推流（预留）", icon: <Radio className="size-3.5" /> },
            ] as { v: OutputMode; label: string; icon: React.ReactNode }[]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setOutputMode(o.v)}
                className={cn(
                  "text-xs py-2 px-2 rounded-md border flex items-center gap-1.5 transition-colors",
                  outputMode === o.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted/40",
                )}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {outputMode === "fullscreen" && (
              <>
                <p className="text-xs text-muted-foreground">
                  在新窗口打开合成画面，按 F11 进入全屏，适合投影机 / 电视 / 主屏幕。
                </p>
                <div className="flex gap-2">
                  <Button onClick={startBrowserOutput} className="gap-1.5">
                    <ExternalLink className="size-3.5" /> 开始输出
                  </Button>
                  {outputStatus !== "idle" && (
                    <Button variant="outline" onClick={stopOutput} className="gap-1.5">
                      <Square className="size-3.5" /> 停止输出
                    </Button>
                  )}
                </div>
              </>
            )}

            {outputMode === "second-screen" && (
              <>
                <p className="text-xs text-muted-foreground">
                  自动检测多显示器并在第二屏全屏输出。需浏览器支持 Window Management。
                </p>
                <div className="flex gap-2">
                  <Button onClick={startSecondScreen} className="gap-1.5">
                    <MonitorPlay className="size-3.5" /> 输出到第二屏
                  </Button>
                  {outputStatus !== "idle" && (
                    <Button variant="outline" onClick={stopOutput} className="gap-1.5">
                      <Square className="size-3.5" /> 停止输出
                    </Button>
                  )}
                </div>
              </>
            )}

            {outputMode === "obs" && (
              <>
                <p className="text-xs text-muted-foreground">
                  在 OBS 中新增 <b>Browser Source</b>，将下方链接粘贴为 URL 即可接入：
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={outputUrl} className="text-xs font-mono" />
                  <Button variant="outline" onClick={copyObsLink} className="gap-1.5">
                    <CopyIcon className="size-3.5" /> 复制
                  </Button>
                </div>
              </>
            )}

            {outputMode === "preview" && (
              <p className="text-xs text-muted-foreground">仅在本页面预览，不进行外部输出。</p>
            )}

            {outputMode === "ndi" && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>NDI 输出（预留），供教会直播设备接收 IP 视频流。</p>
                <p className="text-[11px] opacity-70">需配合本地 NDI Bridge / NDI Tools 使用，后续版本开放。</p>
              </div>
            )}

            {outputMode === "rtmp" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">推流到直播服务器（预留）。</p>
                <Input
                  placeholder="rtmp://your-server/live"
                  value={rtmpUrl}
                  onChange={(e) => setRtmpUrl(e.target.value)}
                  className="text-sm font-mono"
                />
                <Input
                  placeholder="推流码 stream key"
                  value={rtmpKey}
                  onChange={(e) => setRtmpKey(e.target.value)}
                  className="text-sm font-mono"
                />
                <Button disabled variant="outline" className="w-full">即将开放</Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">输出分辨率</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[
                  { v: "auto", label: "自动" },
                  { v: "1280x720", label: "720p" },
                  { v: "1920x1080", label: "1080p" },
                  { v: "3840x2160", label: "4K" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setOutputResolution(o.v)}
                    className={cn(
                      "text-xs py-1.5 rounded-md border transition-colors",
                      outputResolution === o.v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted/40",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">截图</Label>
              <div className="mt-2">
                <Button variant="outline" onClick={takeScreenshot} className="gap-1.5 w-full">
                  <ImageDown className="size-3.5" /> 保存当前画面为 PNG
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                  注意：YouTube / 跨域网页内容因浏览器安全限制无法被截取。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}