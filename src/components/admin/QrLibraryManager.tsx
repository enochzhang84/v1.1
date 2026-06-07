import { memo, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Download, Printer, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; sort_order: number };

type QrItem = {
  id: string;
  name: string;
  category_id: string | null;
  target_url: string | null;
  image_url: string | null;
  description: string | null;
  is_default: boolean;
  usage_type: string | null;
  created_at: string;
  updated_at: string;
};

/** Legacy / built-in QR codes — always available, read-only. */
function buildLegacyItems(publicBase: string, eventToken?: string | null): QrItem[] {
  const now = new Date().toISOString();
  const make = (key: string, name: string, url: string, usage_type: string): QrItem => ({
    id: `legacy:${key}`,
    name,
    category_id: null,
    target_url: url,
    image_url: null,
    description: "系统内置二维码",
    is_default: false,
    usage_type,
    created_at: now,
    updated_at: now,
  });
  return [
    make("register", "扫码登记（新人登记）",
      eventToken ? `${publicBase}/register?event=${eventToken}` : `${publicBase}/register`,
      "newcomer"),
    make("retreat", "退修会登记", `${publicBase}/retreat`, "retreat"),
    make("sunday", "成人主日学签到", `${publicBase}/sunday-checkin`, "sunday"),
    make("adult-summer", "暑期成人主日学签到", `${publicBase}/adult-checkin/summer`, "sunday"),
    make("adult-fall", "秋季成人主日学签到", `${publicBase}/adult-checkin/fall`, "sunday"),
    make("serve", "服侍申请", `${publicBase}/serve-apply`, "ministry"),
    make("fellowship", "团契 / 小组聚会签到", `${publicBase}/fellowship-checkin`, "fellowship"),
    make("feedback", "问题反馈", `${publicBase}/feedback`, "feedback"),
  ];
}

const LEGACY_CATEGORY_ID = "__legacy__";
const ALL_CATEGORY_ID = "__all__";
const UNCATEGORIZED_ID = "__uncategorized__";
const PREVIEW_INITIAL_LIMIT = 6;

function detectPreviewEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  try {
    const h = window.location.hostname;
    if (/lovable\.app$|lovableproject\.com$|lovable\.dev$/i.test(h)) return true;
  } catch {
    /* noop */
  }
  return false;
}

export function QrLibraryManager({
  publicBase,
  eventToken,
  canEdit,
}: {
  publicBase: string;
  eventToken?: string | null;
  canEdit: boolean;
}) {
  const isPreview = useMemo(() => detectPreviewEnv(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<QrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>(ALL_CATEGORY_ID);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<QrItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [forceRenderQr, setForceRenderQr] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onOk: () => void;
  } | null>(null);

  const legacyItems = useMemo(
    () => buildLegacyItems(publicBase, eventToken),
    [publicBase, eventToken],
  );

  async function refresh() {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from("qr_categories").select("*").order("sort_order").order("name"),
      supabase.from("qr_library").select("*").order("updated_at", { ascending: false }),
    ]);
    if (catsRes.data) setCategories(catsRes.data as Category[]);
    if (itemsRes.data) setItems(itemsRes.data as QrItem[]);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const allItems = useMemo(() => [...items, ...legacyItems], [items, legacyItems]);

  const filtered = useMemo(() => {
    let list: QrItem[];
    if (selectedCat === ALL_CATEGORY_ID) list = allItems;
    else if (selectedCat === LEGACY_CATEGORY_ID) list = legacyItems;
    else if (selectedCat === UNCATEGORIZED_ID) list = items.filter((i) => !i.category_id);
    else list = items.filter((i) => i.category_id === selectedCat);

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.target_url ?? "").toLowerCase().includes(q),
    );
  }, [selectedCat, items, legacyItems, allItems, search]);

  const visibleList = useMemo(() => {
    if (!isPreview || showAllInPreview) return filtered;
    return filtered.slice(0, PREVIEW_INITIAL_LIMIT);
  }, [filtered, isPreview, showAllInPreview]);
  const hiddenCount = filtered.length - visibleList.length;

  useEffect(() => {
    setShowAllInPreview(false);
  }, [selectedCat, search]);

  function requestRenderQr(id: string) {
    setForceRenderQr((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
  }

  function askConfirm(title: string, message: string, onOk: () => void) {
    setConfirmState({ title, message, onOk });
  }

  async function deleteItem(item: QrItem) {
    if (item.id.startsWith("legacy:")) {
      toast.info("系统内置二维码不可删除");
      return;
    }
    askConfirm("删除二维码", `确定删除「${item.name}」？`, async () => {
      const { error } = await supabase.from("qr_library").delete().eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("已删除");
      await refresh();
    });
  }

  function svgToCanvas(svg: SVGSVGElement, size = 600): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const data = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  async function downloadPng(item: QrItem) {
    const url = item.target_url;
    if (!url) {
      toast.error("无链接");
      return;
    }
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    try {
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(wrapper);
      await new Promise<void>((resolve) => {
        root.render(<QRCodeSVG value={url} size={600} level="H" includeMargin />);
        setTimeout(resolve, 50);
      });
      const svg = wrapper.querySelector("svg")!;
      const canvas = await svgToCanvas(svg, 600);
      const link = document.createElement("a");
      link.download = `${item.name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      root.unmount();
    } finally {
      wrapper.remove();
    }
  }

  function printItem(item: QrItem) {
    const url = item.target_url;
    if (!url) {
      toast.error("无链接");
      return;
    }
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${item.name}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
h1{font-size:28px;margin:0 0 16px;}p.url{color:#555;margin:16px 0 0;font-size:12px;word-break:break-all;text-align:center;max-width:520px;}
p.desc{color:#333;margin:8px 0 0;font-size:14px;text-align:center;max-width:520px;}
img{width:480px;height:480px;}@media print{@page{margin:1cm;}}</style></head>
<body><h1>${item.name}</h1><img src="${qrSrc}" alt="QR"/>
${item.description ? `<p class="desc">${item.description}</p>` : ""}
<p class="url">${url}</p>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("浏览器拦截了弹窗");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="border border-border/50 rounded-xl bg-card p-3 space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索名称 / 链接 / 备注..."
          className="h-9 w-full sm:w-64"
        />
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value={ALL_CATEGORY_ID}>全部 ({allItems.length})</option>
          <option value={LEGACY_CATEGORY_ID}>系统内置 ({legacyItems.length})</option>
          <option value={UNCATEGORIZED_ID}>
            未分类 ({items.filter((i) => !i.category_id).length})
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({items.filter((i) => i.category_id === c.id).length})
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">共 {filtered.length} 项</div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreatingItem(true)}>
            <Plus className="size-3.5 mr-1" />
            新增二维码
          </Button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-sm text-muted-foreground p-6">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center">暂无二维码</div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {visibleList.map((it) => (
              <QrCard
                key={it.id}
                item={it}
                categoryName={
                  categories.find((c) => c.id === it.category_id)?.name ??
                  (it.id.startsWith("legacy:") ? "系统内置" : "未分类")
                }
                canEdit={canEdit}
                lite={isPreview && !forceRenderQr.has(it.id)}
                onGenerate={() => requestRenderQr(it.id)}
                onEdit={() => setEditingItem(it)}
                onPrint={() => printItem(it)}
                onDownload={() => downloadPng(it)}
                onDelete={() => deleteItem(it)}
              />
            ))}
          </div>
          {hiddenCount > 0 && (
            <div className="mt-1 flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <div>预览环境下已隐藏 {hiddenCount} 个二维码以避免卡顿</div>
              <Button size="sm" variant="outline" onClick={() => setShowAllInPreview(true)}>
                显示更多 ({filtered.length})
              </Button>
            </div>
          )}
        </>
      )}

      {/* Item Editor */}
      {(creatingItem || editingItem) && (
        <ItemEditor
          item={editingItem}
          categories={categories}
          onClose={() => {
            setCreatingItem(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setCreatingItem(false);
            setEditingItem(null);
            void refresh();
          }}
        />
      )}

      {/* Confirm */}
      {confirmState && (
        <Dialog open onOpenChange={(o) => !o && setConfirmState(null)}>
          <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{confirmState.title}</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-foreground/80 whitespace-pre-wrap">
              {confirmState.message}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmState(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const fn = confirmState.onOk;
                  setConfirmState(null);
                  fn();
                }}
              >
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

const QrThumb = memo(function QrThumb({
  imageUrl,
  targetUrl,
  size,
  lite,
  onGenerate,
}: {
  imageUrl: string | null;
  targetUrl: string | null;
  size: number;
  lite?: boolean;
  onGenerate?: () => void;
}) {
  // Prefer dynamic QR generation from target_url over a previously uploaded
  // image — uploaded images may bake in a stale/legacy domain that no
  // longer matches the current deployment.
  if (targetUrl) {
    if (lite) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGenerate?.();
          }}
          style={{ width: size, height: size }}
          className="flex flex-col items-center justify-center gap-1 border border-dashed border-border/60 rounded text-[11px] text-muted-foreground hover:bg-accent/50"
          title="点击生成二维码"
        >
          <QrCode className="size-6 opacity-50" />
          <span>点击生成</span>
        </button>
      );
    }
    return <QRCodeSVG value={targetUrl} size={size} level="H" />;
  }
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        loading="lazy"
        alt=""
        style={{ width: size, height: size }}
        className="object-contain"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-border/60 rounded"
    >
      无链接
    </div>
  );
});

const QrCard = memo(function QrCard({
  item,
  categoryName,
  canEdit,
  lite,
  onGenerate,
  onEdit,
  onPrint,
  onDownload,
  onDelete,
}: {
  item: QrItem;
  categoryName: string;
  canEdit: boolean;
  lite?: boolean;
  onGenerate: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isLegacy = item.id.startsWith("legacy:");
  const hasQr = !!item.image_url || (!!item.target_url && !lite);
  return (
    <div
      className={cn(
        "border border-border/50 rounded-lg p-2 flex flex-col items-center gap-2 bg-background",
      )}
    >
      <div className="bg-white p-2 rounded">
        <QrThumb
          imageUrl={item.image_url}
          targetUrl={item.target_url}
          size={120}
          lite={lite}
          onGenerate={onGenerate}
        />
      </div>
      <div className="w-full text-center">
        <div className="text-xs font-medium truncate" title={item.name}>
          {item.name}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{categoryName}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-1 w-full">
        {!hasQr && item.target_url && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onGenerate}>
            生成
          </Button>
        )}
        {canEdit && !isLegacy && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onEdit}>
            <Pencil className="size-3 mr-0.5" />编辑
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onPrint}>
          <Printer className="size-3 mr-0.5" />打印
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onDownload}>
          <Download className="size-3 mr-0.5" />下载
        </Button>
        {canEdit && !isLegacy && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3 mr-0.5" />删除
          </Button>
        )}
      </div>
    </div>
  );
});

function ItemEditor({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: QrItem | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [targetUrl, setTargetUrl] = useState(item?.target_url ?? "");
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [usageType, setUsageType] = useState(item?.usage_type ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    const path = `qr-library/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("site-assets")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    toast.success("图片已上传");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("请输入名称");
      return;
    }
    if (!targetUrl.trim() && !imageUrl.trim()) {
      toast.error("请填写链接或上传图片");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      category_id: categoryId,
      target_url: targetUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      usage_type: usageType.trim() || null,
    };
    const res = item
      ? await supabase.from("qr_library").update(payload).eq("id", item.id)
      : await supabase.from("qr_library").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(item ? "已更新" : "已创建");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "编辑二维码" : "新增二维码"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">名称 *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：奉献二维码"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">分类</label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">目标链接</label>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://..."
            />
            {targetUrl && (
              <div className="mt-2 inline-block bg-white p-2 rounded">
                <QRCodeSVG value={targetUrl} size={120} level="H" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">或上传二维码图片</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                选择图片
              </Button>
              {imageUrl && (
                <img src={imageUrl} alt="" className="w-12 h-12 object-contain border rounded" />
              )}
              {imageUrl && (
                <Button size="sm" variant="ghost" onClick={() => setImageUrl("")}>
                  清除
                </Button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">类型标签（可选）</label>
            <Input
              value={usageType}
              onChange={(e) => setUsageType(e.target.value)}
              placeholder="例如：donation, zoom, wechat"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">备注</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
