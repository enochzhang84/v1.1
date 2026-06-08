import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/sunday-checkin")({
  component: SundayCheckinPage,
});

type Course = { id: string; name: string };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function SundayCheckinPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({
    checkin_date: todayISO(),
    name: "",
    contact: "",
    email: "",
    course_id: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("sunday_school_courses")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("[SundayCheckin] failed to load courses", error);
        setLoadError(true);
        return;
      }
      setCourses((data as Course[]) ?? []);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!form.course_id) {
      toast.error("请选择参加课程");
      return;
    }
    const course = courses.find((c) => c.id === form.course_id);
    setSubmitting(true);
    const { error } = await supabase.from("sunday_school_checkins").insert({
      checkin_date: form.checkin_date,
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      email: form.email.trim() || null,
      course_id: form.course_id,
      course_name: course?.name ?? null,
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
          <div className="text-6xl mb-6">📖</div>
          <h1 className="font-serif text-4xl text-foreground mb-2">签到成功</h1>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">CHECK-IN SUCCESSFUL</p>
          <p className="text-muted-foreground mb-8">愿主的话语在你心中扎根丰盛。<br/><span className="text-xs">May God's word take deep root in your heart.</span></p>
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
                  course_id: "",
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
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">SUNDAY SCHOOL</p>
          <h1 className="font-serif text-4xl text-foreground">成人主日学签到</h1>
          <p className="text-base text-muted-foreground mt-1">Adult Sunday School Check-in</p>
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
            <BiLabel cn="参加课程" en="Course" required />
            <select
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              className="w-full h-9 bg-background border border-input rounded-md px-3 text-sm"
            >
              <option value="">-- 请选择 / Please select --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {courses.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无可选课程，请联系管理员 / No courses available, please contact admin</p>
            )}
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={submitting}>
            {submitting ? "提交中... / Submitting..." : "提交签到 / Submit Check-in"}
          </Button>
        </form>
      </div>
    </div>
  );
}