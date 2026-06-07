import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getPublicOrigin } from "@/lib/public-origin";

export const Route = createFileRoute("/signage")({
  component: SignagePage,
});

type Poster = {
  id: string;
  slug: string | null;
  kind: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  background: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const KINDS = [
  { v: "text", label: "📝 文字宣传" },
  { v: "image", label: "🖼 图片宣传" },
  { v: "page", label: "🌐 网站页面" },
  { v: "external", label: "🔗 外部网页" },
];

const SITE_PAGES = [
  { label: "首页", path: "/" },
  { label: "退修会主页", path: "/retreat" },
  { label: "退修会报名", path: "/retreat-register" },
  { label: "新人登记", path: "/register" },
  { label: "主日学课表", path: "/sunday-schedule" },
  { label: "留言板", path: "/message-board" },
  { label: "意见反馈", path: "/feedback" },
];

function SignagePage() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [editing, setEditing] = useState<Poster | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("display_posters" as never)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPosters((data as unknown as Poster[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-signage")
      .on("postgres_changes", { event: "*", schema: "public", table: "display_posters" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const openNew = () => {
    setIsNew(true);
    setEditing({
      id: "",
      slug: null,
      kind: "text",
      title: "",
      subtitle: null,
      body: null,
      image_url: null,
      link_url: null,
      background: null,
      is_active: true,
      sort_order: (posters[posters.length - 1]?.sort_order ?? 0) + 10,
      created_at: "",
    });
  };

  const remove = async (p: Poster) => {
    if (!confirm(`删除「${p.title}」？`)) return;
    const { error } = await supabase.from("display_posters" as never).delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else toast.success("已删除");
  };

  const copyLink = async (p: Poster) => {
    const url = `${window.location.origin}/display/poster/${p.slug || p.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("链接已复制");
  };

  return (
    <div className="min-h-screen bg-[#FAF3E3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl">📢 宣传栏</h1>
            <p className="text-sm text-muted-foreground mt-1">
              电视投屏 · 数字标牌 · 活动宣传 · 通知公告
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin">
              <Button variant="outline">返回后台</Button>
            </Link>
            <Button onClick={openNew}>➕ 新建宣传内容</Button>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-3">标题</th>
                <th className="text-left p-3 hidden sm:table-cell">类型</th>
                <th className="text-left p-3 hidden md:table-cell">创建时间</th>
                <th className="text-left p-3">状态</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {posters.map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="p-3">
                    <div className="font-medium">{p.title}</div>
                    {p.subtitle && (
                      <div className="text-xs text-muted-foreground">{p.subtitle}</div>
                    )}
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    {KINDS.find((k) => k.v === p.kind)?.label ?? p.kind}
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    {p.is_active ? (
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">启用</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs">停用</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setEditing(p); }}>✏ 编辑</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      // If linking to a PDF (e.g. WordPress 周刊), open the file directly
                      // in a new tab so the browser's native PDF viewer handles it —
                      // iframe embedding often triggers ERR_BLOCKED_BY_CLIENT or
                      // X-Frame-Options blocks.
                      const isPdfLink = !!p.link_url && /\.pdf(\?|$)/i.test(p.link_url);
                      const target = isPdfLink ? p.link_url! : `/display/poster/${p.slug || p.id}`;
                      window.open(target, "_blank", "noopener,noreferrer");
                    }}>👁 预览</Button>
                    <Button size="sm" variant="ghost" onClick={() => copyLink(p)}>🔗 链接</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p)}>🗑</Button>
                  </td>
                </tr>
              ))}
              {posters.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    暂无宣传内容，点击右上角「新建宣传内容」开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          每条宣传内容会自动生成独立访问地址：<code>/display/poster/&lt;id 或 slug&gt;</code>，可直接用于电视、iPad、投影机全屏展示。
          多屏管理请到 <Link to="/admin" className="underline">后台 → 影音播放 → 屏幕管理</Link>。
        </div>
      </div>

      {editing && (
        <PosterEditor
          poster={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PosterEditor({
  poster,
  isNew,
  onClose,
  onSaved,
}: {
  poster: Poster;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Poster>(poster);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Poster>(k: K, v: Poster[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onPickFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `posters/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("signage").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("signage").getPublicUrl(path);
      set("image_url", data.publicUrl);
      toast.success("图片已上传");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.title.trim()) return toast.error("请输入标题");
    const payload = {
      slug: draft.slug || null,
      kind: draft.kind,
      title: draft.title.trim(),
      subtitle: draft.subtitle || null,
      body: draft.body || null,
      image_url: draft.image_url || null,
      link_url: draft.link_url || null,
      background: draft.background || null,
      is_active: draft.is_active,
      sort_order: draft.sort_order,
    };
    if (isNew) {
      const { error } = await supabase.from("display_posters" as never).insert([payload as never]);
      if (error) return toast.error(error.message);
      toast.success("已创建");
    } else {
      const { error } = await supabase
        .from("display_posters" as never)
        .update(payload as never)
        .eq("id", draft.id);
      if (error) return toast.error(error.message);
      toast.success("已更新");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "新建宣传内容" : "编辑宣传内容"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>类型</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {KINDS.map((k) => (
                <button
                  key={k.v}
                  type="button"
                  onClick={() => set("kind", k.v)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    draft.kind === k.v
                      ? "bg-amber-100 border-amber-400"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>标题 *</Label>
            <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          {(draft.kind === "text" || draft.kind === "image") && (
            <div>
              <Label>副标题</Label>
              <Input
                value={draft.subtitle ?? ""}
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </div>
          )}

          {draft.kind === "text" && (
            <div>
              <Label>正文</Label>
              <Textarea
                rows={5}
                value={draft.body ?? ""}
                onChange={(e) => set("body", e.target.value)}
                placeholder="支持换行；用于聚会通知、查经、代祷、厨房通知等"
              />
            </div>
          )}

          {(draft.kind === "image" || draft.kind === "text") && (
            <div>
              <Label>图片 {draft.kind === "image" ? "*" : "（可选）"}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "上传中…" : "上传图片"}
                </Button>
                {draft.image_url && (
                  <Button type="button" variant="ghost" onClick={() => set("image_url", null)}>
                    清除
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {draft.image_url && (
                <img
                  src={draft.image_url}
                  alt=""
                  className="mt-2 max-h-40 rounded-lg border border-border"
                />
              )}
            </div>
          )}

          {draft.kind === "page" && (
            <div>
              <Label>选择网站页面</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
                value={draft.link_url ?? ""}
                onChange={(e) => set("link_url", e.target.value)}
              >
                <option value="">— 请选择 —</option>
                {SITE_PAGES.map((p) => (
                  <option key={p.path} value={p.path}>{p.label} ({p.path})</option>
                ))}
              </select>
            </div>
          )}

          {draft.kind === "external" && (
            <div>
              <Label>外部链接（网址 / PDF / YouTube）</Label>
              <Input
                value={draft.link_url ?? ""}
                onChange={(e) => set("link_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {draft.kind === "text" && (
            <div>
              <Label>底部二维码链接（可选）</Label>
              <Input
                value={draft.link_url ?? ""}
                onChange={(e) => set("link_url", e.target.value)}
                placeholder="/retreat 或 https://..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>访问标识 slug（可选）</Label>
              <Input
                value={draft.slug ?? ""}
                onChange={(e) =>
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="如：retreat-2026"
              />
            </div>
            <div>
              <Label>排序</Label>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            <Label htmlFor="active" className="cursor-pointer">启用（出现在宣传栏 / 电视投屏）</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}