import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export const Route = createFileRoute("/serve-apply")({
  component: ServeApplyPage,
});

const PROJECTS = ["迎宾接待", "厨房事工", "影音播放", "儿童主日"];

function ServeApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [projects, setProjects] = useState<string[]>(PROJECTS);
  const [form, setForm] = useState({
    name: "",
    gender: "",
    phone: "",
    wechat: "",
    service_project: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("service_projects")
        .select("name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[ServeApply] failed to load service projects", error);
        setLoadError(true);
        return;
      }
      const names = (data ?? []).map((item) => item.name).filter(Boolean);
      if (names.length > 0) setProjects(names);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!form.service_project) {
      toast.error("请选择服侍项目");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("service_applications").insert({
      name: form.name.trim(),
      gender: form.gender || null,
      phone: form.phone.trim() || null,
      wechat: form.wechat.trim() || null,
      service_project: form.service_project,
      notes: form.notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("提交失败:" + error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🙏</div>
          <h1 className="font-serif text-4xl text-foreground mb-4">感谢您的服侍心志</h1>
          <p className="text-muted-foreground mb-8">
            我们已收到您的服侍申请，同工会尽快与您联系。
          </p>
          <Link to="/">
            <Button variant="outline" className="rounded-full">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center text-muted-foreground">页面加载失败，请联系管理员。</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回</Link>
        <div className="mt-4 mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">服侍申请</p>
          <h1 className="font-serif text-4xl text-foreground">教会服侍报名</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <div className="space-y-2">
            <Label className="text-sm">姓名 <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">性别</Label>
            <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex gap-4 pt-2">
              {["男", "女"].map((g) => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">电话</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">微信</Label>
              <Input value={form.wechat} onChange={(e) => setForm({ ...form, wechat: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">服侍项目 <span className="text-destructive">*</span></Label>
            <select
              value={form.service_project}
              onChange={(e) => setForm({ ...form, service_project: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">请选择服侍项目</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">备注(选填)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
            {submitting ? "提交中..." : "提交申请"}
          </Button>
        </form>
      </div>
    </div>
  );
}