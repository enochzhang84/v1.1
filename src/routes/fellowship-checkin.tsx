import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/fellowship-checkin")({
  component: FellowshipCheckinPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BiLabel({ cn, en, required }: { cn: string; en: string; required?: boolean }) {
  return (
    <Label className="flex flex-col items-start gap-0.5">
      <span>
        {cn} {required && <span className="text-destructive">*</span>}
      </span>
      <span className="text-xs font-normal text-muted-foreground">{en}</span>
    </Label>
  );
}

function FellowshipCheckinPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [fellowships, setFellowships] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({
    checkin_date: todayISO(),
    name: "",
    contact: "",
    email: "",
    fellowship: "",
    prayer_request: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("fellowships")
        .select("name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[FellowshipCheckin] failed to load fellowships", error);
        setLoadError(true);
        return;
      }
      setFellowships((data ?? []).map((d) => d.name));
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写姓名 / Please enter your name");
      return;
    }
    if (!form.fellowship) {
      toast.error("请选择团契 / Please select a fellowship");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("fellowship_checkins").insert({
      checkin_date: form.checkin_date,
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      email: form.email.trim() || null,
      fellowship: form.fellowship,
      prayer_request: form.prayer_request.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("提交失败 / Submit failed: " + error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🙏</div>
          <h1 className="font-serif text-4xl text-foreground mb-2">签到成功</h1>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">CHECK-IN SUCCESSFUL</p>
          <p className="text-muted-foreground mb-8">愿主祝福你的团契聚会。<br/><span className="text-xs">May God bless your fellowship gathering.</span></p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setDone(false);
                setForm({
                  checkin_date: todayISO(),
                  name: "",
                  contact: "",
                  email: "",
                  fellowship: "",
                  prayer_request: "",
                });
              }}
            >
              再签到一位 / Check in another
            </Button>
            <Link to="/">
              <Button className="rounded-full">返回首页 / Home</Button>
            </Link>
          </div>
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
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回 / Back</Link>
        <div className="mt-4 mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">FELLOWSHIP</p>
          <h1 className="font-serif text-4xl text-foreground">团契 / 小组聚会签到</h1>
          <p className="text-base text-muted-foreground mt-1">Fellowship / Small Group Check-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border/50 rounded-2xl p-6">
          <div className="space-y-2">
            <BiLabel cn="日期" en="Date" />
            <Input
              type="date"
              value={form.checkin_date}
              onChange={(e) => setForm({ ...form, checkin_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <BiLabel cn="姓名" en="Name" required />
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入姓名 / Your name"
            />
          </div>
          <div className="space-y-2">
            <BiLabel cn="电话 / 微信" en="Phone / WeChat" />
            <Input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="电话号码或微信号 / Phone or WeChat ID"
            />
          </div>
          <div className="space-y-2">
            <BiLabel cn="邮件" en="Email" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <BiLabel cn="团契" en="Fellowship" required />
            <select
              value={form.fellowship}
              onChange={(e) => setForm({ ...form, fellowship: e.target.value })}
              className="w-full h-9 bg-background border border-input rounded-md px-3 text-sm"
            >
              <option value="">-- 请选择 / Please select --</option>
              {fellowships.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <BiLabel cn="备注" en="Notes" />
            <Textarea
              value={form.prayer_request}
              onChange={(e) => setForm({ ...form, prayer_request: e.target.value })}
              placeholder="需要代祷请留下你的话语 / If you need prayer, please leave your words"
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={submitting}>
            {submitting ? "提交中... / Submitting..." : "提交签到 / Submit Check-in"}
          </Button>
        </form>
      </div>
    </div>
  );
}