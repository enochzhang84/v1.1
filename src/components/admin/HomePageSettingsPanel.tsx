import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useWin98Dialog } from "./Win98Dialog";
import {
  Win98Button,
  Win98Input,
  Win98Textarea,
  Win98Label,
  Win98GroupBox,
} from "./win98";
import logoDefault from "@/assets/logo.png";
import { getPublicOrigin } from "@/lib/public-origin";

type Settings = {
  id: string;
  logo_url: string | null;
  logo_title: string | null;
  logo_subtitle: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_description: string | null;
  welcome_image_url: string | null;
  welcome_mode: string | null;
  welcome_content_html: string | null;
  qr_title: string | null;
  qr_description: string | null;
  qr_newcomer_url: string | null;
  qr_retreat_url: string | null;
  qr_image_url: string | null;
  // Extended editable fields
  site_title: string | null;
  site_subtitle: string | null;
  bible_verse: string | null;
  theme_text: string | null;
  church_name: string | null;
  church_address: string | null;
  church_address_en: string | null;
  church_phone: string | null;
  church_email: string | null;
  church_website: string | null;
  worship_schedule: string | null;
  primary_button_text: string | null;
  primary_button_url: string | null;
  secondary_button_text: string | null;
  secondary_button_url: string | null;
  background_image_url: string | null;
  footer_text: string | null;
};

const BUCKET = "site-assets";

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/* ─── Card wrapper with a colored header strip ────────────────────────── */
function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#c0c0c0",
        borderStyle: "solid",
        borderWidth: 2,
        borderColor: "#ffffff #808080 #808080 #ffffff",
      }}
      className="mb-3"
    >
      <div
        className="px-2 py-1 flex items-center justify-between"
        style={{ background: "#000080", color: "#fff" }}
      >
        <span className="text-[12px] font-bold">{title}</span>
        {hint && <span className="text-[11px] opacity-80">{hint}</span>}
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 h-7 text-[12px] text-black"
      style={
        active
          ? {
              background: "#c0c0c0",
              borderStyle: "solid",
              borderWidth: 2,
              borderColor: "#808080 #ffffff #ffffff #808080",
              boxShadow: "inset 1px 1px 0 #000, inset -1px -1px 0 #dfdfdf",
            }
          : {
              background: "#c0c0c0",
              borderStyle: "solid",
              borderWidth: 2,
              borderColor: "#ffffff #808080 #808080 #ffffff",
              boxShadow: "inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #000",
            }
      }
    >
      {children}
    </button>
  );
}

export function HomePageSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const { alert, confirm, dialog } = useWin98Dialog();

  const origin = useMemo(() => getPublicOrigin(), []);
  const [qrType, setQrType] = useState<"newcomer" | "retreat" | "chat" | "custom">(
    "newcomer",
  );
  const [qrCustom, setQrCustom] = useState("");
  const qrSvgRef = useRef<HTMLDivElement>(null);

  const qrValue =
    qrType === "newcomer"
      ? s?.qr_newcomer_url?.trim() || `${origin}/register`
      : qrType === "retreat"
      ? s?.qr_retreat_url?.trim() || `${origin}/retreat-register`
      : qrType === "chat"
      ? `${origin}/chat`
      : qrCustom || `${origin}/`;

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("home_page_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        alert("加载失败", error.message, "error");
        setLoading(false);
        return;
      }
      if (data) {
        setS(data);
      } else {
        const { data: created, error: insErr } = await (supabase as any)
          .from("home_page_settings")
          .insert({ welcome_mode: "text" })
          .select("*")
          .maybeSingle();
        if (insErr) alert("初始化失败", insErr.message, "error");
        else setS(created);
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Settings>) =>
    setS((cur) => (cur ? { ...cur, ...patch } : cur));

  async function uploadFile(file: File, fileName: string): Promise<string | null> {
    const path = `home/${fileName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      alert("上传失败", error.message, "error");
      return null;
    }
    return publicUrl(path);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("home_page_settings")
      .update({
        logo_url: s.logo_url,
        logo_title: s.logo_title,
        logo_subtitle: s.logo_subtitle,
        welcome_title: s.welcome_title,
        welcome_subtitle: s.welcome_subtitle,
        welcome_description: s.welcome_description,
        welcome_image_url: s.welcome_image_url,
        welcome_mode: s.welcome_mode || "text",
        welcome_content_html: s.welcome_content_html,
        qr_title: s.qr_title,
        qr_description: s.qr_description,
        qr_newcomer_url: s.qr_newcomer_url,
        qr_retreat_url: s.qr_retreat_url,
        qr_image_url: s.qr_image_url,
        site_title: s.site_title,
        site_subtitle: s.site_subtitle,
        bible_verse: s.bible_verse,
        theme_text: s.theme_text,
        church_name: s.church_name,
        church_address: s.church_address,
        church_address_en: s.church_address_en,
        church_phone: s.church_phone,
        church_email: s.church_email,
        church_website: s.church_website,
        worship_schedule: s.worship_schedule,
        primary_button_text: s.primary_button_text,
        primary_button_url: s.primary_button_url,
        secondary_button_text: s.secondary_button_text,
        secondary_button_url: s.secondary_button_url,
        background_image_url: s.background_image_url,
        footer_text: s.footer_text,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) alert("保存失败", error.message, "error");
    else alert("系统提示", "主页设置已保存。", "success");
  }

  /* ─── QR helpers ────────────────────────────────────────────────────── */
  function getQrSvgString(): string | null {
    const svg = qrSvgRef.current?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  async function qrSvgToPngBlob(size = 512): Promise<Blob | null> {
    const svgStr = getQrSvgString();
    if (!svgStr) return null;
    return new Promise((resolve) => {
      const img = new Image();
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function downloadPng() {
    const blob = await qrSvgToPngBlob(640);
    if (!blob) return alert("下载失败", "无法生成二维码图片。", "error");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${qrType}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qrValue);
      alert("系统提示", `已复制:\n${qrValue}`, "success");
    } catch {
      alert("复制失败", "请手动复制。", "error");
    }
  }

  function printQr() {
    const svgStr = getQrSvgString();
    if (!svgStr) return;
    const w = window.open("", "_blank", "width=480,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>打印二维码</title></head>
      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div>${svgStr}</div>
        <p style="margin-top:16px;font-size:14px;color:#333;">${qrValue}</p>
        <script>window.onload=()=>{setTimeout(()=>window.print(),200);}</script>
      </body></html>`);
    w.document.close();
  }

  /** Replace the home page QR with the currently-generated QR (clears uploaded image, sets link). */
  async function applyGeneratedToHome() {
    if (!s) return;
    confirm(
      "替换主页二维码",
      `确认将主页二维码替换为当前生成的二维码？\n\n链接：${qrValue}`,
      async () => {
        const { error } = await (supabase as any)
          .from("home_page_settings")
          .update({ qr_newcomer_url: qrValue, qr_image_url: null })
          .eq("id", s.id);
        if (error) return alert("替换失败", error.message, "error");
        update({ qr_newcomer_url: qrValue, qr_image_url: null });
        alert("替换成功", "主页二维码已更新（实时生成）。", "success");
      },
    );
  }

  /** Upload an existing QR image and use it as the home QR (sets qr_image_url). */
  async function handleUploadQrImage(file: File) {
    const url = await uploadFile(
      file,
      `qr-home.${file.name.split(".").pop() || "png"}`,
    );
    if (!url) return;
    update({ qr_image_url: url });
  }

  async function applyUploadedToHome() {
    if (!s?.qr_image_url) {
      alert("请先上传", "请先上传一张二维码图片。", "warn");
      return;
    }
    confirm(
      "替换主页二维码",
      "确认将主页二维码替换为上传的图片？\n\n（请确保该图片对应的链接正确，否则扫码会跳转错误页面。）",
      async () => {
        const { error } = await (supabase as any)
          .from("home_page_settings")
          .update({ qr_image_url: s.qr_image_url })
          .eq("id", s.id);
        if (error) return alert("替换失败", error.message, "error");
        alert("替换成功", "主页二维码已更新（使用上传图片）。", "success");
      },
    );
  }

  if (loading) return <div className="text-[12px] text-black p-2">加载中…</div>;
  if (!s) return <div className="text-[12px] text-black p-2">未找到主页设置记录</div>;

  /* ─── Live Preview ──────────────────────────────────────────────────── */
  const previewQrLink = s.qr_newcomer_url?.trim() || `${origin}/register`;
  const previewQrImage = s.qr_image_url?.trim() || null;

  return (
    <div
      className="text-black text-[12px] font-[Tahoma,'MS_Sans_Serif',sans-serif]"
      style={{ background: "#c0c0c0" }}
    >
      {dialog}

      <div className="grid lg:grid-cols-[1fr_360px] gap-3 p-2">
        {/* ───── LEFT: form ───── */}
        <div>
          {/* 1. 首页文字设置 */}
          <Card title="① 首页文字设置 (Logo & 标题)">
            <div className="flex items-center gap-3">
              <img
                src={s.logo_url || logoDefault}
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = logoDefault)
                }
                alt="Logo 预览"
                className="h-16 w-16 object-contain bg-white"
                style={{
                  borderStyle: "solid",
                  borderWidth: 2,
                  borderColor: "#808080 #ffffff #ffffff #808080",
                }}
              />
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadFile(
                        f,
                        `logo.${f.name.split(".").pop() || "png"}`,
                      );
                      if (url) update({ logo_url: url });
                    }}
                  />
                  <Win98Button asChild>上传 Logo</Win98Button>
                </label>
                <Win98Button onClick={() => update({ logo_url: null })}>
                  恢复默认
                </Win98Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Win98Label>Logo 主标题</Win98Label>
                <Win98Input
                  value={s.logo_title ?? ""}
                  onChange={(e) => update({ logo_title: e.target.value })}
                  placeholder="例如：基督三家事工中心"
                />
              </div>
              <div>
                <Win98Label>Logo 副标题</Win98Label>
                <Win98Input
                  value={s.logo_subtitle ?? ""}
                  onChange={(e) => update({ logo_subtitle: e.target.value })}
                  placeholder="例如：HOC3 Ministry Center"
                />
              </div>
            </div>
          </Card>

          {/* 2. 欢迎语 / 经文设置 */}
          <Card title="② 欢迎语 / 经文设置">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Win98Label>欢迎标题</Win98Label>
                <Win98Input
                  value={s.welcome_title ?? ""}
                  onChange={(e) => update({ welcome_title: e.target.value })}
                  placeholder="基督之家"
                />
              </div>
              <div>
                <Win98Label>欢迎副标题</Win98Label>
                <Win98Input
                  value={s.welcome_subtitle ?? ""}
                  onChange={(e) => update({ welcome_subtitle: e.target.value })}
                  placeholder="第三家"
                />
              </div>
            </div>
            <div>
              <Win98Label>欢迎说明 / 经文</Win98Label>
              <Win98Textarea
                value={s.welcome_description ?? ""}
                onChange={(e) => update({ welcome_description: e.target.value })}
                placeholder="自由介绍文字 / 经文…"
                rows={4}
              />
            </div>
            <div>
              <Win98Label>自定义 HTML 内容（HTML 模式下生效）</Win98Label>
              <Win98Textarea
                value={s.welcome_content_html ?? ""}
                onChange={(e) => update({ welcome_content_html: e.target.value })}
                placeholder="<div>支持任意 HTML</div>"
                rows={4}
                className="font-mono"
              />
            </div>
          </Card>

          {/* 3. 背景与显示样式 */}
          <Card title="③ 背景与显示样式">
            <div>
              <Win98Label>显示模式</Win98Label>
              <div className="flex gap-1">
                {(["text", "image", "html"] as const).map((m) => (
                  <Tab
                    key={m}
                    active={(s.welcome_mode || "text") === m}
                    onClick={() => update({ welcome_mode: m })}
                  >
                    {m === "text" ? "文字模式" : m === "image" ? "图片模式" : "HTML 模式"}
                  </Tab>
                ))}
              </div>
            </div>
            <div>
              <Win98Label>左侧背景图</Win98Label>
              <div className="flex items-center gap-3">
                {s.welcome_image_url ? (
                  <img
                    src={s.welcome_image_url}
                    alt="背景图预览"
                    className="h-24 w-40 object-cover bg-white"
                    style={{
                      borderStyle: "solid",
                      borderWidth: 2,
                      borderColor: "#808080 #ffffff #ffffff #808080",
                    }}
                  />
                ) : (
                  <div
                    className="h-24 w-40 grid place-items-center text-[11px] bg-white"
                    style={{
                      borderStyle: "solid",
                      borderWidth: 2,
                      borderColor: "#808080 #ffffff #ffffff #808080",
                    }}
                  >
                    未设置
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadFile(
                          f,
                          `welcome.${f.name.split(".").pop() || "jpg"}`,
                        );
                        if (url) update({ welcome_image_url: url });
                      }}
                    />
                    <Win98Button asChild>上传背景图</Win98Button>
                  </label>
                  <Win98Button onClick={() => update({ welcome_image_url: null })}>
                    清除背景图
                  </Win98Button>
                </div>
              </div>
            </div>
          </Card>

          {/* 4. 二维码管理 */}
          <Card
            title="④ 二维码管理"
            hint={`扫码站点：${origin}`}
          >
            {/* 4a. 生成器 */}
            <div className="space-y-2">
              <div className="text-[12px] font-bold">A · 生成二维码</div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { k: "newcomer", label: "新人登记" },
                    { k: "retreat", label: "退修会报名" },
                    { k: "chat", label: "幸福聊天室" },
                    { k: "custom", label: "自定义链接" },
                  ] as const
                ).map((t) => (
                  <Tab key={t.k} active={qrType === t.k} onClick={() => setQrType(t.k)}>
                    {t.label}
                  </Tab>
                ))}
              </div>
              {qrType === "custom" && (
                <Win98Input
                  value={qrCustom}
                  onChange={(e) => setQrCustom(e.target.value)}
                  placeholder="https://..."
                />
              )}
              {qrType === "newcomer" && (
                <div>
                  <Win98Label>新人登记链接 (qr_newcomer_url)</Win98Label>
                  <Win98Input
                    value={s.qr_newcomer_url ?? ""}
                    onChange={(e) => update({ qr_newcomer_url: e.target.value })}
                    placeholder={`${origin}/register`}
                  />
                </div>
              )}
              {qrType === "retreat" && (
                <div>
                  <Win98Label>退修会报名链接 (qr_retreat_url)</Win98Label>
                  <Win98Input
                    value={s.qr_retreat_url ?? ""}
                    onChange={(e) => update({ qr_retreat_url: e.target.value })}
                    placeholder={`${origin}/retreat-register`}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 items-start pt-1">
                <div
                  ref={qrSvgRef}
                  className="bg-white p-3"
                  style={{
                    borderStyle: "solid",
                    borderWidth: 2,
                    borderColor: "#808080 #ffffff #ffffff #808080",
                  }}
                >
                  <QRCodeSVG value={qrValue} size={180} level="H" />
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <div
                    className="text-[11px] break-all px-2 py-1 bg-white"
                    style={{
                      borderStyle: "solid",
                      borderWidth: 2,
                      borderColor: "#808080 #ffffff #ffffff #808080",
                    }}
                  >
                    {qrValue}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Win98Button onClick={copyLink}>复制链接</Win98Button>
                    <Win98Button onClick={downloadPng}>下载 PNG</Win98Button>
                    <Win98Button onClick={printQr}>打印</Win98Button>
                  </div>
                  <Win98Button onClick={applyGeneratedToHome}>
                    🏠 替换为主页二维码
                  </Win98Button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #808080" }} className="pt-3 space-y-2">
              <div className="text-[12px] font-bold">B · 上传二维码图片</div>
              <div className="flex items-center gap-3">
                {s.qr_image_url ? (
                  <img
                    src={s.qr_image_url}
                    alt="已上传二维码"
                    className="h-24 w-24 object-contain bg-white"
                    style={{
                      borderStyle: "solid",
                      borderWidth: 2,
                      borderColor: "#808080 #ffffff #ffffff #808080",
                    }}
                  />
                ) : (
                  <div
                    className="h-24 w-24 grid place-items-center text-[11px] bg-white"
                    style={{
                      borderStyle: "solid",
                      borderWidth: 2,
                      borderColor: "#808080 #ffffff #ffffff #808080",
                    }}
                  >
                    未上传
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        await handleUploadQrImage(f);
                      }}
                    />
                    <Win98Button asChild>上传二维码 (PNG/JPG)</Win98Button>
                  </label>
                  <Win98Button onClick={applyUploadedToHome}>
                    🏠 替换为主页二维码
                  </Win98Button>
                  <Win98Button onClick={() => update({ qr_image_url: null })}>
                    清除上传
                  </Win98Button>
                </div>
              </div>
              <div className="text-[11px] opacity-80">
                上传图片后，主页将直接显示该图片；清除后回到根据「登记链接」实时生成的二维码。
              </div>
            </div>

            <div style={{ borderTop: "1px solid #808080" }} className="pt-3 grid sm:grid-cols-2 gap-3">
              <div>
                <Win98Label>二维码标题</Win98Label>
                <Win98Input
                  value={s.qr_title ?? ""}
                  onChange={(e) => update({ qr_title: e.target.value })}
                  placeholder="例如：新人登记"
                />
              </div>
              <div>
                <Win98Label>二维码说明</Win98Label>
                <Win98Input
                  value={s.qr_description ?? ""}
                  onChange={(e) => update({ qr_description: e.target.value })}
                  placeholder="例如：扫码填写新人资料"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ───── RIGHT: live preview ───── */}
        <div className="lg:sticky lg:top-2 self-start">
          <Card title="⑤ 实时预览（主页效果）">
            <div
              className="bg-white p-3"
              style={{
                borderStyle: "solid",
                borderWidth: 2,
                borderColor: "#808080 #ffffff #ffffff #808080",
              }}
            >
              {/* mini header */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-2">
                <img
                  src={s.logo_url || logoDefault}
                  onError={(e) =>
                    ((e.currentTarget as HTMLImageElement).src = logoDefault)
                  }
                  alt=""
                  className="h-6 w-6 object-contain"
                />
                <span className="font-serif text-[13px] text-black">
                  {s.logo_title || "基督之家第三家"}
                </span>
              </div>
              {/* welcome */}
              <div
                className="rounded p-2 mb-3"
                style={
                  s.welcome_image_url
                    ? {
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.85),rgba(255,255,255,0.85)),url(${s.welcome_image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : { background: "#fafafa" }
                }
              >
                <div className="text-[15px] font-bold text-black leading-tight">
                  {s.welcome_title || "基督之家"}
                </div>
                <div className="text-[12px] text-black/80 mb-1">
                  {s.welcome_subtitle || "第三家"}
                </div>
                {(s.welcome_mode || "text") === "html" && s.welcome_content_html ? (
                  <div
                    className="text-[11px] text-black/80"
                    dangerouslySetInnerHTML={{ __html: s.welcome_content_html }}
                  />
                ) : (
                  <div className="text-[11px] text-black/70 whitespace-pre-line">
                    {s.welcome_description || "这家就是永生神的教会，真理的柱石和根基。"}
                  </div>
                )}
              </div>
              {/* QR */}
              <div className="flex flex-col items-center">
                {previewQrImage ? (
                  <img
                    src={previewQrImage}
                    alt="主页二维码"
                    className="w-[150px] h-[150px] object-contain bg-white border"
                  />
                ) : (
                  <QRCodeSVG value={previewQrLink} size={150} level="H" />
                )}
                <div className="text-[11px] text-black mt-2">
                  {s.qr_title || "扫码登记"}
                </div>
                <div className="text-[10px] text-black/60 break-all px-1">
                  {previewQrImage ? "(使用上传的二维码图片)" : previewQrLink}
                </div>
              </div>
            </div>
            <div className="text-[11px] opacity-80">
              修改后实时显示；点击下方「保存」后主页 / 电视显示页会立刻读取。
            </div>
          </Card>
        </div>
      </div>

      {/* ───── Sticky save bar ───── */}
      <div
        className="sticky bottom-0 flex justify-end gap-2 px-3 py-2"
        style={{
          background: "#c0c0c0",
          borderTop: "2px solid #ffffff",
          boxShadow: "inset 0 1px 0 #dfdfdf, 0 -1px 0 #808080",
        }}
      >
        <Win98Button
          onClick={() => window.open(origin, "_blank")}
        >
          在新窗口打开主页
        </Win98Button>
        <Win98Button onClick={save} disabled={saving}>
          {saving ? "保存中…" : "💾 保存全部设置"}
        </Win98Button>
      </div>
    </div>
  );
}
