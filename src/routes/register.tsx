import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const searchSchema = z.object({ event: z.string().optional() });

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  component: RegisterPage,
});

function RegisterPage() {
  const { event: eventToken } = Route.useSearch();
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const todayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [entryDate, setEntryDate] = useState<string>(todayStr());

  type Companion = {
    name: string;
    gender: string;
    age_group: string;
    phone: string;
    wechat: string;
    faith: string;
    faith_years: string;
    faith_other: string;
    marital_status: string;
    spouse_name: string;
    referrer_type: string;
    invited_by: string;
    referrer_other: string;
    source_channel: string;
    wants_visit: boolean;
    wants_info: boolean;
    notes: string;
  };
  const emptyCompanion = (): Companion => ({
    name: "",
    gender: "",
    age_group: "",
    phone: "",
    wechat: "",
    faith: "",
    faith_years: "",
    faith_other: "",
    marital_status: "",
    spouse_name: "",
    referrer_type: "",
    invited_by: "",
    referrer_other: "",
    source_channel: "",
    wants_visit: false,
    wants_info: false,
    notes: "",
  });
  const [companions, setCompanions] = useState<Companion[]>([]);

  const [form, setForm] = useState({
    name: "",
    name_en: "",
    district: "",
    gender: "",
    address: "",
    city: "",
    zip: "",
    phone: "",
    email: "",
    faith: "", // christian | seeker | other
    faith_years: "",
    faith_other: "",
    age_group: "",
    marital_status: "", // married | single
    spouse_name: "",
    referrer_type: "", // self | friend | other
    invited_by: "",
    referrer_other: "",
    source_channel: "", // chatgpt | maps | wechat | youtube | missionary
    wants_visit: false,
    wants_info: false,
    notes: "",
  });

  useEffect(() => {
    if (!eventToken) return;
    supabase
      .from("events")
      .select("id, name")
      .eq("qr_token", eventToken)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEventId(data.id);
          setEventName(data.name);
        }
      });
  }, [eventToken]);

  // Detect admin/super_admin so manual backfill UI only shows for them
  useEffect(() => {
    if (eventToken) return; // QR mode never shows admin UI
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!active) return;
      const has = (roles ?? []).some(
        (r: { role: string }) => r.role === "admin" || r.role === "super_admin",
      );
      setIsAdmin(has);
    })();
    return () => {
      active = false;
    };
  }, [eventToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请填写中文姓名");
      return;
    }
    // Validate companions
    const cleanCompanions = companions
      .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim(), wechat: c.wechat.trim() }))
      .filter((c) => c.name);
    setSubmitting(true);
    const isBackfill =
      isAdmin && !eventToken && entryDate && entryDate !== todayStr();

    const groupId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;
    const primaryId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;

    const createdAtOverride = isBackfill
      ? new Date(`${entryDate}T12:00:00`).toISOString()
      : undefined;

    const primary: Record<string, unknown> = {
      ...(primaryId ? { id: primaryId } : {}),
      ...(groupId ? { visitor_group_id: groupId } : {}),
      is_primary: true,
      relationship_to_primary: null,
      primary_registration_id: null,
      event_id: eventId,
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      district: form.district.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      wechat: null,
      gender: form.gender || null,
      age_group: form.age_group || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      faith: form.faith || null,
      faith_years: form.faith === "christian" && form.faith_years ? Number(form.faith_years) : null,
      faith_other: form.faith === "other" ? form.faith_other.trim() || null : null,
      marital_status: form.marital_status || null,
      spouse_name: form.marital_status === "married" ? form.spouse_name.trim() || null : null,
      referrer_type: form.referrer_type || null,
      invited_by: form.referrer_type === "friend" ? form.invited_by.trim() || null : null,
      referrer_other: form.referrer_type === "other" ? form.referrer_other.trim() || null : null,
      source_channel: form.source_channel || null,
      wants_visit: form.wants_visit,
      wants_info: form.wants_info,
      notes: form.notes.trim() || null,
      source: eventToken ? "qr" : "manual",
      ...(createdAtOverride ? { created_at: createdAtOverride } : {}),
    };

    const companionRows = cleanCompanions.map((c) => ({
      ...(groupId ? { visitor_group_id: groupId } : {}),
      is_primary: false,
      relationship_to_primary: c.relationship_to_primary,
      primary_registration_id: primaryId ?? null,
      event_id: eventId,
      name: c.name,
      gender: c.gender || null,
      age_group: c.age_group || null,
      phone: c.phone || null,
      wechat: c.wechat || null,
      // Inherited fields
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      source_channel: form.source_channel || null,
      referrer_type: form.referrer_type || null,
      invited_by: form.referrer_type === "friend" ? form.invited_by.trim() || null : null,
      referrer_other: form.referrer_type === "other" ? form.referrer_other.trim() || null : null,
      source: eventToken ? "qr" : "manual",
      ...(createdAtOverride ? { created_at: createdAtOverride } : {}),
    }));

    const rows = [primary, ...companionRows];

    const insertQuery = supabase.from("registrations").insert(rows as never);
    const { data, error } = isAdmin
      ? await insertQuery.select()
      : await insertQuery;
    setSubmitting(false);

    if (error) {
      const parts = [
        `message: ${error.message}`,
        error.code ? `code: ${error.code}` : "",
        error.details ? `details: ${error.details}` : "",
        error.hint ? `hint: ${error.hint}` : "",
      ].filter(Boolean).join(" | ");
      toast.error(`提交失败 — ${parts}`, { duration: 12000 });
      return;
    }
    if (isAdmin && (!data || data.length === 0)) {
      toast.error("提交未返回数据，可能被RLS策略拦截。请检查登录状态。", { duration: 12000 });
      return;
    }
    const totalCount = 1 + cleanCompanions.length;
    toast.success(
      cleanCompanions.length > 0
        ? `登记成功，已记录你和 ${cleanCompanions.length} 位同行成员的信息`
        : "登记成功",
    );
    console.log("[Register] inserted", totalCount, "rows, groupId:", groupId);
    setDone(true);
  }

  if (done) {
    const verses = [
      { text: "凡劳苦担重担的人,可以到我这里来,我就使你们得安息。", ref: "马太福音 11:28" },
      { text: "耶和华是我的牧者,我必不至缺乏。", ref: "诗篇 23:1" },
      { text: "你们要尝尝主恩的滋味,便知道他是美善。", ref: "诗篇 34:8" },
      { text: "我留下平安给你们,我将我的平安赐给你们。", ref: "约翰福音 14:27" },
      { text: "应当一无挂虑,只要凡事借着祷告、祈求和感谢,将你们所要的告诉神。", ref: "腓立比书 4:6" },
      { text: "神所赐出人意外的平安,必在基督耶稣里保守你们的心怀意念。", ref: "腓立比书 4:7" },
      { text: "你们祈求,就给你们;寻找,就寻见;叩门,就给你们开门。", ref: "马太福音 7:7" },
      { text: "因为神爱世人,甚至将他的独生子赐给他们,叫一切信他的,不至灭亡,反得永生。", ref: "约翰福音 3:16" },
    ];
    const verse = verses[Math.floor(Math.random() * verses.length)];

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🕊️</div>
          <h1 className="font-serif text-4xl text-foreground mb-4">愿主祝福您</h1>
          <p className="text-muted-foreground mb-6">
            {companions.filter((c) => c.name.trim()).length > 0
              ? "登记成功，已记录你和同行成员的信息。欢迎来到基督之家第三家！"
              : "谢谢您完成登记。我们的同工会很快与您联系,期待再次见到您。"}
          </p>
          <div className="mx-auto max-w-sm text-left mb-8">
            <p className="font-serif text-lg text-foreground leading-relaxed">
              "{verse.text}"
            </p>
            <p className="text-sm text-muted-foreground mt-2">— {verse.ref}</p>
          </div>
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
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">新人资料表</p>
          <h1 className="font-serif text-4xl text-foreground">基督之家第三家</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          {isAdmin && !eventToken && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <Label className="text-sm font-medium">
                登记日期（管理员补录）
              </Label>
              <Input
                type="date"
                value={entryDate}
                max={todayStr()}
                onChange={(e) => setEntryDate(e.target.value || todayStr())}
                className="w-full sm:w-56"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                默认为今天，可修改为历史日期以补录当天遗漏的登记。仅超级管理员 / 管理员可见，数据将与扫码登记统一进入统计。
              </p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="姓名(中文)">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="姓名(英文)">
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="性别">
              <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex gap-4 pt-2">
                {["男", "女"].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Field label="年龄段">
              <RadioGroup value={form.age_group} onValueChange={(v) => setForm({ ...form, age_group: v })} className="flex flex-wrap gap-3 pt-2">
                {["60岁以上", "40-60岁", "20-39岁"].map((a) => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value={a} /> <span className="text-sm">{a}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
          </div>

          <Field label="地址">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="城市">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
            <Field label="邮编">
              <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <Label className="text-sm">电话</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <p className="text-xs text-muted-foreground leading-relaxed break-words">
                提交后，您同意接收来自 HOC3 的短信或电话联系，用于新人登记确认、聚会通知及相关事工沟通。Message & data rates may apply.
              </p>
            </div>
            <Field label="电邮地址">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>

          <Field label="信仰">
            <RadioGroup value={form.faith} onValueChange={(v) => setForm({ ...form, faith: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "christian", l: "基督徒" },
                { v: "seeker", l: "慕道友" },
                { v: "other", l: "其他" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.faith === "christian" && (
              <div className="pt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">信主</span>
                <Input
                  type="number"
                  min={0}
                  value={form.faith_years}
                  onChange={(e) => setForm({ ...form, faith_years: e.target.value })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">年</span>
              </div>
            )}
            {form.faith === "other" && (
              <Input
                className="mt-3"
                placeholder="请说明"
                value={form.faith_other}
                onChange={(e) => setForm({ ...form, faith_other: e.target.value })}
              />
            )}
          </Field>

          <Field label="婚姻">
            <RadioGroup value={form.marital_status} onValueChange={(v) => setForm({ ...form, marital_status: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "married", l: "已婚" },
                { v: "single", l: "单身" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.marital_status === "married" && (
              <Input
                className="mt-3"
                placeholder="配偶姓名"
                value={form.spouse_name}
                onChange={(e) => setForm({ ...form, spouse_name: e.target.value })}
              />
            )}
          </Field>

          <Field label="介绍人">
            <RadioGroup value={form.referrer_type} onValueChange={(v) => setForm({ ...form, referrer_type: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "self", l: "自己" },
                { v: "friend", l: "亲友" },
                { v: "other", l: "其他" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
            {form.referrer_type === "friend" && (
              <Input
                className="mt-3"
                placeholder="亲友姓名"
                value={form.invited_by}
                onChange={(e) => setForm({ ...form, invited_by: e.target.value })}
              />
            )}
            {form.referrer_type === "other" && (
              <Input
                className="mt-3"
                placeholder="请说明"
                value={form.referrer_other}
                onChange={(e) => setForm({ ...form, referrer_other: e.target.value })}
              />
            )}
          </Field>

          <Field label="如何知道我们教会">
            <RadioGroup value={form.source_channel} onValueChange={(v) => setForm({ ...form, source_channel: v })} className="flex flex-wrap gap-4 pt-2">
              {[
                { v: "chatgpt", l: "ChatGPT" },
                { v: "maps", l: "谷歌/苹果地图" },
                { v: "wechat", l: "微信/小红书" },
                { v: "youtube", l: "YouTube" },
                { v: "missionary", l: "宣教士" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>

          <div className="space-y-3 pt-2 border-t border-border/50">
            <label className="flex items-center gap-3 cursor-pointer pt-3">
              <Checkbox checked={form.wants_visit} onCheckedChange={(v) => setForm({ ...form, wants_visit: !!v })} />
              <span className="text-sm">我欢迎教会牧者探访我</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={form.wants_info} onCheckedChange={(v) => setForm({ ...form, wants_info: !!v })} />
              <span className="text-sm">我需要教会的资料及联络</span>
            </label>
          </div>

          <Field label="备注 / 代祷事项(选填)">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </Field>

          {/* 同行成员 */}
          <div className="pt-4 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">同行成员（选填）</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  和您一起来的家人 / 朋友，可一次登记，无需重复扫码
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCompanions([...companions, emptyCompanion()])}
              >
                + 添加同行成员
              </Button>
            </div>

            {companions.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    成员 {i + 1}
                    {c.name ? <span className="text-muted-foreground"> · {c.name}</span> : null}
                    {c.relationship_to_primary ? (
                      <span className="text-muted-foreground"> · {c.relationship_to_primary}</span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCompanions(companions.filter((_, idx) => idx !== i))
                    }
                  >
                    删除
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">姓名</Label>
                    <Input
                      value={c.name}
                      onChange={(e) => {
                        const next = [...companions];
                        next[i] = { ...c, name: e.target.value };
                        setCompanions(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">与主要登记人的关系</Label>
                    <select
                      value={c.relationship_to_primary}
                      onChange={(e) => {
                        const next = [...companions];
                        next[i] = { ...c, relationship_to_primary: e.target.value };
                        setCompanions(next);
                      }}
                      className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">请选择关系</option>
                      {["配偶", "子女", "父母", "亲戚", "朋友", "同学", "同事", "其他"].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">性别</Label>
                    <RadioGroup
                      value={c.gender}
                      onValueChange={(v) => {
                        const next = [...companions];
                        next[i] = { ...c, gender: v };
                        setCompanions(next);
                      }}
                      className="flex gap-4 pt-1"
                    >
                      {["男", "女"].map((g) => (
                        <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">年龄段</Label>
                    <select
                      value={c.age_group}
                      onChange={(e) => {
                        const next = [...companions];
                        next[i] = { ...c, age_group: e.target.value };
                        setCompanions(next);
                      }}
                      className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">请选择</option>
                      {["60岁以上", "40-60岁", "20-39岁", "10-19岁", "10岁以下"].map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">电话（选填）</Label>
                    <Input
                      type="tel"
                      value={c.phone}
                      onChange={(e) => {
                        const next = [...companions];
                        next[i] = { ...c, phone: e.target.value };
                        setCompanions(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">微信（选填）</Label>
                    <Input
                      value={c.wechat}
                      onChange={(e) => {
                        const next = [...companions];
                        next[i] = { ...c, wechat: e.target.value };
                        setCompanions(next);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-full">
            {submitting
              ? "提交中..."
              : companions.length > 0
              ? `提交登记（共 ${1 + companions.filter((c) => c.name.trim()).length} 人）`
              : "提交登记"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}