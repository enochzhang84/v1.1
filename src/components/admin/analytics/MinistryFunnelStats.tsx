import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  onClick?: () => void;
}

export function MinistryFunnelStats({ className, onClick }: Props) {
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
      <div className="text-base font-semibold mt-2 text-foreground">新人跟进流程</div>
      <div className="text-xs text-muted-foreground/80 mt-auto pt-3">点击查看详情 →</div>
    </button>
  );
}
