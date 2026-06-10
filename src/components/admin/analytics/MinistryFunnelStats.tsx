import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Counts = {
  registrations: number;
  happiness: number;
  graceTea: number;
  decisions: number;
  baptisms: number;
  service: number;
};

export function MinistryFunnelStats() {
  const [c, setC] = useState<Counts | null>(null);
  useEffect(() => {
    (async () => {
      const [reg, hap, gra, dec, bap, ser] = await Promise.all([
        supabase.from("registrations").select("id", { count: "exact", head: true }),
        (supabase as any).from("group_join_records").select("id", { count: "exact", head: true }).eq("group_type", "happiness_group"),
        (supabase as any).from("group_join_records").select("id", { count: "exact", head: true }).eq("group_type", "grace_tea_group"),
        supabase.from("decisions").select("id", { count: "exact", head: true }),
        supabase.from("baptisms").select("id", { count: "exact", head: true }),
        supabase.from("service_applications").select("id", { count: "exact", head: true }),
      ]);
      setC({
        registrations: reg.count ?? 0,
        happiness: hap.count ?? 0,
        graceTea: gra.count ?? 0,
        decisions: dec.count ?? 0,
        baptisms: bap.count ?? 0,
        service: ser.count ?? 0,
      });
    })();
  }, []);
  if (!c) return <div className="text-xs text-muted-foreground p-3">加载漏斗…</div>;
  const steps = [
    { label: "新人登记", n: c.registrations, emoji: "📝", color: "from-sky-500/20 to-sky-500/5" },
    { label: "幸福小组", n: c.happiness, emoji: "💗", color: "from-pink-500/20 to-pink-500/5" },
    { label: "恩典茶经小组", n: c.graceTea, emoji: "🍵", color: "from-emerald-500/20 to-emerald-500/5" },
    { label: "决志", n: c.decisions, emoji: "🙏", color: "from-amber-500/20 to-amber-500/5" },
    { label: "受洗", n: c.baptisms, emoji: "💧", color: "from-blue-500/20 to-blue-500/5" },
    { label: "加入服事", n: c.service, emoji: "🤝", color: "from-violet-500/20 to-violet-500/5" },
  ];
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg">牧养漏斗</h3>
        <span className="text-xs text-muted-foreground">从新人登记到加入服事</span>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const pct = (s.n / max) * 100;
          const prev = i > 0 ? steps[i - 1].n : 0;
          const conv = i > 0 && prev > 0 ? Math.round((s.n / prev) * 100) : null;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-28 text-sm text-muted-foreground shrink-0">
                <span className="mr-1">{s.emoji}</span>{s.label}
              </div>
              <div className="flex-1 h-9 rounded-md bg-muted/30 overflow-hidden relative">
                <div className={`h-full bg-gradient-to-r ${s.color}`} style={{ width: `${pct}%` }} />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-sm">
                  <span className="font-medium">{s.n}</span>
                  {conv !== null && <span className="text-xs text-muted-foreground">转化 {conv}%</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
