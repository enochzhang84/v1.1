import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, Mic, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * 音频状态监控 — 实时显示各音源电平 / 音量 / 静音 / 主输出源
 * 仅做电平检测，不录制、不保存任何音频数据。
 */

type SourceKey = "video" | "ppt" | "camera" | "youtube" | "none";
type Layout =
  | "ppt-main-video-pip"
  | "video-main-ppt-pip"
  | "side-by-side"
  | "stacked"
  | "video-only"
  | "ppt-only";

export type PipAudioMonitorProps = {
  cameraStream: MediaStream | null;
  videoCaptureStream: MediaStream | null;
  pptCaptureStream: MediaStream | null;
  layout: Layout;
  videoKind: "youtube" | "url" | "camera" | "capture";
  pptKind: "image" | "url" | "capture";
  compact?: boolean;
};

type Channel = { peak: number; rms: number };

function dbFrom(rms: number) {
  if (rms <= 0.0001) return -90;
  return Math.max(-90, 20 * Math.log10(rms));
}

function Meter({ ch, mute, compact }: { ch: Channel; mute?: boolean; compact?: boolean }) {
  const db = dbFrom(ch.rms);
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const clipping = ch.peak > 0.98;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("flex-1 rounded-full bg-muted overflow-hidden", compact ? "h-1.5" : "h-2")}>
        <div
          className={cn(
            "h-full transition-[width] duration-75",
            mute ? "bg-muted-foreground/40" : clipping ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("tabular-nums text-muted-foreground text-right", compact ? "text-[9px] w-8" : "text-[10px] w-12")}>
        {db <= -90 ? "-∞" : `${db.toFixed(0)} dB`}
      </span>
    </div>
  );
}

function useStreamAnalyser(stream: MediaStream | null) {
  const [chs, setChs] = useState<Channel[]>([{ peak: 0, rms: 0 }, { peak: 0, rms: 0 }]);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<AnalyserNode[]>([]);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setChs([{ peak: 0, rms: 0 }, { peak: 0, rms: 0 }]);
      return;
    }
    let cancelled = false;
    const start = async () => {
      try {
        const AC: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const splitter = ctx.createChannelSplitter(2);
        src.connect(splitter);
        const a0 = ctx.createAnalyser();
        const a1 = ctx.createAnalyser();
        a0.fftSize = 512;
        a1.fftSize = 512;
        splitter.connect(a0, 0);
        splitter.connect(a1, Math.min(1, src.channelCount - 1));
        ctxRef.current = ctx;
        analysersRef.current = [a0, a1];

        const buf0 = new Float32Array(a0.fftSize);
        const buf1 = new Float32Array(a1.fftSize);
        const loop = () => {
          if (cancelled) return;
          a0.getFloatTimeDomainData(buf0);
          a1.getFloatTimeDomainData(buf1);
          const compute = (b: Float32Array): Channel => {
            let peak = 0;
            let sum = 0;
            for (let i = 0; i < b.length; i++) {
              const v = Math.abs(b[i]);
              if (v > peak) peak = v;
              sum += b[i] * b[i];
            }
            return { peak, rms: Math.sqrt(sum / b.length) };
          };
          setChs([compute(buf0), compute(buf1)]);
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        // ignore — no audio track or blocked
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { ctxRef.current?.close(); } catch { /* noop */ }
      ctxRef.current = null;
      analysersRef.current = [];
    };
  }, [stream]);

  return chs;
}

function useTrackMute(stream: MediaStream | null) {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [stream, muted]);
  return [muted, setMuted] as const;
}

export default function PipAudioMonitor(props: PipAudioMonitorProps) {
  const { cameraStream, videoCaptureStream, pptCaptureStream, layout, videoKind, pptKind, compact } = props;

  const cameraCh = useStreamAnalyser(cameraStream);
  const videoCapCh = useStreamAnalyser(videoCaptureStream);
  const pptCapCh = useStreamAnalyser(pptCaptureStream);

  const [cameraMute, setCameraMute] = useTrackMute(cameraStream);
  const [videoCapMute, setVideoCapMute] = useTrackMute(videoCaptureStream);
  const [pptCapMute, setPptCapMute] = useTrackMute(pptCaptureStream);

  const [cameraVol, setCameraVol] = useState(80);
  const [videoCapVol, setVideoCapVol] = useState(80);
  const [pptCapVol, setPptCapVol] = useState(80);
  const [youtubeVol, setYoutubeVol] = useState(80);

  const [followMain, setFollowMain] = useState(true);
  const [manualSource, setManualSource] = useState<SourceKey>("video");

  // Resolve active output source
  const mainSide: "video" | "ppt" =
    layout === "video-main-ppt-pip" || layout === "video-only" || layout === "side-by-side"
      ? "video"
      : "ppt";

  const activeSource: SourceKey = useMemo(() => {
    if (!followMain) return manualSource;
    if (mainSide === "video") {
      if (videoKind === "youtube") return "youtube";
      if (videoKind === "camera") return "camera";
      if (videoKind === "capture") return "video";
      return "video";
    }
    if (pptKind === "capture") return "ppt";
    return "none";
  }, [followMain, manualSource, mainSide, videoKind, pptKind]);

  // Peak across L/R for the active source
  const activePeak = (() => {
    if (activeSource === "camera") return Math.max(cameraCh[0].peak, cameraCh[1].peak);
    if (activeSource === "video") return Math.max(videoCapCh[0].peak, videoCapCh[1].peak);
    if (activeSource === "ppt") return Math.max(pptCapCh[0].peak, pptCapCh[1].peak);
    return 0;
  })();
  const activeMuted =
    (activeSource === "camera" && cameraMute) ||
    (activeSource === "video" && videoCapMute) ||
    (activeSource === "ppt" && pptCapMute) ||
    activeSource === "none" ||
    activeSource === "youtube"; // youtube iframe is always muted in preview

  // Silence detector — 5s with no signal
  const [silentTooLong, setSilentTooLong] = useState(false);
  const lastSoundRef = useRef<number>(Date.now());
  useEffect(() => {
    if (activePeak > 0.01) lastSoundRef.current = Date.now();
    const id = setInterval(() => {
      setSilentTooLong(!activeMuted && Date.now() - lastSoundRef.current > 5000);
    }, 500);
    return () => clearInterval(id);
  }, [activePeak, activeMuted]);

  const clipping = activePeak > 0.98;

  const sourceLabel: Record<SourceKey, string> = {
    video: "采集卡（视频侧）",
    ppt: "采集卡（PPT 侧）",
    camera: "摄像头",
    youtube: "YouTube",
    none: "无声音",
  };

  // Output state summary
  const outputState =
    activeSource === "none" ? "无输入"
      : activeMuted ? "静音"
      : clipping ? "音量过大"
      : "正常";

  return (
    <div className={cn("bg-background/60 border border-border/60 rounded-xl space-y-3", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <Mic className="size-4 text-primary" /> 音频状态
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            来自：<span className="text-foreground font-medium">{sourceLabel[activeSource]}</span>
          </span>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              outputState === "正常" && "bg-emerald-50 text-emerald-700 border-emerald-200",
              outputState === "静音" && "bg-muted text-muted-foreground border-border",
              outputState === "无输入" && "bg-amber-50 text-amber-700 border-amber-200",
              outputState === "音量过大" && "bg-red-50 text-red-700 border-red-200",
            )}
          >
            输出：{outputState}
          </span>
        </div>
      </div>

      {/* 警告 */}
      {(silentTooLong || clipping) && (
        <div className="flex items-center gap-3 flex-wrap">
          {silentTooLong && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              <AlertTriangle className="size-3" /> 无声音输入
            </div>
          )}
          {clipping && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">
              <AlertTriangle className="size-3" /> 声音过大
            </div>
          )}
        </div>
      )}

      {/* 各音源电平 */}
      <div className={cn(compact ? "grid grid-cols-5 gap-2 pt-1" : "space-y-3 pt-1")}>
        <SourceRow
          label="视频采集"
          present={!!videoCaptureStream}
          chs={videoCapCh}
          mute={videoCapMute}
          onMute={() => setVideoCapMute((m) => !m)}
          vol={videoCapVol}
          setVol={setVideoCapVol}
          compact={compact}
        />
        <SourceRow
          label="PPT采集"
          present={!!pptCaptureStream}
          chs={pptCapCh}
          mute={pptCapMute}
          onMute={() => setPptCapMute((m) => !m)}
          vol={pptCapVol}
          setVol={setPptCapVol}
          compact={compact}
        />
        <SourceRow
          label="摄像头"
          present={!!cameraStream}
          chs={cameraCh}
          mute={cameraMute}
          onMute={() => setCameraMute((m) => !m)}
          vol={cameraVol}
          setVol={setCameraVol}
          compact={compact}
        />
        <SourceRow
          label="YouTube"
          present={videoKind === "youtube"}
          chs={[{ peak: 0, rms: 0 }, { peak: 0, rms: 0 }]}
          mute={false}
          onMute={() => { /* iframe controls own playback */ }}
          vol={youtubeVol}
          setVol={setYoutubeVol}
          note="iframe 沙箱内无法检测电平"
          compact={compact}
          levelUnavailable
          status="已加载"
          hideMuteButton
        />
      </div>

      {/* 来源选择 */}
      <div className={cn("border-t border-border/40 space-y-2", compact ? "pt-1.5" : "pt-2")}>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={followMain}
            onChange={(e) => setFollowMain(e.target.checked)}
          />
          <span>音频跟随主画面</span>
        </label>

        <div className={cn("space-y-1", followMain && "opacity-50 pointer-events-none")}>
          <div className="text-[11px] text-muted-foreground">手动选择声音源</div>
          <div className={cn("gap-1", compact ? "flex" : "grid grid-cols-3")}>
            {([
              { v: "video", l: "视频源" },
              { v: "ppt", l: "PPT 源" },
              { v: "camera", l: "摄像头" },
              { v: "youtube", l: "YouTube" },
              { v: "none", l: "无声音" },
            ] as { v: SourceKey; l: string }[]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setManualSource(o.v)}
                className={cn(
                  "text-[11px] py-1 rounded-md border transition-colors flex-1",
                  manualSource === o.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted/40",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border/40">
          系统仅检测音量电平，不录制、不保存声音。
        </p>
      )}
    </div>
  );
}

function SourceRow({
  label,
  present,
  chs,
  mute,
  onMute,
  vol,
  setVol,
  note,
  compact,
  levelUnavailable,
  status,
  hideMuteButton,
}: {
  label: string;
  present: boolean;
  chs: Channel[];
  mute: boolean;
  onMute: () => void;
  vol: number;
  setVol: (n: number) => void;
  note?: string;
  compact?: boolean;
  levelUnavailable?: boolean;
  status?: string;
  hideMuteButton?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", !present && "opacity-40")}>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("font-medium truncate flex items-center gap-1", compact ? "text-[10px]" : "text-[11px]")}>
          {label}
          {present && status && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {!compact && status}
            </span>
          )}
        </span>
        {!hideMuteButton && (
          <button
            type="button"
            onClick={onMute}
            disabled={!present}
            className={cn(
              "inline-flex items-center gap-1 rounded border",
              compact ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5",
              mute
                ? "bg-muted text-muted-foreground border-border"
                : "bg-background border-border hover:bg-muted/40",
            )}
          >
            {mute ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
            {!compact && (mute ? "已静音" : "静音")}
          </button>
        )}
      </div>
      {levelUnavailable ? (
        <div className={cn(
          "rounded border border-dashed border-border/60 bg-muted/30 text-center text-muted-foreground",
          compact ? "text-[9px] py-1" : "text-[10px] py-1.5",
        )}>
          电平无法检测（浏览器限制）
        </div>
      ) : (
        <div className="space-y-0.5">
          <Meter ch={chs[0]} mute={mute || !present} compact={compact} />
          <Meter ch={chs[1]} mute={mute || !present} compact={compact} />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {!compact && <span className="text-[10px] text-muted-foreground w-8">音量</span>}
        <Slider
          value={[vol]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => setVol(v[0])}
          disabled={!present}
          className="flex-1"
        />
        <span className={cn("tabular-nums text-muted-foreground text-right", compact ? "text-[9px] w-6" : "text-[10px] w-8")}>{vol}%</span>
      </div>
      {note && !compact && <p className="text-[10px] text-muted-foreground leading-snug">{note}</p>}
    </div>
  );
}
