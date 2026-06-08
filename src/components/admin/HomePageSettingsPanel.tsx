import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useWin98Dialog } from "./Win98Dialog";
import { getPublicOrigin } from "@/lib/public-origin";
import {
  Settings as SettingsIcon,
  Images,
  QrCode,
  HandHeart,
  Tent,
  Monitor,
  Palette,
  Save,
  ExternalLink,
  Copy,
  Download,
  Printer,
  Upload,
  RefreshCw,
  Check,
  LogOut,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ADMIN_LOGO_DEFAULTS,
  emitAdminLogoUpdated,
} from "@/hooks/useAdminLogo";

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
  home_qr_updated_at: string | null;
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

type SectionKey =
  | "basic"
  | "carousel"
  | "adminLogo"
  | "qr"
  | "welcome"
  | "retreat"
  | "display"
  | "theme";

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: any }[] = [
  { key: "basic", label: "基本设置", hint: "教会信息 · 联系方式", icon: SettingsIcon },
  { key: "carousel", label: "首页轮播", hint: "Logo · 背景图", icon: Images },
  { key: "adminLogo", label: "后台 Logo 编辑", hint: "后台左上角名称 · 版本号", icon: SettingsIcon },
  { key: "qr", label: "二维码管理", hint: "主页二维码", icon: QrCode },
  { key: "welcome", label: "迎宾页面", hint: "欢迎语 · 经文 · 主日时间", icon: HandHeart },
  { key: "retreat", label: "退修会页面", hint: "登记链接 · 二维码", icon: Tent },
  { key: "display", label: "显示屏内容", hint: "按钮 · 跳转链接", icon: Monitor },
  { key: "theme", label: "主题样式", hint: "主题文字 · 页面背景 · 底部", icon: Palette },
];

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/* ───── primitives ─────────────────────────────────────────────────────── */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.09)]">
      <header className="px-7 pt-6 pb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className="px-7 pb-7 pt-2 space-y-5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
export function HomePageSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const [section, setSection] = useState<SectionKey>("basic");
  const { alert, confirm, dialog } = useWin98Dialog();
  const navigate = useNavigate();

  const origin = useMemo(() => getPublicOrigin(), []);

  const [qrType, setQrType] = useState<"newcomer" | "retreat" | "chat" | "custom">(
    "newcomer",
  );
  const [qrCustom, setQrCustom] = useState("");
  const qrSvgRef = useRef<HTMLDivElement>(null);
  const retreatQrRef = useRef<HTMLDivElement>(null);

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
      if (data) setS(data);
      else {
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
    else {
      setSavedAt(new Date());
      alert("系统提示", "主页设置已保存。", "success");
    }
  }

  /* ─── QR helpers ────────────────────────────────────────────────────── */
  function getSvgString(container: HTMLDivElement | null): string | null {
    const svg = container?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  async function svgToPngBlob(svgStr: string, size = 512): Promise<Blob | null> {
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

  async function downloadPngFrom(
    container: HTMLDivElement | null,
    name: string,
  ) {
    const svgStr = getSvgString(container);
    if (!svgStr) return alert("下载失败", "无法生成二维码图片。", "error");
    const blob = await svgToPngBlob(svgStr, 640);
    if (!blob) return alert("下载失败", "无法生成二维码图片。", "error");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert("系统提示", `已复制:\n${value}`, "success");
    } catch {
      alert("复制失败", "请手动复制。", "error");
    }
  }

  function printQrFrom(container: HTMLDivElement | null, link: string) {
    const svgStr = getSvgString(container);
    if (!svgStr) return;
    const w = window.open("", "_blank", "width=480,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>打印二维码</title></head>
      <body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <div>${svgStr}</div>
        <p style="margin-top:16px;font-size:14px;color:#333;">${link}</p>
        <script>window.onload=()=>{setTimeout(()=>window.print(),200);}</script>
      </body></html>`);
    w.document.close();
  }

  async function persistQrChange(patch: Partial<Settings>) {
    if (!s) return false;
    const payload = { ...patch, home_qr_updated_at: new Date().toISOString() };
    const { error } = await (supabase as any)
      .from("home_page_settings")
      .update(payload)
      .eq("id", s.id);
    if (error) {
      alert("替换失败", error.message, "error");
      return false;
    }
    update(payload as Partial<Settings>);
    return true;
  }

  async function applyGeneratedToHome() {
    if (!s) return;
    confirm(
      "替换主页二维码",
      `确认将主页二维码替换为当前二维码吗？\n\n链接：${qrValue}`,
      async () => {
        const ok = await persistQrChange({
          qr_newcomer_url: qrValue,
          qr_image_url: null,
        });
        if (ok) alert("替换成功", "主页二维码已更新（实时生成）。", "success");
      },
    );
  }

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
        const ok = await persistQrChange({ qr_image_url: s.qr_image_url });
        if (ok) alert("替换成功", "主页二维码已更新（使用上传图片）。", "success");
      },
    );
  }

  async function restoreDefaultQr() {
    if (!s) return;
    confirm(
      "恢复默认二维码",
      `确认恢复默认二维码？\n\n将使用：${origin}/register`,
      async () => {
        const ok = await persistQrChange({
          qr_newcomer_url: `${origin}/register`,
          qr_image_url: null,
        });
        if (ok) alert("已恢复", "主页二维码已恢复为默认新人登记链接。", "success");
      },
    );
  }

  if (loading)
    return <div className="p-10 text-sm text-muted-foreground">加载中…</div>;
  if (!s)
    return (
      <div className="p-10 text-sm text-muted-foreground">未找到主页设置记录</div>
    );

  const previewQrLink = s.qr_newcomer_url?.trim() || `${origin}/register`;
  const previewQrImage = s.qr_image_url?.trim() || null;
  const qrUpdatedLabel = s.home_qr_updated_at
    ? new Date(s.home_qr_updated_at).toLocaleString()
    : "尚未替换";
  const retreatLink = s.qr_retreat_url?.trim() || `${origin}/retreat-register`;

  /* ─── Image uploader (compact, borderless) ──────────────────────────── */
  const ImageUploader = ({
    label,
    value,
    nameHint,
    onChange,
    aspect = "h-24 w-40",
  }: {
    label: string;
    value: string | null;
    nameHint: string;
    onChange: (url: string | null) => void;
    aspect?: string;
  }) => (
    <Field label={label}>
      <div className="flex items-center gap-4">
        <div
          className={`${aspect} rounded-xl overflow-hidden bg-muted/50 grid place-items-center`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">未设置</span>
          )}
        </div>
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
                  `${nameHint}.${f.name.split(".").pop() || "jpg"}`,
                );
                if (url) onChange(url);
              }}
            />
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <span>
                <Upload className="w-4 h-4 mr-1.5" /> 上传
              </span>
            </Button>
          </label>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => onChange(null)}
            >
              清除
            </Button>
          )}
        </div>
      </div>
    </Field>
  );

  /* ─── Sections ──────────────────────────────────────────────────────── */
  const SectionBasic = (
    <Card title="基本设置" description="网站标题、教会名称与联系方式">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="网站主标题">
          <Input
            value={s.site_title ?? ""}
            onChange={(e) => update({ site_title: e.target.value })}
            placeholder="基督之家第三家"
          />
        </Field>
        <Field label="网站副标题">
          <Input
            value={s.site_subtitle ?? ""}
            onChange={(e) => update({ site_subtitle: e.target.value })}
            placeholder="The Home of Christ Church"
          />
        </Field>
        <Field label="教会名称">
          <Input
            value={s.church_name ?? ""}
            onChange={(e) => update({ church_name: e.target.value })}
            placeholder="The Home of Christ Church In Fremont"
          />
        </Field>
        <Field label="教会网址">
          <Input
            value={s.church_website ?? ""}
            onChange={(e) => update({ church_website: e.target.value })}
            placeholder="hoc3.org"
          />
        </Field>
        <Field label="教会电话">
          <Input
            value={s.church_phone ?? ""}
            onChange={(e) => update({ church_phone: e.target.value })}
            placeholder="510 651-9631"
          />
        </Field>
        <Field label="教会邮箱">
          <Input
            value={s.church_email ?? ""}
            onChange={(e) => update({ church_email: e.target.value })}
            placeholder="contact@hoc3.org"
          />
        </Field>
        <Field label="地址（中文）">
          <Input
            value={s.church_address ?? ""}
            onChange={(e) => update({ church_address: e.target.value })}
          />
        </Field>
        <Field label="地址（英文）">
          <Input
            value={s.church_address_en ?? ""}
            onChange={(e) => update({ church_address_en: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  );

  const SectionCarousel = (
    <Card title="首页轮播" description="Logo 与首页背景图片">
      <ImageUploader
        label="Logo"
        value={s.logo_url}
        nameHint="logo"
        onChange={(url) => update({ logo_url: url })}
        aspect="h-20 w-20"
      />
      <ImageUploader
        label="欢迎区背景图"
        value={s.welcome_image_url}
        nameHint="welcome"
        onChange={(url) => update({ welcome_image_url: url })}
      />
      <ImageUploader
        label="页面整体背景图"
        value={s.background_image_url}
        nameHint="page-bg"
        onChange={(url) => update({ background_image_url: url })}
      />
    </Card>
  );

  const SectionAdminLogo = (
    <AdminLogoEditor alert={alert} />
  );



  const SectionQr = (
    <div className="space-y-5">
      <Card
        title="主页二维码"
        description="主页、欢迎页、电视显示页将同步显示该二维码"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={restoreDefaultQr}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> 恢复默认
          </Button>
        }
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* 预览卡 */}
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] self-start">
            {previewQrImage ? (
              <img
                src={previewQrImage}
                alt="当前二维码"
                className="w-[180px] h-[180px] object-contain"
              />
            ) : (
              <QRCodeSVG value={previewQrLink} size={180} level="H" />
            )}
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            <div>
              <Label className="text-sm font-medium">链接地址</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/60 rounded-xl px-4 py-2.5 break-all">
                  {previewQrImage
                    ? "（使用上传图片，链接以图片实际编码为准）"
                    : previewQrLink}
                </code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => copyLink(previewQrLink)}
              >
                <Copy className="w-4 h-4 mr-1.5" /> 复制链接
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => downloadPngFrom(qrSvgRef.current, "home-qr")}
              >
                <Download className="w-4 h-4 mr-1.5" /> 下载 PNG
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => printQrFrom(qrSvgRef.current, previewQrLink)}
              >
                <Printer className="w-4 h-4 mr-1.5" /> 打印二维码
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              更新时间：{qrUpdatedLabel}
            </p>
          </div>
        </div>

        {/* 隐藏 svg 用作下载/打印源（与预览同步） */}
        <div ref={qrSvgRef} className="hidden">
          <QRCodeSVG value={previewQrLink} size={512} level="H" />
        </div>
      </Card>

      <Card title="生成新二维码" description="选择用途或输入自定义链接，生成后可一键替换主页">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { k: "newcomer", label: "新人登记" },
              { k: "retreat", label: "退修会登记" },
              { k: "chat", label: "幸福聊天室" },
              { k: "custom", label: "自定义链接" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setQrType(t.k)}
              className={`px-4 h-9 text-sm rounded-full transition-colors ${
                qrType === t.k
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {qrType === "custom" && (
          <Field label="自定义链接">
            <Input
              value={qrCustom}
              onChange={(e) => setQrCustom(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        )}
        {qrType === "newcomer" && (
          <Field label="新人登记链接">
            <Input
              value={s.qr_newcomer_url ?? ""}
              onChange={(e) => update({ qr_newcomer_url: e.target.value })}
              placeholder={`${origin}/register`}
            />
          </Field>
        )}
        {qrType === "retreat" && (
          <Field label="退修会登记链接">
            <Input
              value={s.qr_retreat_url ?? ""}
              onChange={(e) => update({ qr_retreat_url: e.target.value })}
              placeholder={`${origin}/retreat-register`}
            />
          </Field>
        )}

        <div className="flex flex-col md:flex-row gap-6 pt-1">
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] self-start">
            <div ref={null as any}>
              <QRCodeSVG value={qrValue} size={160} level="H" />
            </div>
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <code className="block text-xs bg-muted/60 rounded-xl px-4 py-2.5 break-all">
              {qrValue}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => copyLink(qrValue)}
              >
                <Copy className="w-4 h-4 mr-1.5" /> 复制链接
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  // generate from qrValue directly
                  const tmp = document.createElement("div");
                  document.body.appendChild(tmp);
                  const { createRoot } = await import("react-dom/client");
                  const root = createRoot(tmp);
                  root.render(<QRCodeSVG value={qrValue} size={640} level="H" />);
                  setTimeout(async () => {
                    const svgStr = getSvgString(tmp as any);
                    if (svgStr) {
                      const blob = await svgToPngBlob(svgStr, 640);
                      if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `qr-${qrType}-${Date.now()}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }
                    root.unmount();
                    tmp.remove();
                  }, 50);
                }}
              >
                <Download className="w-4 h-4 mr-1.5" /> 下载 PNG
              </Button>
            </div>
            <Button
              onClick={applyGeneratedToHome}
              className="rounded-full"
            >
              <Check className="w-4 h-4 mr-1.5" /> 替换为主页二维码
            </Button>
          </div>
        </div>
      </Card>

      <Card title="上传二维码图片" description="上传 PNG/JPG 二维码，直接作为主页二维码显示">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] grid place-items-center self-start">
            {s.qr_image_url ? (
              <img
                src={s.qr_image_url}
                alt="已上传二维码"
                className="w-[140px] h-[140px] object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground w-[140px] h-[140px] grid place-items-center">
                未上传
              </span>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
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
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <span>
                    <Upload className="w-4 h-4 mr-1.5" /> 上传二维码
                  </span>
                </Button>
              </label>
              {s.qr_image_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => update({ qr_image_url: null })}
                >
                  清除
                </Button>
              )}
            </div>
            <Button onClick={applyUploadedToHome} className="rounded-full">
              <Check className="w-4 h-4 mr-1.5" /> 替换为主页二维码
            </Button>
            <p className="text-xs text-muted-foreground">
              上传图片后主页直接显示该图片；清除后回到根据「登记链接」实时生成的二维码。
            </p>
          </div>
        </div>
      </Card>

      <Card title="二维码文字" description="显示在主页二维码下方">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="标题">
            <Input
              value={s.qr_title ?? ""}
              onChange={(e) => update({ qr_title: e.target.value })}
              placeholder="例如：新人登记"
            />
          </Field>
          <Field label="说明">
            <Input
              value={s.qr_description ?? ""}
              onChange={(e) => update({ qr_description: e.target.value })}
              placeholder="例如：扫码填写新人资料"
            />
          </Field>
        </div>
      </Card>
    </div>
  );

  const SectionWelcome = (
    <Card title="迎宾页面" description="欢迎语、经文、主题与主日时间">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Logo 主标题">
          <Input
            value={s.logo_title ?? ""}
            onChange={(e) => update({ logo_title: e.target.value })}
          />
        </Field>
        <Field label="Logo 副标题">
          <Input
            value={s.logo_subtitle ?? ""}
            onChange={(e) => update({ logo_subtitle: e.target.value })}
          />
        </Field>
        <Field label="欢迎标题">
          <Input
            value={s.welcome_title ?? ""}
            onChange={(e) => update({ welcome_title: e.target.value })}
            placeholder="基督之家"
          />
        </Field>
        <Field label="欢迎副标题">
          <Input
            value={s.welcome_subtitle ?? ""}
            onChange={(e) => update({ welcome_subtitle: e.target.value })}
            placeholder="第三家"
          />
        </Field>
      </div>
      <Field label="欢迎说明">
        <Textarea
          rows={3}
          value={s.welcome_description ?? ""}
          onChange={(e) => update({ welcome_description: e.target.value })}
        />
      </Field>
      <Field label="首页经文">
        <Textarea
          rows={2}
          value={s.bible_verse ?? ""}
          onChange={(e) => update({ bible_verse: e.target.value })}
          placeholder="凡劳苦担重担的人，可以到我这里来…（马太 11:28）"
        />
      </Field>
      <Field label="主日崇拜时间" hint="每行一条">
        <Textarea
          rows={5}
          value={s.worship_schedule ?? ""}
          onChange={(e) => update({ worship_schedule: e.target.value })}
          placeholder={"成人主日学 中文 9:30 am\n成人主日学 英文 9:30 am\n主日敬拜 中文 11:00 am"}
        />
      </Field>
    </Card>
  );

  const SectionRetreat = (
    <Card
      title="退修会页面"
      description="设置退修会登记链接及对应二维码"
    >
      <Field label="退修会登记链接">
        <Input
          value={s.qr_retreat_url ?? ""}
          onChange={(e) => update({ qr_retreat_url: e.target.value })}
          placeholder={`${origin}/retreat-register`}
        />
      </Field>

      <div className="flex flex-col md:flex-row gap-6 pt-1">
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] self-start">
          <div ref={retreatQrRef}>
            <QRCodeSVG value={retreatLink} size={180} level="H" />
          </div>
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <Label className="text-sm font-medium">链接地址</Label>
          <code className="block text-xs bg-muted/60 rounded-xl px-4 py-2.5 break-all">
            {retreatLink}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => copyLink(retreatLink)}
            >
              <Copy className="w-4 h-4 mr-1.5" /> 复制链接
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => downloadPngFrom(retreatQrRef.current, "retreat-qr")}
            >
              <Download className="w-4 h-4 mr-1.5" /> 下载 PNG
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => printQrFrom(retreatQrRef.current, retreatLink)}
            >
              <Printer className="w-4 h-4 mr-1.5" /> 打印二维码
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  const SectionDisplay = (
    <Card title="显示屏内容" description="主页按钮文字与跳转链接">
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="主按钮文字">
          <Input
            value={s.primary_button_text ?? ""}
            onChange={(e) => update({ primary_button_text: e.target.value })}
            placeholder="立即登记 / Register Now"
          />
        </Field>
        <Field label="主按钮链接">
          <Input
            value={s.primary_button_url ?? ""}
            onChange={(e) => update({ primary_button_url: e.target.value })}
            placeholder="/register"
          />
        </Field>
        <Field label="次按钮文字">
          <Input
            value={s.secondary_button_text ?? ""}
            onChange={(e) => update({ secondary_button_text: e.target.value })}
          />
        </Field>
        <Field label="次按钮链接">
          <Input
            value={s.secondary_button_url ?? ""}
            onChange={(e) => update({ secondary_button_url: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  );

  const SectionTheme = (
    <Card title="主题样式" description="年度主题、整体背景与底部文字">
      <Field label="今年主题">
        <Input
          value={s.theme_text ?? ""}
          onChange={(e) => update({ theme_text: e.target.value })}
          placeholder="信靠顺服 活出基督"
        />
      </Field>
      <ImageUploader
        label="页面整体背景图"
        value={s.background_image_url}
        nameHint="page-bg"
        onChange={(url) => update({ background_image_url: url })}
      />
      <Field label="底部版权信息">
        <Input
          value={s.footer_text ?? ""}
          onChange={(e) => update({ footer_text: e.target.value })}
          placeholder="© 基督之家第三家"
        />
      </Field>
    </Card>
  );

  const middle =
    section === "basic" ? SectionBasic
    : section === "carousel" ? SectionCarousel
    : section === "adminLogo" ? SectionAdminLogo
    : section === "qr" ? SectionQr
    : section === "welcome" ? SectionWelcome
    : section === "retreat" ? SectionRetreat
    : section === "display" ? SectionDisplay
    : SectionTheme;

  const currentLabel = SECTIONS.find((x) => x.key === section)?.label ?? "";

  return (
    <div className="min-h-[640px] bg-muted/30 rounded-2xl">
      {dialog}

      {/* Top bar with fixed save on right */}
      <div className="sticky top-0 z-10 backdrop-blur bg-background/80 rounded-t-2xl pl-24 pr-6 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold tracking-tight">主页设置</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            管理主页内容与显示设置 · {currentLabel} · {saving
              ? "保存中…"
              : savedAt
              ? `已保存 ${savedAt.toLocaleTimeString()}`
              : "未保存"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => window.open(origin, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-1.5" /> 查看主页
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-full px-5 shadow-sm"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "保存中…" : "保存设置"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 p-6 pt-2">
        {/* LEFT nav */}
        <nav className="w-full lg:w-[240px] shrink-0">
          <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-2 lg:sticky lg:top-24">
            <ul className="space-y-0.5">
              {SECTIONS.map((it) => {
                const Icon = it.icon;
                const active = section === it.key;
                return (
                  <li key={it.key}>
                    <button
                      onClick={() => setSection(it.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">
                          {it.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {it.hint}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* MAIN content */}
        <main className="flex-1 min-w-0">{middle}</main>
      </div>
    </div>
  );
}

/* ───── 后台 Logo 编辑 ─────────────────────────────────────────────────── */
function AdminLogoEditor({
  alert,
}: {
  alert: (title: string, msg: string, kind?: "info" | "success" | "warn" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zh, setZh] = useState(ADMIN_LOGO_DEFAULTS.admin_logo_title_zh);
  const [en, setEn] = useState(ADMIN_LOGO_DEFAULTS.admin_logo_title_en);
  const [ver, setVer] = useState(ADMIN_LOGO_DEFAULTS.admin_logo_version);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("key,value")
        .in("key", [
          "admin_logo_title_zh",
          "admin_logo_title_en",
          "admin_logo_version",
        ]);
      if (data) {
        for (const r of data as Array<{ key: string; value: string | null }>) {
          if (r.key === "admin_logo_title_zh" && r.value) setZh(r.value);
          if (r.key === "admin_logo_title_en" && r.value) setEn(r.value);
          if (r.key === "admin_logo_version" && r.value) setVer(r.value);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const rows = [
      { key: "admin_logo_title_zh", value: zh.trim() || ADMIN_LOGO_DEFAULTS.admin_logo_title_zh },
      { key: "admin_logo_title_en", value: en.trim() || ADMIN_LOGO_DEFAULTS.admin_logo_title_en },
      { key: "admin_logo_version", value: ver.trim() || ADMIN_LOGO_DEFAULTS.admin_logo_version },
    ];
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      alert("保存失败", error.message, "error");
      return;
    }
    emitAdminLogoUpdated();
    alert("系统提示", "后台 Logo 已保存，左上角已更新。", "success");
  }

  function restoreDefaults() {
    setZh(ADMIN_LOGO_DEFAULTS.admin_logo_title_zh);
    setEn(ADMIN_LOGO_DEFAULTS.admin_logo_title_en);
    setVer(ADMIN_LOGO_DEFAULTS.admin_logo_version);
  }

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">加载中…</div>;
  }

  return (
    <div className="space-y-5">
      <Card title="后台 Logo 编辑" description="后台左上角显示的中文名称、英文名称与版本号">
        <div className="space-y-5">
          <Field label="后台中文名称" hint={`默认：${ADMIN_LOGO_DEFAULTS.admin_logo_title_zh}`}>
            <Input value={zh} onChange={(e) => setZh(e.target.value)} placeholder={ADMIN_LOGO_DEFAULTS.admin_logo_title_zh} />
          </Field>
          <Field label="后台英文名称" hint={`默认：${ADMIN_LOGO_DEFAULTS.admin_logo_title_en}`}>
            <Input value={en} onChange={(e) => setEn(e.target.value)} placeholder={ADMIN_LOGO_DEFAULTS.admin_logo_title_en} />
          </Field>
          <Field label="后台版本号" hint={`默认：${ADMIN_LOGO_DEFAULTS.admin_logo_version}`}>
            <Input value={ver} onChange={(e) => setVer(e.target.value)} placeholder={ADMIN_LOGO_DEFAULTS.admin_logo_version} />
          </Field>

          <div className="rounded-xl bg-muted/40 p-5">
            <div className="text-xs text-muted-foreground mb-3">预览（与后台左上角一致）</div>
            <div className="flex flex-col gap-0.5 leading-tight">
              <span className="text-[24px] font-bold font-serif">{zh || ADMIN_LOGO_DEFAULTS.admin_logo_title_zh}</span>
              <span className="text-[16px] text-foreground/80 tracking-wide">{en || ADMIN_LOGO_DEFAULTS.admin_logo_title_en}</span>
              <span className="text-[14px] text-muted-foreground">{ver || ADMIN_LOGO_DEFAULTS.admin_logo_version}</span>
              <span className="text-[13px] text-muted-foreground/80">2026年6月8日星期一 09:39:20</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="rounded-full">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "保存中…" : "保存"}
            </Button>
            <Button variant="ghost" onClick={restoreDefaults} className="rounded-full">
              <RefreshCw className="w-4 h-4 mr-1.5" /> 恢复默认
            </Button>
          </div>
        </div>
      </Card>

      <Card title="后台 Logo 图片（预留）" description="计划支持上传 SVG / PNG Logo，当前未开放">
        <div className="text-sm text-muted-foreground">
          此功能预留，后续将支持上传 SVG / PNG 自定义 Logo 图片。
        </div>
      </Card>
    </div>
  );
}
