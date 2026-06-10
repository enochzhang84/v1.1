import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Counts = {
  today: number;
  week: number;
  month: number;
  happiness: number;
  graceTea: number;
  baptismClass: number;
  decision: number;
  baptism: number;
  notInterested: number;
  followUp: number;
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek() {
  const x = startOfDay();
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}
function startOfMonth() {
  const x = startOfDay();
  x.setDate(1);
  return x;
}

export function MinistryFunnelDetail() {
  const [c, setC] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = startOfDay().toISOString();
      const week = startOfWeek().toISOString();
      const month = startOfMonth().toISOString();

      const countReg = async (since?: string) => {
        let q = supabase.from("registrations").select("id", { count: "exact", head: true });
        if (since) q = q.gte("created_at", since);
        const { count } = await q;
        return count ?? 0;
      };
      const countTransfer = async (target: string) => {
        const { count } = await supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("transfer_target", target);
        return count ?? 0;
      };
      const countBap = async () => {
        const { count } = await supabase.from("baptisms").select("id", { count: "exact", head: true });
        return count ?? 0;
      };

      const [tdy, wk, mo, hap, gra, bcl, dec, bap, ni, fu] = await Promise.all([
        countReg(today),
        countReg(week),
        countReg(month),
        countTransfer("happiness_group"),
        countTransfer("grace_tea_group"),
        countTransfer("baptism_class"),
        countTransfer("decision_record"),
        countBap(),
        countTransfer("not_interested"),
        countTransfer("follow_up"),
      ]);

      setC({
        today: tdy, week: wk, month: mo,
        happiness: hap, graceTea: gra, baptismClass: bcl,
        decision: dec, baptism: bap,
        notInterested: ni, followUp: fu,
      });
      setLoading(false);
    })();
  }, []);

  const cards: Array<{ icon: string; label: string; value: number; tone: string }> = c ? [
    { icon: "📅", label: "今日新人", value: c.today, tone: "from-sky-50 to-sky-100/40 text-sky-700 dark:from-sky-950/40 dark:to-sky-900/20 dark:text-sky-300" },
    { icon: "🗓", label: "本周新人", value: c.week, tone: "from-blue-50 to-blue-100/40 text-blue-700 dark:from-blue-950/40 dark:to-blue-900/20 dark:text-blue-300" },
    { icon: "📆", label: "本月新人", value: c.month, tone: "from-indigo-50 to-indigo-100/40 text-indigo-700 dark:from-indigo-950/40 dark:to-indigo-900/20 dark:text-indigo-300" },
    { icon: "🤝", label: "幸福小组", value: c.happiness, tone: "from-rose-50 to-rose-100/40 text-rose-700 dark:from-rose-950/40 dark:to-rose-900/20 dark:text-rose-300" },
    { icon: "🍵", label: "恩典茶经小组", value: c.graceTea, tone: "from-emerald-50 to-emerald-100/40 text-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:text-emerald-300" },
    { icon: "📖", label: "受洗班", value: c.baptismClass, tone: "from-amber-50 to-amber-100/40 text-amber-700 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-300" },
    { icon: "🙏", label: "决志人数", value: c.decision, tone: "from-violet-50 to-violet-100/40 text-violet-700 dark:from-violet-950/40 dark:to-violet-900/20 dark:text-violet-300" },
    { icon: "💧", label: "受洗人数", value: c.baptism, tone: "from-cyan-50 to-cyan-100/40 text-cyan-700 dark:from-cyan-950/40 dark:to-cyan-900/20 dark:text-cyan-300" },
    { icon: "🚫", label: "不感兴趣", value: c.notInterested, tone: "from-slate-50 to-slate-100/40 text-slate-700 dark:from-slate-900/40 dark:to-slate-900/20 dark:text-slate-300" },
    { icon: "🔁", label: "持续跟进", value: c.followUp, tone: "from-orange-50 to-orange-100/40 text-orange-700 dark:from-orange-950/40 dark:to-orange-900/20 dark:text-orange-300" },
  ] : [];

  return (
    <section className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl">📊 牧养漏斗</h2>
          <p className="text-sm text-muted-foreground mt-1">新人跟进流程统计（按登记名单"转项"字段）</p>
        </div>
      </div>

      {loading && !c && (
        <div className="text-sm text-muted-foreground py-8 text-center">加载中…</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              "rounded-2xl border border-border/60 p-5 bg-gradient-to-br shadow-sm",
              card.tone,
            )}
          >
            <div className="text-2xl leading-none">{card.icon}</div>
            <div className="text-xs text-muted-foreground mt-3">{card.label}</div>
            <div className="text-3xl font-bold mt-1 tabular-nums tracking-tight">{card.value}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/80">
        提示：第 4–10 项按「新人登记 → 转项」字段实时统计；受洗人数来自年度受洗记录。
      </p>
    </section>
  );
}
