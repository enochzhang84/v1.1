import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  Heading1, Heading2, Heading3, Type, Image as ImageIcon, Video, QrCode,
  MousePointerClick, Minus, Trash2, GripVertical, Save, Eye, RotateCcw, Upload,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";
import {
  type HomeBlock,
  newId,
  defaultHomeTemplate,
  sanitizeBlocks,
  sanitizeHtml,
} from "@/lib/home-content";
import { HomeBlocksRenderer } from "@/components/home/HomeBlocksRenderer";

const BUCKET = "site-assets";
const STORAGE_PREFIX = "home-page";

async function uploadFile(file: File, kind: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${STORAGE_PREFIX}/${kind}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function RichTextEditor({ value, onChange, color }: { value: string; onChange: (html: string) => void; color?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[40px] p-2" } },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-md bg-white">
      <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/30">
        <Button type="button" size="sm" variant={editor.isActive("bold") ? "default" : "ghost"} onClick={() => editor.chain().focus().toggleBold().run()} className="h-7 w-7 p-0"><Bold className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="sm" variant={editor.isActive("italic") ? "default" : "ghost"} onClick={() => editor.chain().focus().toggleItalic().run()} className="h-7 w-7 p-0"><Italic className="h-3.5 w-3.5" /></Button>
        <span className="w-px bg-border mx-1" />
        <Button type="button" size="sm" variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"} onClick={() => editor.chain().focus().setTextAlign("left").run()} className="h-7 w-7 p-0"><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="sm" variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"} onClick={() => editor.chain().focus().setTextAlign("center").run()} className="h-7 w-7 p-0"><AlignCenter className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="sm" variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"} onClick={() => editor.chain().focus().setTextAlign("right").run()} className="h-7 w-7 p-0"><AlignRight className="h-3.5 w-3.5" /></Button>
        <span className="w-px bg-border mx-1" />
        <label className="inline-flex items-center gap-1 px-2 text-xs cursor-pointer">
          颜色
          <input type="color" value={color || "#0f172a"} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="w-5 h-5 border rounded cursor-pointer" />
        </label>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: (handleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-card">
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function BlockEditor({ block, onChange, onDelete, dragHandle }: {
  block: HomeBlock;
  onChange: (b: HomeBlock) => void;
  onDelete: () => void;
  dragHandle: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video" | "qr") {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFile(f, kind);
      if (kind === "image" && block.type === "image") onChange({ ...block, url });
      if (kind === "video" && block.type === "video") onChange({ ...block, url, provider: "file" });
      if (kind === "qr" && block.type === "qrcode") onChange({ ...block, image_url: url, mode: "image" });
    } catch (err) {
      alert("上传失败：" + (err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const labels: Record<string, string> = {
    heading: "标题", paragraph: "正文", image: "图片", video: "视频",
    qrcode: "二维码", button: "按钮", divider: "分隔线",
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" {...dragHandle} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground" aria-label="拖拽">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-muted-foreground">{labels[block.type]}</span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDelete} className="h-7 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {block.type === "heading" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">级别</Label>
            <select className="text-sm border rounded px-2 py-1" value={block.level} onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>H1 大</option>
              <option value={2}>H2 中</option>
              <option value={3}>H3 小</option>
            </select>
            <Label className="text-xs ml-2">颜色</Label>
            <input type="color" value={block.color || "#0f172a"} onChange={(e) => onChange({ ...block, color: e.target.value })} className="w-7 h-7 border rounded cursor-pointer" />
            <Label className="text-xs ml-2">对齐</Label>
            <select className="text-sm border rounded px-2 py-1" value={block.align || "left"} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}>
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </div>
          <RichTextEditor value={block.html} onChange={(html) => onChange({ ...block, html })} color={block.color} />
        </div>
      )}

      {block.type === "paragraph" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">颜色</Label>
            <input type="color" value={block.color || "#334155"} onChange={(e) => onChange({ ...block, color: e.target.value })} className="w-7 h-7 border rounded cursor-pointer" />
            <Label className="text-xs ml-2">对齐</Label>
            <select className="text-sm border rounded px-2 py-1" value={block.align || "left"} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}>
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </div>
          <RichTextEditor value={block.html} onChange={(html) => onChange({ ...block, html })} color={block.color} />
        </div>
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Input placeholder="图片 URL" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} />
            <label className="inline-flex items-center gap-1 px-3 py-2 border rounded cursor-pointer hover:bg-accent text-sm">
              <Upload className="h-3.5 w-3.5" /> 上传
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "image")} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">替代文字</Label>
            <Input placeholder="alt" value={block.alt || ""} onChange={(e) => onChange({ ...block, alt: e.target.value })} className="flex-1" />
            <Label className="text-xs">宽度</Label>
            <Input type="number" placeholder="px" value={block.width || ""} onChange={(e) => onChange({ ...block, width: e.target.value ? Number(e.target.value) : undefined })} className="w-24" />
            <select className="text-sm border rounded px-2 py-1" value={block.align || "center"} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}>
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </div>
          {block.url && <img src={block.url} alt="" className="max-h-32 rounded border" />}
          {uploading && <p className="text-xs text-muted-foreground">上传中…</p>}
        </div>
      )}

      {block.type === "video" && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Input placeholder="视频 URL（支持 mp4 / YouTube 链接）" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} />
            <label className="inline-flex items-center gap-1 px-3 py-2 border rounded cursor-pointer hover:bg-accent text-sm">
              <Upload className="h-3.5 w-3.5" /> 上传
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleUpload(e, "video")} />
            </label>
          </div>
          {uploading && <p className="text-xs text-muted-foreground">上传中…</p>}
        </div>
      )}

      {block.type === "qrcode" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs flex items-center gap-1">
              <input type="radio" checked={block.mode === "auto"} onChange={() => onChange({ ...block, mode: "auto" })} /> 自动生成
            </label>
            <label className="text-xs flex items-center gap-1">
              <input type="radio" checked={block.mode === "image"} onChange={() => onChange({ ...block, mode: "image" })} /> 上传图片
            </label>
            <Label className="text-xs ml-2">尺寸</Label>
            <Input type="number" value={block.size || 200} onChange={(e) => onChange({ ...block, size: Number(e.target.value) })} className="w-24" />
            <select className="text-sm border rounded px-2 py-1" value={block.align || "center"} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}>
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </div>
          {block.mode === "auto" ? (
            <Input placeholder="链接或文本" value={block.value || ""} onChange={(e) => onChange({ ...block, value: e.target.value })} />
          ) : (
            <div className="flex gap-2 items-center">
              <Input placeholder="图片 URL" value={block.image_url || ""} onChange={(e) => onChange({ ...block, image_url: e.target.value })} />
              <label className="inline-flex items-center gap-1 px-3 py-2 border rounded cursor-pointer hover:bg-accent text-sm">
                <Upload className="h-3.5 w-3.5" /> 上传
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "qr")} />
              </label>
            </div>
          )}
          <Input placeholder="二维码下方文字（可选）" value={block.label || ""} onChange={(e) => onChange({ ...block, label: e.target.value })} />
          <div className="flex justify-center p-2 bg-white rounded border">
            {block.mode === "auto" && block.value ? (
              <QRCodeSVG value={block.value} size={Math.min(block.size || 200, 160)} />
            ) : block.mode === "image" && block.image_url ? (
              <img src={block.image_url} alt="" style={{ maxHeight: 160 }} />
            ) : (
              <span className="text-xs text-muted-foreground py-8">填写后预览</span>
            )}
          </div>
        </div>
      )}

      {block.type === "button" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="按钮文字" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
            <Input placeholder="链接（/page 或 https://）" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">样式</Label>
            <select className="text-sm border rounded px-2 py-1" value={block.variant || "primary"} onChange={(e) => onChange({ ...block, variant: e.target.value as "primary" | "secondary" | "outline" })}>
              <option value="primary">主按钮</option>
              <option value="secondary">次按钮</option>
              <option value="outline">描边</option>
            </select>
            <Label className="text-xs ml-2">对齐</Label>
            <select className="text-sm border rounded px-2 py-1" value={block.align || "center"} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}>
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </div>
        </div>
      )}

      {block.type === "divider" && (
        <hr className="border-t border-border" />
      )}
    </div>
  );
}

export function HomeVisualEditor() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emptyState, setEmptyState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading((l) => {
          if (l) setLoadError("加载主页内容超时（10 秒）。可能是网络问题或数据库权限不足。");
          return false;
        });
      }
    }, 10000);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("home_page_content")
          .select("id, blocks, updated_at")
          .eq("slug", "home")
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("[home-editor] 读取失败", error);
          setLoadError(`读取主页内容失败：${error.message}（code: ${error.code ?? "-"}）`);
          setBlocks(defaultHomeTemplate());
          setEmptyState(true);
        } else if (data) {
          setContentId(data.id);
          const arr = Array.isArray(data.blocks) ? (data.blocks as unknown as HomeBlock[]) : [];
          if (arr.length === 0) {
            setBlocks(defaultHomeTemplate());
            setEmptyState(true);
          } else {
            setBlocks(arr);
          }
          setSavedAt(data.updated_at);
        } else {
          // 没有记录 → 显示「使用默认模板初始化」
          setBlocks(defaultHomeTemplate());
          setEmptyState(true);
        }
      } catch (e) {
        console.error("[home-editor] 异常", e);
        if (!cancelled) {
          setLoadError((e as Error).message || String(e));
          setBlocks(defaultHomeTemplate());
          setEmptyState(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
        clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);



  const addBlock = useCallback((type: HomeBlock["type"]) => {
    const id = newId();
    let nb: HomeBlock;
    switch (type) {
      case "heading": nb = { id, type, level: 2, html: "新标题", align: "center" }; break;
      case "paragraph": nb = { id, type, html: "<p>在此输入正文…</p>", align: "left" }; break;
      case "image": nb = { id, type, url: "", align: "center" }; break;
      case "video": nb = { id, type, url: "" }; break;
      case "qrcode": nb = { id, type, mode: "auto", value: "https://", size: 200, align: "center" }; break;
      case "button": nb = { id, type, text: "立即查看", url: "/", variant: "primary", align: "center" }; break;
      case "divider": nb = { id, type }; break;
    }
    setBlocks((prev) => [...prev, nb]);
  }, []);

  const updateBlock = useCallback((id: string, nb: HomeBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? nb : b)));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    if (!confirm("删除该模块？")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const cleaned = sanitizeBlocks(blocks);
      const user = (await supabase.auth.getUser()).data.user;
      const payload = {
        slug: "home",
        blocks: cleaned as unknown as import("@/integrations/supabase/types").Json,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      if (contentId) {
        const { error } = await supabase.from("home_page_content").update(payload).eq("id", contentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("home_page_content").insert(payload).select("id").single();
        if (error) throw error;
        setContentId(data.id);
      }
      setSavedAt(new Date().toISOString());
      alert("已保存。前台主页将立即更新。");
    } catch (e) {
      alert("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [blocks, contentId]);

  const handleReset = useCallback(() => {
    if (!confirm("恢复为默认模板？当前未保存的修改会丢失。")) return;
    setBlocks(defaultHomeTemplate());
  }, []);

  const previewBlocks = useMemo(() => sanitizeBlocks(blocks), [blocks]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">正在加载主页内容…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3 sticky top-0 z-10">
        <span className="text-sm font-semibold mr-2">🎨 主页可视化编辑</span>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => addBlock("heading")}><Heading1 className="h-3.5 w-3.5 mr-1" />标题</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("paragraph")}><Type className="h-3.5 w-3.5 mr-1" />文字</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("image")}><ImageIcon className="h-3.5 w-3.5 mr-1" />图片</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("video")}><Video className="h-3.5 w-3.5 mr-1" />视频</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("qrcode")}><QrCode className="h-3.5 w-3.5 mr-1" />二维码</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("button")}><MousePointerClick className="h-3.5 w-3.5 mr-1" />按钮</Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("divider")}><Minus className="h-3.5 w-3.5 mr-1" />分隔</Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {savedAt && <span className="text-xs text-muted-foreground">上次保存：{new Date(savedAt).toLocaleString("zh-CN")}</span>}
          <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}><Eye className="h-3.5 w-3.5 mr-1" />{showPreview ? "返回编辑" : "预览"}</Button>
          <Button size="sm" variant="outline" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5 mr-1" />恢复默认</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? "保存中…" : "保存"}</Button>
        </div>
      </div>

      {loadError && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-sm text-destructive">
          ⚠ {loadError}
        </div>
      )}
      {emptyState && !loadError && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center justify-between">
          <span>📄 还没有数据库内容，已为你加载「基督三家主页」默认模板。点击右上角「保存」即可初始化。</span>
          <Button size="sm" onClick={handleSave} disabled={saving}>使用默认模板初始化</Button>
        </div>
      )}

      {/* 主体 */}
      <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
        {showPreview ? (
          <div className="bg-background rounded-lg shadow-sm max-w-5xl mx-auto">
            <HomeBlocksRenderer blocks={previewBlocks} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((b) => (
                  <SortableItem key={b.id} id={b.id}>
                    {(handle) => (
                      <BlockEditor block={b} dragHandle={handle} onChange={(nb) => updateBlock(b.id, nb)} onDelete={() => deleteBlock(b.id)} />
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            {blocks.length === 0 && (
              <div className="text-center text-muted-foreground p-12 border-2 border-dashed rounded-lg">
                还没有模块，点击上方按钮添加。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
