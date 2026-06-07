import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { useWin98Dialog } from "./Win98Dialog";
import logoDefault from "@/assets/logo.png";
import { getPublicOrigin } from "@/lib/public-origin";
import {
  Info,
  Type,
  Image as ImageIcon,
  QrCode,
  Link as LinkIcon,
  Eye,
  Save,
  ExternalLink,
  Copy,
  Download,
  Printer,
  Upload,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

type SectionKey = "basic" | "text" | "media" | "qr" | "buttons" | "preview";

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: any }[] = [
  { key: "basic", label: "基本信息", hint: "教会名称 · 联系方式", icon: Info },
  { key: "text", label: "首页文字", hint: "标题 · 经文 · 主日时间", icon: Type },
  { key: "media", label: "图片与背景", hint: "Logo · 左侧背景 · 页面背景", icon: ImageIcon },
  { key: "qr", label: "二维码管理", hint: "生成 · 上传 · 替换", icon: QrCode },
  { key: "buttons", label: "按钮与链接", hint: "主按钮 · 次按钮 · 底部", icon: LinkIcon },
  { key: "preview", label: "预览与发布", hint: "查看效果 · 保存设置", icon: Eye },
];

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/* ───── Apple-style field primitives ───────────────────────────────────── */
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 shadow-sm">
      <header className="px-6 pt-5 pb-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </header>
      <div className="px-6 pb-6 pt-2 space-y-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
export function HomePageSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [section, setSection] = useState<SectionKey>("basic");
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

  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert("系统提示", `已复制:\n${value}`, "success");
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

  async function persistQrChange(patch: Partial<Settings>) {
    if (!s) return;
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
    return (
      <div className="p-8 text-sm text-muted-foreground">加载中…</div>
    );
  if (!s)
    return (
      <div className="p-8 text-sm text-muted-foreground">未找到主页设置记录</div>
    );

  const previewQrLink = s.qr_newcomer_url?.trim() || `${origin}/register`;
  const previewQrImage = s.qr_image_url?.trim() || null;
  const qrUpdatedLabel = s.home_qr_updated_at
    ? new Date(s.home_qr_updated_at).toLocaleString()
    : "尚未替换";

  /* ─── Right preview pane ────────────────────────────────────────────── */
  const RightPreview = (
    <aside className="w-full lg:w-[360px] shrink-0">
      <div className="lg:sticky lg:top-4 space-y-4">
        <SectionCard title="主页预览" description="实时显示主页效果">
          <div className="rounded-xl bg-muted/40 p-4 border border-border/40">
            <div className="flex items-center gap-2 pb-3 border-b border-border/40 mb-3">
              <img
                src={s.logo_url || logoDefault}
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = logoDefault)
                }
                alt=""
                className="h-7 w-7 object-contain"
              />
              <span className="font-serif text-sm">
                {s.site_title || s.logo_title || "基督之家第三家"}
              </span>
            </div>
            <div
              className="rounded-lg p-3 mb-3"
              style={
                s.welcome_image_url
                  ? {
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.85),rgba(255,255,255,0.85)),url(${s.welcome_image_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { background: "hsl(var(--background))" }
              }
            >
              <div className="text-base font-semibold leading-tight">
                {s.welcome_title || "基督之家"}
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {s.welcome_subtitle || "第三家"}
              </div>
              <div className="text-[11px] text-foreground/70 whitespace-pre-line">
                {s.welcome_description || "这家就是永生神的教会，真理的柱石和根基。"}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              {previewQrImage ? (
                <img
                  src={previewQrImage}
                  alt="主页二维码"
                  className="w-[150px] h-[150px] object-contain bg-white rounded"
                />
              ) : (
                <div className="p-2 bg-white rounded">
                  <QRCodeSVG value={previewQrLink} size={140} level="H" />
                </div>
              )}
              <div className="text-xs text-foreground">
                {s.qr_title || "扫码登记"}
              </div>
              <div className="text-[10px] text-muted-foreground break-all text-center px-1">
                {previewQrImage ? "(使用上传的二维码图片)" : previewQrLink}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="发布状态">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">保存状态</span>
            <span className="font-medium">
              {saving ? "保存中…" : savedAt ? `已保存 · ${savedAt.toLocaleTimeString()}` : "未保存"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">二维码更新</span>
            <span className="font-medium">{qrUpdatedLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(origin, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> 查看主页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyLink(previewQrLink)}
            >
              <Copy className="w-4 h-4 mr-1" /> 复制链接
            </Button>
          </div>
        </SectionCard>
      </div>
    </aside>
  );

  /* ─── Middle: section forms ─────────────────────────────────────────── */
  const MiddleBasic = (
    <SectionCard title="基本信息" description="网站、教会与联系方式">
      <div className="grid sm:grid-cols-2 gap-4">
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
        <Field label="地址(中文)">
          <Input
            value={s.church_address ?? ""}
            onChange={(e) => update({ church_address: e.target.value })}
          />
        </Field>
        <Field label="地址(英文)">
          <Input
            value={s.church_address_en ?? ""}
            onChange={(e) => update({ church_address_en: e.target.value })}
          />
        </Field>
      </div>
    </SectionCard>
  );

  const MiddleText = (
    <>
      <SectionCard title="首页文字" description="Logo 标题、欢迎语和经文">
        <div className="grid sm:grid-cols-2 gap-4">
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
            placeholder="凡劳苦担重担的人，可以到我这里来…(马太 11:28)"
          />
        </Field>
        <Field label="今年主题">
          <Input
            value={s.theme_text ?? ""}
            onChange={(e) => update({ theme_text: e.target.value })}
            placeholder="信靠顺服 活出基督"
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
      </SectionCard>
    </>
  );

  const ImageUploader = ({
    label,
    value,
    nameHint,
    onChange,
  }: {
    label: string;
    value: string | null;
    nameHint: string;
    onChange: (url: string | null) => void;
  }) => (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <div className="h-20 w-32 rounded-lg overflow-hidden bg-muted/40 border border-border/60 grid place-items-center">
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
            <Button asChild size="sm" variant="outline">
              <span>
                <Upload className="w-4 h-4 mr-1" /> 上传
              </span>
            </Button>
          </label>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            清除
          </Button>
        </div>
      </div>
    </Field>
  );

  const MiddleMedia = (
    <SectionCard title="图片与背景" description="Logo、欢迎区背景和整体页面背景">
      <ImageUploader
        label="Logo"
        value={s.logo_url}
        nameHint="logo"
        onChange={(url) => update({ logo_url: url })}
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
    </SectionCard>
  );

  const MiddleQr = (
    <>
      <SectionCard
        title="当前主页二维码"
        description="主页/电视/欢迎页都将同步显示该二维码"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="rounded-xl p-4 bg-white border border-border/60">
            {previewQrImage ? (
              <img
                src={previewQrImage}
                alt="当前二维码"
                className="w-[160px] h-[160px] object-contain"
              />
            ) : (
              <QRCodeSVG value={previewQrLink} size={160} level="H" />
            )}
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <Field label="当前跳转链接">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 rounded-md px-3 py-2 break-all">
                  {previewQrImage ? "(使用上传图片，链接以图片实际编码为准)" : previewQrLink}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(previewQrLink)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </Field>
            <div className="text-xs text-muted-foreground">
              更新时间：{qrUpdatedLabel}
            </div>
            <Button size="sm" variant="ghost" onClick={restoreDefaultQr}>
              <RefreshCw className="w-4 h-4 mr-1" /> 恢复默认二维码
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="生成新二维码" description="输入链接或选择用途，立即生成">
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
              className={`px-3.5 h-8 text-sm rounded-full border transition-colors ${
                qrType === t.k
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border/60 hover:bg-muted"
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

        <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
          <div
            ref={qrSvgRef}
            className="rounded-xl bg-white p-4 border border-border/60"
          >
            <QRCodeSVG value={qrValue} size={160} level="H" />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <code className="block text-xs bg-muted/50 rounded-md px-3 py-2 break-all">
              {qrValue}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copyLink(qrValue)}>
                <Copy className="w-4 h-4 mr-1" /> 复制链接
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPng}>
                <Download className="w-4 h-4 mr-1" /> 下载 PNG
              </Button>
              <Button size="sm" variant="outline" onClick={printQr}>
                <Printer className="w-4 h-4 mr-1" /> 打印
              </Button>
            </div>
            <Button onClick={applyGeneratedToHome} className="w-full sm:w-auto">
              <Check className="w-4 h-4 mr-1" /> 替换当前主页二维码
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="上传二维码图片" description="上传 PNG/JPG 二维码，一键替换主页">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="rounded-xl p-4 bg-white border border-border/60 grid place-items-center min-w-[120px]">
            {s.qr_image_url ? (
              <img
                src={s.qr_image_url}
                alt="已上传二维码"
                className="w-[120px] h-[120px] object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground w-[120px] h-[120px] grid place-items-center">
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
                <Button asChild size="sm" variant="outline">
                  <span>
                    <Upload className="w-4 h-4 mr-1" /> 上传二维码
                  </span>
                </Button>
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update({ qr_image_url: null })}
              >
                清除
              </Button>
            </div>
            <Button onClick={applyUploadedToHome}>
              <Check className="w-4 h-4 mr-1" /> 替换为主页二维码
            </Button>
            <p className="text-xs text-muted-foreground">
              上传图片后，主页直接显示该图片；清除后回到根据「登记链接」实时生成的二维码。
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="二维码文字" description="显示在主页二维码下方">
        <div className="grid sm:grid-cols-2 gap-4">
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
      </SectionCard>
    </>
  );

  const MiddleButtons = (
    <SectionCard title="按钮与链接" description="主页 CTA 按钮与底部版权">
      <div className="grid sm:grid-cols-2 gap-4">
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
      <Field label="底部版权信息">
        <Input
          value={s.footer_text ?? ""}
          onChange={(e) => update({ footer_text: e.target.value })}
          placeholder="© 基督之家第三家"
        />
      </Field>
    </SectionCard>
  );

  const MiddlePreview = (
    <SectionCard title="预览与发布" description="保存后所有显示位会立即更新">
      <p className="text-sm text-muted-foreground">
        点击下方「保存」即可发布主页内容，主页、欢迎页、电视显示页会立刻读取最新设置。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.open(origin, "_blank")}>
          <ExternalLink className="w-4 h-4 mr-1" /> 在新窗口打开主页
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "保存中…" : "保存设置"}
        </Button>
      </div>
    </SectionCard>
  );

  const middle =
    section === "basic" ? MiddleBasic
    : section === "text" ? MiddleText
    : section === "media" ? MiddleMedia
    : section === "qr" ? MiddleQr
    : section === "buttons" ? MiddleButtons
    : MiddlePreview;

  return (
    <div className="min-h-[600px] bg-muted/30 rounded-xl">
      {dialog}

      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* ───── LEFT: section nav ───── */}
        <nav className="w-full lg:w-[220px] shrink-0">
          <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-2 lg:sticky lg:top-4">
            <div className="px-3 py-2">
              <div className="text-base font-semibold">主页设置</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Home Page Settings
              </div>
            </div>
            <ul className="space-y-0.5">
              {SECTIONS.map((it) => {
                const Icon = it.icon;
                const active = section === it.key;
                return (
                  <li key={it.key}>
                    <button
                      onClick={() => setSection(it.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{it.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
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

        {/* ───── MIDDLE: form ───── */}
        <main className="flex-1 min-w-0 space-y-4">{middle}</main>

        {/* ───── RIGHT: preview ───── */}
        {RightPreview}
      </div>

      {/* ───── Sticky save bar ───── */}
      <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border/60 rounded-b-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          {saving
            ? "正在保存…"
            : savedAt
            ? `上次保存：${savedAt.toLocaleTimeString()}`
            : "未保存"}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(origin, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-1" /> 查看主页
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中…" : "保存设置"}
          </Button>
        </div>
      </div>
    </div>
  );
}
