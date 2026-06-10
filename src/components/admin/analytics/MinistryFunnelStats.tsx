import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Period = "year" | "quarter" | "month";

type Row = { created_at: string | null };

function periodRange(p: Period): { start: Date; label: string } {
  const now = new Date();
  if (p === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), label: `${now.getFullYear()}年` };
  }
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    return { start, label: `${now.getFullYear()}年 Q${q + 1}` };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` };
}

function countInRange(rows: Row[], start: Date) {
  return rows.filter((r) => r.created_at && new Date(r.created_at) >= start).length;
}

export function MinistryFunnelStats() {
  const [period, setPeriod] = useState<Period>("year");
  const [data, setData] = useState<{
    regs: Row[]; hap: Row[]; gra: Row[]; dec: Row[]; bap: Row[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [reg, hap, gra, dec, bap] = await Promise.all([
        supabase.from("registrations").select("created_at"),
        (supabase as any).from("group_join_records").select("created_at").eq("group_type", "happiness_group"),
        (supabase as any).from("group_join_records").select("created_at").eq("group_type", "grace_tea_group"),
        supabase.from("decisions").select("created_at"),
        supabase.from("baptisms").select("created_at"),
      ]);
      setData({
        regs: (reg.data ?? []) as Row[],
        hap: (hap.data ?? []) as Row[],
        gra: (gra.data ?? []) as Row[],
        dec: (dec.data ?? []) as Row[],
        bap: (bap.data ?? []) as Row[],
      });
    })();
  }, []);

  const { start, label } = useMemo(() => periodRange(period), [period]);

  const cards = useMemo(() => {
    if (!data) return null;
    return [
      { label: "新人登记", n: countInRange(data.regs, start), emoji: "📝", tint: "from-sky-500/15 to-sky-500/0", ring: "ring-sky-500/20" },
      { label: "幸福小组", n: countInRange(data.hap, start), emoji: "💗", tint: "from-pink-500/15 to-pink-500/0", ring: "ring-pink-500/20" },
      { label: "恩典茶经小组", n: countInRange(data.gra, start), emoji: "🍵", tint: "from-emerald-500/15 to-emerald-500/0", ring: "ring-emerald-500/20" },
      { label: "决志", n: countInRange(data.dec, start), emoji: "🙏", tint: "from-amber-500/15 to-amber-500/0", ring: "ring-amber-500/20" },
      { label: "受洗", n: countInRange(data.bap, start), emoji: "💧", tint: "from-blue-500/15 to-blue-500/0", ring: "ring-blue-500/20" },
    ];
  }, [data, start]);

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-lg">牧养漏斗</h3>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="inline-flex rounded-full border border-border/60 p-0.5 text-xs">
          {([
            ["year", "年度"],
            ["quarter", "季度"],
            ["month", "月度"],
          ] as Array<[Period, string]>).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-3 py-1 rounded-full transition ${period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {!cards ? (
        <div className="text-xs text-muted-foreground p-2">加载中…</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cards.slice(0, 3).map((c) => <FunnelCard key={c.label} {...c} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.slice(3).map((c) => <FunnelCard key={c.label} {...c} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function FunnelCard({ label, n, emoji, tint, ring }: { label: string; n: number; emoji: string; tint: string; ring: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${tint} p-5 ring-1 ${ring} backdrop-blur-sm shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xl leading-none">{emoji}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{n}</span>
        <span className="text-sm text-muted-foreground">人</span>
      </div>
    </div>
  );
}
