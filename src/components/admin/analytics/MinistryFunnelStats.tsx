import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Counts = {
  reg: number;
  hap: number;
  gra: number;
  dec: number;
  bap: number;
};

interface Props {
  className?: string;
  onClick?: () => void;
}

export function MinistryFunnelStats({ className, onClick }: Props) {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    (async () => {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const [reg, hap, gra, dec, bap] = await Promise.all([
        supabase.from("registrations").select("id", { count: "exact", head: true }).gte("created_at", yearStart),
        (supabase as any).from("group_join_records").select("id", { count: "exact", head: true }).eq("group_type", "happiness_group").gte("created_at", yearStart),
        (supabase as any).from("group_join_records").select("id", { count: "exact", head: true }).eq("group_type", "grace_tea_group").gte("created_at", yearStart),
        supabase.from("decisions").select("id", { count: "exact", head: true }).gte("created_at", yearStart),
        supabase.from("baptisms").select("id", { count: "exact", head: true }).gte("created_at", yearStart),
      ]);
      setC({
        reg: reg.count ?? 0,
        hap: hap.count ?? 0,
        gra: gra.count ?? 0,
        dec: dec.count ?? 0,
        bap: bap.count ?? 0,
      });
    })();
  }, []);

  const steps: Array<[string, number]> = c
    ? [
        ["新人", c.reg],
        ["幸福", c.hap],
        ["茶经", c.gra],
        ["决志", c.dec],
        ["受洗", c.bap],
      ]
    : [];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left bg-card border border-border/60 rounded-2xl p-5 h-full flex flex-col transition-all shadow-sm border-t-4 border-t-sky-400",
        onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default",
        className,
      )}
    >
      <div className="text-xl leading-none">📊</div>
      <div className="text-sm text-muted-foreground mt-2">牧养漏斗</div>
      {!c ? (
        <div className="mt-2 text-xs text-muted-foreground">加载中…</div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sky-600">
          {steps.map(([label, n], i) => (
            <span key={label} className="flex items-center gap-1">
              <span className="inline-flex flex-col items-center leading-tight">
                <span className="text-base font-bold tabular-nums">{n}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </span>
              {i < steps.length - 1 && <span className="text-muted-foreground/60 text-xs">→</span>}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground/80 mt-2">{new Date().getFullYear()} 年累计</div>
    </button>
  );
}
