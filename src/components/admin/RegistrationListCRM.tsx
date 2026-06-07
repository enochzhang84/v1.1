import { useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CalendarIcon,
  Eye,
  Pencil,
  Trash2,
  LayoutList,
  Rows3,
  Phone,
  Mail,
  MapPin,
  Heart,
  Users,
  Tag as TagIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  district: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  age_group: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  faith: string | null;
  faith_years: number | null;
  faith_other: string | null;
  faith_stage: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  source_channel: string | null;
  wants_visit: boolean | null;
  wants_info: boolean | null;
  notes: string | null;
  source: string;
  created_at: string;
  follow_up_person: string | null;
  visitor_group_id: string | null;
  is_primary: boolean | null;
  relationship_to_primary: string | null;
  primary_registration_id: string | null;
  wechat: string | null;
};

function formatReferrer(r: Pick<Reg, "referrer_type" | "invited_by" | "referrer_other">): string {
  switch (r.referrer_type) {
    case "self": return "自己";
    case "friend": return `亲友推荐`;
    case "other": return r.referrer_other || "其他";
    default: return "";
  }
}

function formatSourceChannel(r: Pick<Reg, "source_channel">): string {
  switch (r.source_channel) {
    case "chatgpt": return "ChatGPT";
    case "maps": return "地图";
    case "wechat": return "微信/小红书";
    case "youtube": return "YouTube";
    case "missionary": return "宣教士";
    default: return "";
  }
}

function initials(r: Reg): string {
  if (r.name_en) {
    const parts = r.name_en.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (r.name) return r.name.trim().slice(0, 1);
  return "?";
}

const AVATAR_PALETTE = [
  "bg-rose-500/15 text-rose-600 ring-rose-500/30",
  "bg-amber-500/15 text-amber-600 ring-amber-500/30",
  "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
  "bg-sky-500/15 text-sky-600 ring-sky-500/30",
  "bg-indigo-500/15 text-indigo-600 ring-indigo-500/30",
  "bg-violet-500/15 text-violet-600 ring-violet-500/30",
  "bg-teal-500/15 text-teal-600 ring-teal-500/30",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function Avatar({ r }: { r: Reg }) {
  return (
    <div
      className={cn(
        "shrink-0 h-9 w-9 rounded-full grid place-items-center text-xs font-medium ring-1",
        avatarColor(r.id),
      )}
    >
      {initials(r)}
    </div>
  );
}

function FaithTag({ r }: { r: Reg }) {
  if (!r.faith) return <span className="text-muted-foreground text-xs">—</span>;
  const stage = r.faith_stage;
  if (stage === "已受洗" || r.faith === "christian" && stage !== "决志") {
    if (stage === "已受洗")
      return <Pill dot="bg-sky-500" cls="bg-sky-500/10 text-sky-700 dark:text-sky-300">已受洗</Pill>;
  }
  if (stage === "决志")
    return <Pill dot="bg-violet-500" cls="bg-violet-500/10 text-violet-700 dark:text-violet-300">决志</Pill>;
  if (stage === "受洗班")
    return <Pill dot="bg-amber-500" cls="bg-amber-500/10 text-amber-700 dark:text-amber-300">受洗班</Pill>;
  if (r.faith === "christian")
    return <Pill dot="bg-emerald-500" cls="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">基督徒{r.faith_years ? ` ${r.faith_years}年` : ""}</Pill>;
  if (r.faith === "seeker")
    return <Pill dot="bg-orange-500" cls="bg-orange-500/10 text-orange-700 dark:text-orange-300">慕道友</Pill>;
  if (r.faith === "other")
    return <Pill dot="bg-zinc-400" cls="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300">其他{r.faith_other ? `·${r.faith_other}` : ""}</Pill>;
  return <span className="text-muted-foreground text-xs">—</span>;
}

function StatusTag({
  value,
  onChange,
}: {
  value: "未联系" | "已联系";
  onChange: (v: "未联系" | "已联系") => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="outline-none">
          {value === "已联系" ? (
            <Pill dot="bg-emerald-500" cls="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 cursor-pointer">已联系</Pill>
          ) : (
            <Pill dot="bg-amber-500" cls="bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 cursor-pointer">待联系</Pill>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-36 p-1">
        {(["未联系", "已联系"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-accent",
              value === s && "bg-accent",
            )}
          >
            {s === "已联系" ? "🟢 已联系" : "🟡 待联系"}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Pill({
  children,
  cls,
  dot,
}: {
  children: React.ReactNode;
  cls: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        cls,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "primary" | "orange" | "emerald" | "amber" | "sky";
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    orange: "text-orange-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
  };
  return (
    <div className="flex-1 min-w-[110px] rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums mt-0.5", toneCls[tone])}>{value}</div>
    </div>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isThisWeek(iso: string): boolean {
  const d = new Date(iso).getTime();
  const n = new Date();
  const day = n.getDay() || 7; // Mon=1
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (day - 1)).getTime();
  return d >= start;
}

export type RegistrationListCRMProps = {
  regs: Reg[];
  filtered: Reg[];
  paginated: Reg[];
  search: string;
  setSearch: (v: string) => void;
  filterDate: Date | undefined;
  setFilterDate: (d: Date | undefined) => void;
  dateFilterMode: "day" | "after" | "before";
  setDateFilterMode: (m: "day" | "after" | "before") => void;
  statusFilter: "all" | "未联系" | "已联系";
  setStatusFilter: (v: "all" | "未联系" | "已联系") => void;
  page: number;
  setPage: (updater: number | ((p: number) => number)) => void;
  totalPages: number;
  setRegs: React.Dispatch<React.SetStateAction<any[]>>;
  updateStatus: (r: Reg, v: "未联系" | "已联系") => void;
  deleteReg: (id: string) => void;
  onEdit: (r: Reg) => void;
  exportExcel: () => void;
  exportAllExcel: () => void;
  printHandwrittenForms: (rows: Reg[]) => void;
};

export function RegistrationListCRM(props: RegistrationListCRMProps) {
  const {
    regs,
    filtered,
    paginated,
    search,
    setSearch,
    filterDate,
    setFilterDate,
    dateFilterMode,
    setDateFilterMode,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    totalPages,
    setRegs,
    updateStatus,
    deleteReg,
    onEdit,
    exportExcel,
    exportAllExcel,
    printHandwrittenForms,
  } = props;

  const [dateOpen, setDateOpen] = useState(false);
  const [detailReg, setDetailReg] = useState<Reg | null>(null);
  const [mode, setMode] = useState<"simple" | "full">("simple");

  const stats = useMemo(() => {
    const todayCnt = regs.filter((r) => isToday(r.created_at)).length;
    const weekCnt = regs.filter((r) => isThisWeek(r.created_at)).length;
    const seekers = regs.filter((r) => r.faith === "seeker").length;
    const christians = regs.filter((r) => r.faith === "christian").length;
    const waiting = regs.filter((r) => r.district !== "已联系").length;
    const contacted = regs.filter((r) => r.district === "已联系").length;
    return { todayCnt, weekCnt, seekers, christians, waiting, contacted };
  }, [regs]);

  // Group counts: visitor_group_id -> total members
  const groupSizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of regs) {
      if (!r.visitor_group_id) continue;
      m.set(r.visitor_group_id, (m.get(r.visitor_group_id) ?? 0) + 1);
    }
    return m;
  }, [regs]);
  const companionsOf = (r: Reg): Reg[] => {
    if (!r.visitor_group_id || !r.is_primary) return [];
    return regs.filter(
      (x) => x.visitor_group_id === r.visitor_group_id && x.id !== r.id,
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <section className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-xl">登记名单</h2>
            <p className="text-xs text-muted-foreground mt-1">
              快速查看新人信息与跟进状态 · 共 {filtered.length} / {regs.length} 条
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
              <button
                onClick={() => setMode("simple")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1.5 transition",
                  mode === "simple" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Rows3 className="h-3.5 w-3.5" /> 简洁
              </button>
              <button
                onClick={() => setMode("full")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1.5 transition",
                  mode === "full" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutList className="h-3.5 w-3.5" /> 完整
              </button>
            </div>
            <Button
              onClick={() => printHandwrittenForms(filtered)}
              disabled={filtered.length === 0}
              variant="outline"
              size="sm"
            >
              打印手写版
            </Button>
            <Button onClick={exportExcel} disabled={filtered.length === 0} size="sm">
              导出 Excel
            </Button>
            <Button onClick={exportAllExcel} disabled={regs.length === 0} variant="outline" size="sm">
              全部导出
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-4">
          <StatCard label="今日新增" value={stats.todayCnt} tone="primary" />
          <StatCard label="本周新增" value={stats.weekCnt} tone="sky" />
          <StatCard label="慕道友" value={stats.seekers} tone="orange" />
          <StatCard label="基督徒" value={stats.christians} tone="emerald" />
          <StatCard label="待联系" value={stats.waiting} tone="amber" />
          <StatCard label="已联系" value={stats.contacted} tone="emerald" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            placeholder="搜索姓名 / 电话"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1", filterDate && "border-primary text-primary")}
              >
                <CalendarIcon className="size-4" />
                {filterDate ? format(filterDate, "MM/dd", { locale: zhCN }) : "日期"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={setFilterDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
              <div className="border-t border-border/60 mt-2 pt-2">
                <RadioGroup
                  value={dateFilterMode}
                  onValueChange={(v) => setDateFilterMode(v as "day" | "after" | "before")}
                  className="flex gap-4 px-1"
                >
                  {[
                    ["day", "当日"],
                    ["after", "之后"],
                    ["before", "以前"],
                  ].map(([v, l]) => (
                    <div key={v} className="flex items-center gap-1.5">
                      <RadioGroupItem value={v} id={`dm-${v}`} />
                      <Label htmlFor={`dm-${v}`} className="text-xs cursor-pointer">{l}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={() => { setFilterDate(undefined); setDateOpen(false); }}>清除</Button>
                <Button size="sm" onClick={() => setDateOpen(false)} disabled={!filterDate}>应用</Button>
              </div>
            </PopoverContent>
          </Popover>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "未联系" | "已联系")}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          >
            <option value="all">全部跟进状态</option>
            <option value="未联系">待联系</option>
            <option value="已联系">已联系</option>
          </select>
          {filterDate && (
            <button
              onClick={() => setFilterDate(undefined)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> 清除日期
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium w-[110px]">时间</th>
                  <th className="py-2.5 px-3 font-medium">姓名</th>
                  <th className="py-2.5 px-3 font-medium">电话</th>
                  <th className="py-2.5 px-3 font-medium">信仰</th>
                  {mode === "full" && <th className="py-2.5 px-3 font-medium">基本</th>}
                  <th className="py-2.5 px-3 font-medium">来源</th>
                  {mode === "full" && <th className="py-2.5 px-3 font-medium">电邮</th>}
                  {mode === "full" && <th className="py-2.5 px-3 font-medium">地址</th>}
                  {mode === "full" && <th className="py-2.5 px-3 font-medium">婚姻</th>}
                  {mode === "full" && <th className="py-2.5 px-3 font-medium">标记</th>}
                  <th className="py-2.5 px-3 font-medium">跟进状态</th>
                  <th className="py-2.5 px-3 font-medium">跟进人</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const created = new Date(r.created_at);
                  const today = isToday(r.created_at);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3 align-middle whitespace-nowrap text-xs text-muted-foreground">
                        <div className="font-medium text-foreground/80 tabular-nums">
                          {format(created, "MM/dd", { locale: zhCN })}
                        </div>
                        <div className="tabular-nums">{format(created, "HH:mm")}</div>
                        {today && (
                          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0 rounded bg-primary/15 text-primary">今日</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <Avatar r={r} />
                          <div className="leading-tight">
                            <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                              {r.name || "—"}
                              {r.is_primary === false && r.relationship_to_primary && (
                                <Pill cls="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                  同行 · {r.relationship_to_primary}
                                </Pill>
                              )}
                              {r.is_primary !== false &&
                                r.visitor_group_id &&
                                (groupSizes.get(r.visitor_group_id) ?? 1) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setDetailReg(r)}
                                    className="inline-flex"
                                  >
                                    <Pill cls="bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 cursor-pointer">
                                      同行 {(groupSizes.get(r.visitor_group_id) ?? 1) - 1} 人
                                    </Pill>
                                  </button>
                                )}
                            </div>
                            {r.name_en && (
                              <div className="text-[11px] text-muted-foreground">{r.name_en}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle tabular-nums text-foreground/90 whitespace-nowrap">
                        {r.phone || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3 align-middle"><FaithTag r={r} /></td>
                      {mode === "full" && (
                        <td className="py-3 px-3 align-middle text-xs text-muted-foreground whitespace-nowrap">
                          {[r.gender === "male" ? "男" : r.gender === "female" ? "女" : null, r.age_group]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                      )}
                      <td className="py-3 px-3 align-middle">
                        <div className="leading-tight">
                          <div className="text-xs text-foreground/90">{formatReferrer(r) || formatSourceChannel(r) || <span className="text-muted-foreground">—</span>}</div>
                          {(r.invited_by || (r.referrer_type === "friend" && r.invited_by)) && (
                            <div className="text-[11px] text-muted-foreground">{r.invited_by}</div>
                          )}
                        </div>
                      </td>
                      {mode === "full" && (
                        <td className="py-3 px-3 align-middle text-xs">{r.email || <span className="text-muted-foreground">—</span>}</td>
                      )}
                      {mode === "full" && (
                        <td className="py-3 px-3 align-middle text-xs">
                          {[r.address, r.city, r.zip].filter(Boolean).join(" / ") || <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      {mode === "full" && (
                        <td className="py-3 px-3 align-middle text-xs">
                          {r.marital_status === "married"
                            ? `已婚${r.spouse_name ? `(${r.spouse_name})` : ""}`
                            : r.marital_status === "single"
                              ? "单身"
                              : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      {mode === "full" && (
                        <td className="py-3 px-3 align-middle">
                          <div className="flex flex-wrap gap-1">
                            {r.wants_visit && <Pill cls="bg-sky-500/10 text-sky-700 dark:text-sky-300">欢迎探访</Pill>}
                            {r.wants_info && <Pill cls="bg-violet-500/10 text-violet-700 dark:text-violet-300">需资料</Pill>}
                            {!r.wants_visit && !r.wants_info && <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-3 align-middle">
                        <StatusTag
                          value={r.district === "已联系" ? "已联系" : "未联系"}
                          onChange={(v) => updateStatus(r, v)}
                        />
                      </td>
                      <td className="py-3 px-3 align-middle">
                        <FollowUpEditor r={r} setRegs={setRegs} />
                      </td>
                      <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <IconBtn label="详情" onClick={() => setDetailReg(r)}><Eye className="h-4 w-4" /></IconBtn>
                          <IconBtn label="编辑" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></IconBtn>
                          <IconBtn label="删除" tone="danger" onClick={() => deleteReg(r.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={mode === "full" ? 12 : 8} className="py-16 text-center text-muted-foreground">
                      暂无登记记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              共 {filtered.length} 条，第 {page}/{totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page <= 1}>
                上一页
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                下一页
              </Button>
            </div>
          </div>
        )}

        <DetailDrawer reg={detailReg} companions={detailReg ? companionsOf(detailReg) : []} onClose={() => setDetailReg(null)} onEdit={(r) => { setDetailReg(null); onEdit(r); }} />
      </section>
    </TooltipProvider>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "h-8 w-8 inline-grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition",
            tone === "danger" && "hover:bg-destructive/10 hover:text-destructive",
          )}
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function FollowUpEditor({
  r,
  setRegs,
}: {
  r: Reg;
  setRegs: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.follow_up_person ?? "");
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            const val = draft.trim();
            const { error } = await supabase.from("registrations").update({ follow_up_person: val || null }).eq("id", r.id);
            if (error) toast.error(error.message);
            else {
              setRegs((prev: any[]) => prev.map((x) => (x.id === r.id ? { ...x, follow_up_person: val || null } : x)));
              toast.success("已保存");
              setEditing(false);
            }
          } else if (e.key === "Escape") setEditing(false);
        }}
        className="bg-background border border-border rounded px-1.5 py-0.5 text-xs w-24"
        placeholder="姓名"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(r.follow_up_person ?? ""); setEditing(true); }}
      className={cn(
        "text-xs px-2 py-1 rounded-md hover:bg-accent",
        r.follow_up_person ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {r.follow_up_person || "+ 指派"}
    </button>
  );
}

function DetailDrawer({
  reg,
  companions,
  onClose,
  onEdit,
}: {
  reg: Reg | null;
  companions: Reg[];
  onClose: () => void;
  onEdit: (r: Reg) => void;
}) {
  return (
    <Sheet open={!!reg} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {reg && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar r={reg} />
                <div className="leading-tight">
                  <SheetTitle className="text-lg">{reg.name || "—"}</SheetTitle>
                  {reg.name_en && <SheetDescription className="text-xs">{reg.name_en}</SheetDescription>}
                </div>
              </div>
            </SheetHeader>
            <div className="mt-5 space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                <FaithTag r={reg} />
                {reg.district === "已联系" ? (
                  <Pill dot="bg-emerald-500" cls="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">已联系</Pill>
                ) : (
                  <Pill dot="bg-amber-500" cls="bg-amber-500/10 text-amber-700 dark:text-amber-300">待联系</Pill>
                )}
                {reg.wants_visit && <Pill cls="bg-sky-500/10 text-sky-700 dark:text-sky-300">欢迎探访</Pill>}
                {reg.wants_info && <Pill cls="bg-violet-500/10 text-violet-700 dark:text-violet-300">需资料</Pill>}
              </div>

              <DetailGroup title="联系方式">
                <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="电话" value={reg.phone} />
                <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="电邮" value={reg.email} />
                <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="地址" value={[reg.address, reg.city, reg.zip].filter(Boolean).join(" / ") || null} />
              </DetailGroup>

              <DetailGroup title="个人资料">
                <DetailRow label="性别" value={reg.gender === "male" ? "男" : reg.gender === "female" ? "女" : null} />
                <DetailRow label="年龄" value={reg.age_group} />
                <DetailRow
                  icon={<Heart className="h-3.5 w-3.5" />}
                  label="婚姻"
                  value={reg.marital_status === "married" ? `已婚${reg.spouse_name ? `(${reg.spouse_name})` : ""}` : reg.marital_status === "single" ? "单身" : null}
                />
              </DetailGroup>

              <DetailGroup title="来源">
                <DetailRow label="渠道" value={formatSourceChannel(reg) || null} />
                <DetailRow label="介绍方式" value={formatReferrer(reg) || null} />
                <DetailRow icon={<Users className="h-3.5 w-3.5" />} label="介绍人" value={reg.invited_by} />
              </DetailGroup>

              <DetailGroup title="跟进">
                <DetailRow label="跟进人" value={reg.follow_up_person} />
                <DetailRow label="状态" value={reg.district === "已联系" ? "已联系" : "待联系"} />
                <DetailRow label="阶段" value={reg.faith_stage} />
              </DetailGroup>

              {reg.notes && (
                <DetailGroup title="备注">
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{reg.notes}</p>
                </DetailGroup>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" onClick={() => onEdit(reg)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑资料
                </Button>
                <Button size="sm" variant="outline" onClick={onClose}>关闭</Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground min-w-[60px]">
        {icon}{label}
      </span>
      <span className="text-foreground/90 text-right break-all">{value || "—"}</span>
    </div>
  );
}

// Silence unused import warning for TagIcon (kept for future use)
export const _TagIconRef = TagIcon;