import { useEffect, useRef, useState } from "react";
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
  qr_image_url: string | null;
  qr_newcomer_url: string | null;
  qr_retreat_url: string | null;
};

const BUCKET = "site-assets";

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Tab-style toggle in Win98 look */
function Win98Tab({
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

  // 二维码必须指向 *发布* 站点，否则扫码会落到预览域名。
  const PUBLISHED_ORIGIN = "https://hoc3newcomer.lovable.app";
  const origin = PUBLISHED_ORIGIN;
  const [qrType, setQrType] = useState<"newcomer" | "retreat" | "custom">("newcomer");
  const [qrCustom, setQrCustom] = useState("");
  const qrSvgRef = useRef<HTMLDivElement>(null);

  const qrValue =
    qrType === "newcomer"
      ? `${origin}/register`
      : qrType === "retreat"
      ? `${origin}/retreat-register`
      : qrCustom || `${origin}/`;

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("home_page_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) alert("加载失败", error.message, "error");
      setS(data ?? null);
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
        qr_image_url: s.qr_image_url,
        qr_newcomer_url: s.qr_newcomer_url,
        qr_retreat_url: s.qr_retreat_url,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) alert("保存失败", error.message, "error");
    else alert("系统提示", "全部设置已保存。", "success");
  }

  // ---- QR helpers ----
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
      alert("系统提示", qrValue, "success");
    } catch {
      alert("复制失败", "浏览器不支持自动复制，请手动复制。", "error");
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

  async function uploadQrAsPng(name: string): Promise<string | null> {
    const blob = await qrSvgToPngBlob(640);
    if (!blob) return null;
    const file = new File([blob], `${name}.png`, { type: "image/png" });
    return uploadFile(file, `${name}.png`);
  }

  async function saveQr() {
    const url = await uploadQrAsPng(`qr-${qrType}`);
    if (!url) return alert("保存失败", "二维码上传失败。", "error");
    if (qrType === "newcomer") update({ qr_newcomer_url: url });
    else if (qrType === "retreat") update({ qr_retreat_url: url });
    alert(
      "系统提示",
      "二维码图片已上传，记得点击底部「保存全部设置」持久化。",
      "success",
    );
  }

  function replaceSiteQr(scope: "newcomer" | "retreat" | "all") {
    confirm(
      "系统提示",
      `将使用当前生成的二维码替换：${
        scope === "all" ? "全部二维码" : scope === "newcomer" ? "新人登记二维码" : "退修会二维码"
      }。是否继续？`,
      async () => {
        const url = await uploadQrAsPng(`qr-${scope === "all" ? qrType : scope}`);
        if (!url) return alert("替换失败", "二维码上传失败。", "error");
        const patch: Partial<Settings> = {};
        if (scope === "newcomer" || scope === "all") patch.qr_newcomer_url = url;
        if (scope === "retreat" || scope === "all") patch.qr_retreat_url = url;
        if (scope === "all") patch.qr_image_url = url;
        update(patch);
        alert("系统提示", "替换成功，请点击底部「保存全部设置」持久化。", "success");
      },
      "warn",
    );
  }

  if (loading) {
    return <div className="text-[12px] text-black">加载中…</div>;
  }
  if (!s) {
    return <div className="text-[12px] text-black">未找到主页设置记录</div>;
  }

  return (
    <div className="text-black text-[12px] font-[Tahoma,'MS_Sans_Serif',sans-serif]">
      {dialog}

      {/* Logo 设置 */}
      <Win98GroupBox title="Logo 设置">
        <div className="flex items-center gap-3">
          <img
            src={s.logo_url || logoDefault}
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = logoDefault)}
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
                  const url = await uploadFile(f, `logo.${f.name.split(".").pop() || "png"}`);
                  if (url) update({ logo_url: url });
                }}
              />
              <Win98Button asChild>上传 Logo</Win98Button>
            </label>
            <Win98Button onClick={() => update({ logo_url: null })}>恢复默认 Logo</Win98Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
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
        <div className="text-[11px] pt-1">用于扫码页 / 后台左上角文字显示。</div>
      </Win98GroupBox>

      {/* 欢迎区 */}
      <Win98GroupBox title="左侧欢迎区设置">
        <div>
          <Win98Label>显示模式</Win98Label>
          <div className="flex gap-1">
            {(["text", "image", "html"] as const).map((m) => (
              <Win98Tab
                key={m}
                active={(s.welcome_mode || "text") === m}
                onClick={() => update({ welcome_mode: m })}
              >
                {m === "text" ? "文字模式" : m === "image" ? "图片模式" : "HTML 模式"}
              </Win98Tab>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Win98Label>欢迎标题</Win98Label>
            <Win98Input
              value={s.welcome_title ?? ""}
              onChange={(e) => update({ welcome_title: e.target.value })}
              placeholder="例如：基督三家欢迎你"
            />
          </div>
          <div>
            <Win98Label>欢迎副标题</Win98Label>
            <Win98Input
              value={s.welcome_subtitle ?? ""}
              onChange={(e) => update({ welcome_subtitle: e.target.value })}
              placeholder="例如：The Home of Christ Church"
            />
          </div>
        </div>
        <div>
          <Win98Label>欢迎说明文字</Win98Label>
          <Win98Textarea
            value={s.welcome_description ?? ""}
            onChange={(e) => update({ welcome_description: e.target.value })}
            placeholder="自由介绍文字…"
            rows={3}
          />
        </div>
        <div>
          <Win98Label>自定义 HTML 内容</Win98Label>
          <Win98Textarea
            value={s.welcome_content_html ?? ""}
            onChange={(e) => update({ welcome_content_html: e.target.value })}
            placeholder="<div>支持任意 HTML，仅在「HTML 模式」下渲染</div>"
            rows={5}
            className="font-mono"
          />
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
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.3")}
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
                    const url = await uploadFile(f, `welcome.${f.name.split(".").pop() || "jpg"}`);
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
      </Win98GroupBox>

      {/* QR Generator */}
      <Win98GroupBox title="二维码生成器">
        <div className="text-[11px]">
          自动使用当前站点地址 <code className="px-1 bg-white border border-[#808080]">{origin}</code> 生成二维码。
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              { k: "newcomer", label: "新人扫码登记" },
              { k: "retreat", label: "退修会报名" },
              { k: "custom", label: "自定义链接" },
            ] as const
          ).map((t) => (
            <Win98Tab key={t.k} active={qrType === t.k} onClick={() => setQrType(t.k)}>
              {t.label}
            </Win98Tab>
          ))}
        </div>
        {qrType === "custom" && (
          <Win98Input
            value={qrCustom}
            onChange={(e) => setQrCustom(e.target.value)}
            placeholder="https://..."
          />
        )}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div
            ref={qrSvgRef}
            className="bg-white p-3"
            style={{
              borderStyle: "solid",
              borderWidth: 2,
              borderColor: "#808080 #ffffff #ffffff #808080",
            }}
          >
            <QRCodeSVG value={qrValue} size={200} level="H" />
          </div>
          <div className="flex-1 space-y-2">
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
              <Win98Button onClick={printQr}>打印二维码</Win98Button>
              <Win98Button onClick={saveQr}>保存二维码</Win98Button>
            </div>
            <div className="pt-2 mt-2" style={{ borderTop: "1px solid #808080" }}>
              <div className="text-[11px] font-bold mb-1">一键替换网站内二维码</div>
              <div className="flex flex-wrap gap-2">
                <Win98Button onClick={() => replaceSiteQr("newcomer")}>
                  替换新人登记二维码
                </Win98Button>
                <Win98Button onClick={() => replaceSiteQr("retreat")}>
                  替换退修会二维码
                </Win98Button>
                <Win98Button onClick={() => replaceSiteQr("all")}>替换全部二维码</Win98Button>
              </div>
            </div>
            {(s.qr_newcomer_url || s.qr_retreat_url) && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {s.qr_newcomer_url && (
                  <div className="text-center">
                    <img
                      src={s.qr_newcomer_url}
                      alt="新人二维码"
                      className="h-24 w-24 mx-auto object-contain bg-white"
                      style={{
                        borderStyle: "solid",
                        borderWidth: 2,
                        borderColor: "#808080 #ffffff #ffffff #808080",
                      }}
                    />
                    <div className="text-[10px] mt-1">当前新人二维码</div>
                  </div>
                )}
                {s.qr_retreat_url && (
                  <div className="text-center">
                    <img
                      src={s.qr_retreat_url}
                      alt="退修会二维码"
                      className="h-24 w-24 mx-auto object-contain bg-white"
                      style={{
                        borderStyle: "solid",
                        borderWidth: 2,
                        borderColor: "#808080 #ffffff #ffffff #808080",
                      }}
                    />
                    <div className="text-[10px] mt-1">当前退修会二维码</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Win98GroupBox>

      {/* Right-side QR */}
      <Win98GroupBox title="右侧二维码区设置">
        <div className="text-[11px]">
          二维码图片仅用于展示。实际登记链接仍由活动二维码自动生成，不受这里影响。
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
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
        <div className="flex items-center gap-3">
          {s.qr_image_url ? (
            <img
              src={s.qr_image_url}
              alt="二维码预览"
              className="h-28 w-28 object-contain bg-white"
              style={{
                borderStyle: "solid",
                borderWidth: 2,
                borderColor: "#808080 #ffffff #ffffff #808080",
              }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.3")}
            />
          ) : (
            <div
              className="h-28 w-28 grid place-items-center text-[11px] bg-white"
              style={{
                borderStyle: "solid",
                borderWidth: 2,
                borderColor: "#808080 #ffffff #ffffff #808080",
              }}
            >
              使用动态二维码
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
                  const url = await uploadFile(f, `qrcode.${f.name.split(".").pop() || "png"}`);
                  if (url) update({ qr_image_url: url });
                }}
              />
              <Win98Button asChild>上传二维码</Win98Button>
            </label>
            <Win98Button onClick={() => update({ qr_image_url: null })}>
              恢复默认二维码
            </Win98Button>
          </div>
        </div>
      </Win98GroupBox>

      <div
        className="flex justify-end gap-2 sticky bottom-0 pt-2 mt-2"
        style={{ background: "#c0c0c0", borderTop: "1px solid #ffffff" }}
      >
        <Win98Button onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存全部设置"}
        </Win98Button>
      </div>
    </div>
  );
}