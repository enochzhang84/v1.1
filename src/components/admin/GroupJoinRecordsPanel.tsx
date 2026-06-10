import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export type GroupType = "happiness_group" | "grace_tea_group";

export type GroupJoinRecord = {
  id: string;
  group_type: GroupType;
  record_date: string;
  name: string;
  gender: string | null;
  faith_status: string | null;
  joined_at: string | null;
  status: string | null;
  notes: string | null;
  follow_up_status: string | null;
  status_note: string | null;
  attended_count: number | null;
  last_attended_at: string | null;
  source_registration_id: string | null;
  transferred_out: boolean | null;
  created_at: string;
  updated_at: string;
};

const FOLLOW_UP_OPTIONS = [
  "待邀请","已邀请","已参加","未参加","持续跟进","转团契","转受洗班","暂停跟进","失联","已转出",
];

const EMPTY = (gt: GroupType): Partial<GroupJoinRecord> => ({
  group_type: gt,
  record_date: new Date().toISOString().slice(0, 10),
  name: "",
  gender: "",
  faith_status: "",
  joined_at: null,
  status: "",
  notes: "",
  follow_up_status: "待邀请",
  status_note: "",
});

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

interface MonthCalendarProps {
  ym: string; // "YYYY-MM"
  records: GroupJoinRecord[];
  onSelectDay: (dateISO: string) => void;
  onAddNew: (dateISO: string) => void;
}
function MonthCalendar({ ym, records, onSelectDay, onAddNew }: MonthCalendarProps) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: { d: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ d: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, iso: `${ym}-${pad2(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ d: null, iso: null });

  const countByDay = new Map<string, number>();
  for (const r of records) {
    if ((r.record_date ?? "").startsWith(ym)) {
      countByDay.set(r.record_date, (countByDay.get(r.record_date) ?? 0) + 1);
    }
  }

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.d === null ? (
            <div key={i} className="h-16" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (countByDay.get(c.iso!) ? onSelectDay(c.iso!) : onAddNew(c.iso!))}
              className="h-16 rounded-lg border border-border/40 hover:bg-muted/40 text-left p-1 flex flex-col"
            >
              <span className="text-xs text-muted-foreground">{c.d}</span>
              {countByDay.get(c.iso!) ? (
                <span className="mt-auto inline-flex items-center justify-center text-[11px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 self-end">
                  {countByDay.get(c.iso!)}
                </span>
              ) : null}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

interface Props {
  groupType: GroupType;
  title: string;
}
export function GroupJoinRecordsPanel({ groupType, title }: Props) {
  const [records, setRecords] = useState<GroupJoinRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const today = new Date();
  const [ym, setYm] = useState(`${today.getFullYear()}-${pad2(today.getMonth() + 1)}`);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<GroupJoinRecord>>(EMPTY(groupType));

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("group_join_records")
      .select("*")
      .eq("group_type", groupType)
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("加载失败: " + error.message);
      return;
    }
    setRecords((data ?? []) as GroupJoinRecord[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (dayFilter && r.record_date !== dayFilter) return false;
      if (!dayFilter && !(r.record_date ?? "").startsWith(ym)) return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.status ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q) ||
        (r.faith_status ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, search, ym, dayFilter]);

  function openNew(dateISO?: string) {
    setForm({ ...EMPTY(groupType), record_date: dateISO ?? new Date().toISOString().slice(0, 10) });
    setEditOpen(true);
  }
  function openEdit(r: GroupJoinRecord) {
    setForm({ ...r });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name?.trim()) {
      toast.error("请填写姓名");
      return;
    }
    const payload = {
      group_type: groupType,
      record_date: form.record_date || new Date().toISOString().slice(0, 10),
      name: form.name.trim(),
      gender: form.gender?.trim() || null,
      faith_status: form.faith_status?.trim() || null,
      joined_at: form.joined_at || null,
      status: form.status?.trim() || null,
      notes: form.notes?.trim() || null,
      follow_up_status: form.follow_up_status || "待邀请",
      status_note: form.status_note?.trim() || null,
    };
    if (form.id) {
      const { error } = await (supabase as any)
        .from("group_join_records")
        .update(payload)
        .eq("id", form.id);
      if (error) return toast.error("保存失败: " + error.message);
      toast.success("已更新");
    } else {
      const { error } = await (supabase as any)
        .from("group_join_records")
        .insert(payload);
      if (error) return toast.error("保存失败: " + error.message);
      toast.success("已新增");
    }
    setEditOpen(false);
    load();
  }

  async function remove(r: GroupJoinRecord) {
    if (!confirm(`确定删除 ${r.name} 的加入记录?`)) return;
    const { error } = await (supabase as any)
      .from("group_join_records")
      .delete()
      .eq("id", r.id);
    if (error) return toast.error("删除失败: " + error.message);
    toast.success("已删除");
    load();
  }

  function exportExcel() {
    if (filtered.length === 0) {
      toast.error("当前范围无记录");
      return;
    }
    const rows = filtered.map((r) => ({
      日期: r.record_date,
      姓名: r.name,
      性别: r.gender ?? "",
      信仰: r.faith_status ?? "",
      加入时间: r.joined_at ?? "",
      状态: r.status ?? "",
      备注: r.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_${dayFilter ?? ym}.xlsx`);
  }

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={ym} onChange={(e) => { setYm(e.target.value); setDayFilter(null); }} className="h-8 w-[140px]" />
          {dayFilter && (
            <Button size="sm" variant="ghost" onClick={() => setDayFilter(null)}>
              清除 {dayFilter}
            </Button>
          )}
          <Input
            placeholder="搜索姓名 / 状态 / 备注"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={exportExcel}>导出 Excel</Button>
          <Button size="sm" onClick={() => openNew()}>+ 新增</Button>
          <Button size="sm" variant="outline" onClick={load}>刷新</Button>
        </div>
      </div>

      <MonthCalendar
        ym={ym}
        records={records}
        onSelectDay={(iso) => setDayFilter(iso)}
        onAddNew={(iso) => openNew(iso)}
      />

      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-muted/70">
            <tr className="text-left border-b border-border/60 text-muted-foreground">
              <th className="py-2 px-2">日期</th>
              <th className="py-2 px-2">姓名</th>
              <th className="py-2 px-2">性别</th>
              <th className="py-2 px-2">信仰</th>
              <th className="py-2 px-2">加入时间</th>
              <th className="py-2 px-2">状态</th>
              <th className="py-2 px-2">备注</th>
              <th className="py-2 px-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/30 align-top">
                <td className="py-2 px-2 whitespace-nowrap">{r.record_date}</td>
                <td className="py-2 px-2 font-medium">{r.name}</td>
                <td className="py-2 px-2">{r.gender ?? ""}</td>
                <td className="py-2 px-2">{r.faith_status ?? ""}</td>
                <td className="py-2 px-2 whitespace-nowrap">{r.joined_at ?? ""}</td>
                <td className="py-2 px-2 max-w-[260px] whitespace-pre-wrap break-words">{r.status ?? ""}</td>
                <td className="py-2 px-2 max-w-[260px] whitespace-pre-wrap break-words">{r.notes ?? ""}</td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(r)} className="text-xs text-primary hover:underline mr-2">编辑</button>
                  <button onClick={() => remove(r)} className="text-xs text-destructive hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  暂无记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑加入记录" : "新增加入记录"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>日期</Label>
                <Input type="date" value={form.record_date ?? ""} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>加入时间</Label>
                <Input type="date" value={form.joined_at ?? ""} onChange={(e) => setForm({ ...form, joined_at: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>姓名 *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>性别</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.gender ?? ""}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>信仰</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.faith_status ?? ""}
                  onChange={(e) => setForm({ ...form, faith_status: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="基督徒">基督徒</option>
                  <option value="慕道友">慕道友</option>
                  <option value="未信">未信</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>状态（对聊天内容感觉怎么样）</Label>
              <Input value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder="例如：很感兴趣 / 反应平淡" />
            </div>
            <div className="space-y-1">
              <Label>备注</Label>
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
