import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import logo from "@/assets/logo.png";
import iconAdmin from "@/assets/icon-admin.png";
import iconFullscreen from "@/assets/icon-fullscreen.png";
import iconExitFullscreen from "@/assets/icon-exit-fullscreen.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [event, setEvent] = useState<{ name: string; qr_token: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIPad, setIsIPad] = useState(false);
  const [verse, setVerse] = useState<{ text: string; ref: string } | null>(null);
  const [home, setHome] = useState<{
    logo_url: string | null;
    welcome_title: string | null;
    welcome_subtitle: string | null;
    welcome_description: string | null;
    welcome_image_url: string | null;
    qr_title: string | null;
    qr_description: string | null;
    qr_newcomer_url?: string | null;
  } | null>(null);

  const VERSES = [
    { text: "凡劳苦担重担的人，可以到我这里来，我就使你们得安息。", ref: "马太福音 11:28" },
    { text: "耶和华是我的牧者，我必不致缺乏。", ref: "诗篇 23:1" },
    { text: "你们要尝尝主恩的滋味，便知道他是美善。", ref: "诗篇 34:8" },
    { text: "我留下平安给你们，我将我的平安赐给你们。", ref: "约翰福音 14:27" },
    { text: "应当一无挂虑，只要凡事藉着祷告、祈求和感谢，将你们所要的告诉神。", ref: "腓立比书 4:6" },
    { text: "神所赐出人意外的平安，必在基督耶稣里保守你们的心怀意念。", ref: "腓立比书 4:7" },
    { text: "你们祈求，就给你们；寻找，就寻见；叩门，就给你们开门。", ref: "马太福音 7:7" },
    { text: "神爱世人，甚至将他的独生子赐给他们。", ref: "约翰福音 3:16" },
  ];

  useEffect(() => {
    const ua = navigator.userAgent;
    const iPad =
      /iPad/.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
    setIsIPad(iPad);
  }, []);

  useEffect(() => {
    supabase
      .from("events")
      .select("name, qr_token")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setEvent(data));
  }, []);

  // Load dynamic home page settings (falls back to defaults if absent / errors)
  useEffect(() => {
    (supabase as any)
      .from("home_page_settings")
      .select("logo_url, welcome_title, welcome_subtitle, welcome_description, welcome_image_url, qr_title, qr_description, qr_newcomer_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: any }) => { if (data) setHome(data); });
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = async () => {
    try {
      // Pick a fresh verse for the top banner each time
      setVerse(VERSES[Math.floor(Math.random() * VERSES.length)]);
      // On iPad Safari, requestFullscreen shows a persistent X button overlay.
      // Skip the native API on iPad and rely on the sticky verse banner +
      // scroll trick to cover the address bar.
      if (!isIPad) {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      // Allow layout to grow before scrolling so Safari actually hides the URL bar
      requestAnimationFrame(() => {
        setTimeout(() => window.scrollTo(0, 1), 50);
      });
    } catch (e) {
      setIsFullscreen(true);
      requestAnimationFrame(() => {
        setTimeout(() => window.scrollTo(0, 1), 50);
      });
    }
  };

  const exitFullscreen = async () => {
    try {
      const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
      setIsFullscreen(false);
    } catch {
      setIsFullscreen(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const registerUrl =
    home?.qr_newcomer_url && /^https?:\/\//.test(home.qr_newcomer_url)
      ? home.qr_newcomer_url
      : `${origin}/register${event ? `?event=${event.qr_token}` : ""}`;

  return (
    <div className={`min-h-screen bg-background ${isFullscreen ? "min-h-[120vh]" : ""}`}>
      {isFullscreen && (
        <div className="fixed top-0 inset-x-0 z-50 bg-background border-b border-border/60 overflow-hidden">
          <div className="py-[14px] whitespace-nowrap animate-verse-marquee flex gap-16">
            {[...VERSES, ...VERSES].map((v, i) => (
              <span key={i} className="text-sm md:text-base font-serif text-foreground/90 inline-flex items-center">
                「{v.text}」
                <span className="ml-2 opacity-70 text-xs md:text-sm">— {v.ref}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <a href="/admin" className="flex items-center gap-2">
            <img
              src={home?.logo_url || logo}
              onError={(e) => ((e.currentTarget as HTMLImageElement).src = logo)}
              alt="基督之家第三家"
              className="h-10 w-10 object-contain"
            />
            <span className="font-serif text-xl tracking-wide text-foreground">基督之家第三家</span>
          </a>
          {!isFullscreen ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.assign("/login")}
                title="进入后台"
                className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                <img src={iconAdmin} alt="后台" className="h-5 w-5 object-contain" />
              </button>
              {isIPad && (
                <button
                  onClick={enterFullscreen}
                  title="全屏"
                  className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <img src={iconFullscreen} alt="全屏" className="h-5 w-5 object-contain" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={exitFullscreen}
              title="退出全屏"
              className="h-10 w-10 rounded-xl border border-border/60 bg-card hover:bg-accent flex items-center justify-center transition-colors opacity-40 hover:opacity-100"
            >
              <img src={iconExitFullscreen} alt="退出全屏" className="h-5 w-5 object-contain" />
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 items-center max-w-5xl mx-auto">
          <div className="flex justify-end">
            <div
              className="w-full max-w-sm font-kaiti font-bold text-foreground relative rounded-xl"
              style={
                home?.welcome_image_url
                  ? {
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url(${home.welcome_image_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      padding: "1.25rem",
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={home?.logo_url || logo}
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = logo)}
                  alt="基督之家第三家"
                  className="h-14 w-14 object-contain"
                />
                <div className="leading-tight">
                  <div className="text-3xl font-bold tracking-wide">
                    {home?.welcome_title || "基督之家"}
                  </div>
                  <div className="text-xl tracking-widest">
                    {home?.welcome_subtitle || "第三家"}
                  </div>
                </div>
              </div>
              {home?.welcome_description ? (
                <div className="text-sm text-foreground/80 mb-5 leading-relaxed whitespace-pre-line">
                  {home.welcome_description}
                </div>
              ) : (
                <div className="text-sm text-foreground/80 mb-5 leading-relaxed">
                  <div>这家就是永生神的教会</div>
                  <div>真理的柱石和根基 (提前 3:15)</div>
                </div>
              )}

              <div className="text-sm mb-4">
                <span className="font-bold">今年主题</span>
                <span className="mx-2">:</span>
                <span>信靠顺服 活出基督</span>
              </div>

              <table className="text-sm border-separate [border-spacing:0_4px] mb-4">
                <tbody>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">成人主日学</td><td className="pr-2">:</td><td className="pr-3">中文</td><td>9:30 am</td></tr>
                  <tr><td></td><td className="pr-2">:</td><td className="pr-3">英文</td><td>9:30 am</td></tr>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">主日敬拜</td><td className="pr-2">:</td><td className="pr-3">中文</td><td>11:00 am</td></tr>
                  <tr><td></td><td className="pr-2">:</td><td className="pr-3">英文</td><td>11:00 am</td></tr>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">儿童主日学</td><td className="pr-2">:</td><td className="pr-3"></td><td>11:00 am</td></tr>
                </tbody>
              </table>

              <table className="text-sm border-separate [border-spacing:0_4px] mb-4">
                <tbody>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">教会电话</td><td className="pr-2">:</td><td>510 651-9631 / 9937</td></tr>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">电邮</td><td className="pr-2">:</td><td>contact@hoc3.org</td></tr>
                  <tr><td className="font-bold pr-2 whitespace-nowrap">网址</td><td className="pr-2">:</td><td>hoc3.org</td></tr>
                </tbody>
              </table>

              <div className="text-sm mt-6 leading-relaxed w-fit">
                <div className="font-bold text-left">The Home of Christ Church</div>
                <div className="font-bold w-full text-center">In Fremont</div>
                <div className="w-full text-center">4248 Solar Way</div>
                <div className="w-full text-center">Fremont, CA 94538</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/40">
              <QRCodeSVG value={registerUrl} size={240} level="H" />
              <p className="text-center mt-4 text-sm text-muted-foreground">
                {home?.qr_description || `${home?.qr_title || "扫码登记"}${event ? ` · ${event.name}` : ""}`}
              </p>
            </div>
            <a href={registerUrl} className="mt-6">
              <Button
                size="lg"
                className="rounded-full px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg"
              >
                立即登记 / Register Now
              </Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
