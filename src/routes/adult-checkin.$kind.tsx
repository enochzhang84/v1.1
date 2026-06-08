import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/adult-checkin/$kind")({
  component: AdultCheckinPage,
});

type Fellowship = { id: string; name: string };

function AdultCheckinPage() {
  const { kind } = useParams({ from: "/adult-checkin/$kind" });
  const isSummer = kind === "summer";
  const titleCn = isSummer ? "暑期成人主日学签到" : "秋季成人主日学签到";
  const titleEn = isSummer ? "Summer Adult Sunday School Check-in" : "Fall Adult Sunday School Check-in";

  const [now, setNow] = useState(new Date());
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [name, setName] = useState("");
  const [fellowship, setFellowship] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("fellowships")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[AdultCheckin] failed to load fellowships", error);
        setLoadError(true);
        return;
      }
      setFellowships((data as Fellowship[]) ?? []);
    })();
  }, []);

  if (kind !== "summer" && kind !== "fall") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        未知签到类型 / Unknown check-in type
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("请填写姓名 / Please enter your name");
    setSubmitting(true);
    const { error } = await (supabase as any).from("adult_class_checkins").insert({
      kind,
      name: name.trim(),
      fellowship: fellowship.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error("提交失败:" + error.message);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="font-serif text-4xl text-foreground mb-2">签到成功</h1>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-6">CHECK-IN SUCCESSFUL</p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => { setDone(false); setName(""); setFellowship(""); setNotes(""); }}
            >
              再签到一位 / Check in another
            </Button>
            <Link to="/"><Button className="rounded-full">返回首页 / Home</Button></Link>
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
        <div className="mt-4 mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">SUNDAY SCHOOL</p>
          <h1 className="font-serif text-4xl text-foreground">{titleCn}</h1>
          <p className="text-base text-muted-foreground mt-1">{titleEn}</p>
        </div>

        <div className="bg-muted/40 border border-border/50 rounded-xl px-4 py-3 mb-5 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">当前时间 / Now</span>
          <span className="font-mono text-base font-medium">
            {now.toLocaleString("zh-CN", { hour12: false })}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border/50 rounded-2xl p-6">
          <div className="space-y-2">
            <Label>姓名 / Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名 / Your name" />
          </div>
          <div className="space-y-2">
            <Label>团契 / Fellowship</Label>
            {fellowships.length > 0 ? (
              <select
                value={fellowship}
                onChange={(e) => setFellowship(e.target.value)}
                className="w-full h-9 bg-background border border-input rounded-md px-3 text-sm"
              >
                <option value="">-- 请选择 / Please select --</option>
                {fellowships.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
                <option value="其他 / Other">其他 / Other</option>
              </select>
            ) : (
              <Input value={fellowship} onChange={(e) => setFellowship(e.target.value)} placeholder="所属团契 / Your fellowship" />
            )}
          </div>
          <div className="space-y-2">
            <Label>备注 / Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="备注 / Optional notes" rows={3} />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={submitting}>
            {submitting ? "提交中... / Submitting..." : "提交签到 / Submit Check-in"}
          </Button>
        </form>
      </div>
    </div>
  );
}