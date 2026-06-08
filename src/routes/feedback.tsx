import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    fellowship: "",
    title: "",
    description: "",
  });

  const nowStr = new Date().toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} 超过 5MB，已跳过`);
        continue;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("feedback-images").upload(path, file);
      if (error) {
        toast.error("图片上传失败: " + error.message);
        continue;
      }
      const { data } = supabase.storage.from("feedback-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = "";
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  function reset() {
    setForm({ name: "", contact: "", fellowship: "", title: "", description: "" });
    setImages([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("请填写姓名");
    if (!form.contact.trim()) return toast.error("请填写联系方式");
    if (!form.title.trim()) return toast.error("请填写问题标题");
    setSubmitting(true);
    const { error } = await supabase.from("feedbacks").insert({
      name: form.name.trim(),
      contact: form.contact.trim(),
      fellowship: form.fellowship.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      images,
    });
    setSubmitting(false);
    if (error) {
      toast.error("提交失败: " + error.message);
      return;
    }
    toast.success("反馈已提交，感谢您的反馈");
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🙏</div>
          <h1 className="font-serif text-4xl text-foreground mb-4">感谢您的反馈</h1>
          <p className="text-muted-foreground mb-8">我们已收到您的问题反馈，会尽快处理。</p>
          <Link to="/">
            <Button variant="outline" className="rounded-full">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回</Link>
        <div className="mt-4 mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">问题反馈</p>
          <h1 className="font-serif text-4xl text-foreground">问题反馈</h1>
          <p className="text-xs text-muted-foreground mt-2">时间：{nowStr}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">姓名 <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">联系方式 <span className="text-destructive">*</span></Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="电话 / 微信 / 邮箱" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">团契</Label>
            <Input value={form.fellowship} onChange={(e) => setForm({ ...form, fellowship: e.target.value })} placeholder="所属团契 (选填)" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">标题 <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="请输入你要反馈的问题"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">问题描述</Label>
            <Textarea
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="详细描述您遇到的问题..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">上传照片 (可选)</Label>
            <Input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} />
            {uploading && <p className="text-xs text-muted-foreground">上传中...</p>}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {images.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="w-full h-24 object-cover rounded-md border" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || uploading} className="flex-1 rounded-full">
              {submitting ? "提交中..." : "确认"}
            </Button>
            <Button type="button" variant="outline" onClick={reset} className="flex-1 rounded-full">
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}