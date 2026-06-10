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
  const [loadError, setLoadError] = useState(false);
  const nowLocalStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [entryDateTime, setEntryDateTime] = useState<string>(nowLocalStr());

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

  const emptyForm = () => ({
    name: "",
    name_en: "",
    district: "",
    gender: "",
    address: "",
    city: "",
    zip: "",
    phone: "",
    email: "",
    faith: "",
    faith_years: "",
    faith_other: "",
    age_group: "",
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
  const [form, setForm] = useState(emptyForm());

  const resetForContinue = () => {
    setForm(emptyForm());
    setCompanions([]);
    setEntryDateTime(nowLocalStr());
    setDone(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!eventToken) return;
    supabase
      .from("events")
      .select("id, name")
      .eq("qr_token", eventToken)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[Register] failed to load event", error);
          setLoadError(true);
          return;
        }
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
    const isBackfill = isAdmin && !eventToken && !!entryDateTime;

    const groupId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;
    const primaryId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;

    const createdAtOverride = isBackfill
      ? new Date(entryDateTime).toISOString()
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

    const genId = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;
    const companionRows = cleanCompanions.map((c) => {
      const cid = genId();
      return ({
      ...(cid ? { id: cid } : {}),
      ...(groupId ? { visitor_group_id: groupId } : {}),
      is_primary: false,
      relationship_to_primary: null,
      primary_registration_id: primaryId ?? null,
      event_id: eventId,
      name: c.name,
      gender: c.gender || null,
      age_group: c.age_group || null,
      phone: c.phone || null,
      wechat: c.wechat || null,
      faith: c.faith || null,
      faith_years: c.faith === "christian" && c.faith_years ? Number(c.faith_years) : null,
      faith_other: c.faith === "other" ? c.faith_other.trim() || null : null,
      marital_status: c.marital_status || null,
      spouse_name: c.marital_status === "married" ? c.spouse_name.trim() || null : null,
      referrer_type: c.referrer_type || form.referrer_type || null,
      invited_by:
        (c.referrer_type || form.referrer_type) === "friend"
          ? (c.invited_by.trim() || form.invited_by.trim() || null)
          : null,
      referrer_other:
        (c.referrer_type || form.referrer_type) === "other"
          ? (c.referrer_other.trim() || form.referrer_other.trim() || null)
          : null,
      source_channel: c.source_channel || form.source_channel || null,
      wants_visit: c.wants_visit,
      wants_info: c.wants_info,
      notes: c.notes.trim() || null,
      // Inherited address
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      source: eventToken ? "qr" : "manual",
      ...(createdAtOverride ? { created_at: createdAtOverride } : {}),
    });
    });

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
          {isAdmin && !eventToken ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/admin">
                <Button variant="outline" className="rounded-full w-full sm:w-auto">返回后台</Button>
              </Link>
              <Button
                className="rounded-full w-full sm:w-auto"
                onClick={resetForContinue}
              >
                继续录入
              </Button>
            </div>
          ) : (
            <Link to="/">
              <Button variant="outline" className="rounded-full">返回首页</Button>
            </Link>
          )}
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
          <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground/70 mb-2">新人资料表</p>
          <h1 className="font-serif text-4xl text-foreground">基督之家第三家</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          {isAdmin && !eventToken && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <Label className="text-sm font-medium">
                登记日期 / 补录日期
              </Label>
              <Input
                type="datetime-local"
                value={entryDateTime}
                onChange={(e) => setEntryDateTime(e.target.value || nowLocalStr())}
                className="w-full sm:w-72"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                默认为当前时间，可修改为任意历史日期/时间以补录新人资料。保存时将写入登记时间字段，后台列表与今日/本周/本月统计均按此时间计算。
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

          {/* 同行新人 */}
          <div className="pt-4 border-t border-border/50 space-y-4">
            {companions.map((c, i) => {
              const update = (patch: Partial<Companion>) => {
                const next = [...companions];
                next[i] = { ...c, ...patch };
                setCompanions(next);
              };
              return (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      同行新人 {i + 1}
                      {c.name ? <span className="text-muted-foreground"> · {c.name}</span> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompanions(companions.filter((_, idx) => idx !== i))}
                    >
                      删除
                    </Button>
                  </div>

                  <Field label="姓名">
                    <Input value={c.name} onChange={(e) => update({ name: e.target.value })} />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="性别">
                      <RadioGroup value={c.gender} onValueChange={(v) => update({ gender: v })} className="flex gap-4 pt-2">
                        {["男", "女"].map((g) => (
                          <label key={g} className="flex items-center gap-2 cursor-pointer">
                            <RadioGroupItem value={g} /> <span className="text-sm">{g}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </Field>
                    <Field label="年龄段">
                      <RadioGroup value={c.age_group} onValueChange={(v) => update({ age_group: v })} className="flex flex-wrap gap-3 pt-2">
                        {["60岁以上", "40-60岁", "20-39岁", "10-19岁", "10岁以下"].map((a) => (
                          <label key={a} className="flex items-center gap-2 cursor-pointer">
                            <RadioGroupItem value={a} /> <span className="text-sm">{a}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="电话">
                      <Input type="tel" value={c.phone} onChange={(e) => update({ phone: e.target.value })} />
                    </Field>
                    <Field label="微信">
                      <Input value={c.wechat} onChange={(e) => update({ wechat: e.target.value })} />
                    </Field>
                  </div>

                  <Field label="信仰">
                    <RadioGroup value={c.faith} onValueChange={(v) => update({ faith: v })} className="flex flex-wrap gap-4 pt-2">
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
                    {c.faith === "christian" && (
                      <div className="pt-3 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">信主</span>
                        <Input
                          type="number"
                          min={0}
                          value={c.faith_years}
                          onChange={(e) => update({ faith_years: e.target.value })}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">年</span>
                      </div>
                    )}
                    {c.faith === "other" && (
                      <Input
                        className="mt-3"
                        placeholder="请说明"
                        value={c.faith_other}
                        onChange={(e) => update({ faith_other: e.target.value })}
                      />
                    )}
                  </Field>

                  <Field label="婚姻">
                    <RadioGroup value={c.marital_status} onValueChange={(v) => update({ marital_status: v })} className="flex flex-wrap gap-4 pt-2">
                      {[
                        { v: "married", l: "已婚" },
                        { v: "single", l: "单身" },
                      ].map((o) => (
                        <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                          <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {c.marital_status === "married" && (
                      <Input
                        className="mt-3"
                        placeholder="配偶姓名"
                        value={c.spouse_name}
                        onChange={(e) => update({ spouse_name: e.target.value })}
                      />
                    )}
                  </Field>

                  <Field label="介绍人">
                    <RadioGroup value={c.referrer_type} onValueChange={(v) => update({ referrer_type: v })} className="flex flex-wrap gap-4 pt-2">
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
                    {c.referrer_type === "friend" && (
                      <Input
                        className="mt-3"
                        placeholder="亲友姓名"
                        value={c.invited_by}
                        onChange={(e) => update({ invited_by: e.target.value })}
                      />
                    )}
                    {c.referrer_type === "other" && (
                      <Input
                        className="mt-3"
                        placeholder="请说明"
                        value={c.referrer_other}
                        onChange={(e) => update({ referrer_other: e.target.value })}
                      />
                    )}
                  </Field>

                  <Field label="如何知道我们教会">
                    <RadioGroup value={c.source_channel} onValueChange={(v) => update({ source_channel: v })} className="flex flex-wrap gap-4 pt-2">
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
                      <Checkbox checked={c.wants_visit} onCheckedChange={(v) => update({ wants_visit: !!v })} />
                      <span className="text-sm">我欢迎教会牧者探访我</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox checked={c.wants_info} onCheckedChange={(v) => update({ wants_info: !!v })} />
                      <span className="text-sm">我需要教会的资料及联络</span>
                    </label>
                  </div>

                  <Field label="备注 / 代祷事项(选填)">
                    <Textarea value={c.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} />
                  </Field>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setCompanions([...companions, emptyCompanion()])}
            >
              + 继续添加一位同行新人
            </Button>
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