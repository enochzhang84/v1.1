import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/sunday-schedule")({
  component: SundaySchedulePage,
});

type Row = {
  id: string;
  slot_time: string;
  course_id: string | null;
  course_name: string | null;
  class_name: string | null;
  weekly_topic: string | null;
  teacher_name: string | null;
  notes: string | null;
  sort_order: number;
};
type Course = { id: string; name: string; is_active: boolean; sort_order: number };

function SundaySchedulePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [newSlot, setNewSlot] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read ?courseId=...&courseName=... from URL
  const { filterCourseId, filterCourseName } = useMemo(() => {
    if (typeof window === "undefined") return { filterCourseId: null as string | null, filterCourseName: "" };
    const p = new URLSearchParams(window.location.search);
    return { filterCourseId: p.get("courseId"), filterCourseName: p.get("courseName") ?? "" };
  }, []);

  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        navigate({ to: "/login", search: { redirect: "/sunday-schedule" } });
        return;
      }
      setAuthed(true);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const ok = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
      setIsAdmin(ok);
      setChecking(false);
      if (ok) loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = useCallback(async () => {
    let q = (supabase as any).from("sunday_class_schedule").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (filterCourseId) q = q.eq("course_id", filterCourseId);
    const [{ data: r }, { data: c }] = await Promise.all([
      q,
      supabase.from("sunday_school_courses").select("*").order("sort_order", { ascending: true }),
    ]);
    setRows((r ?? []) as Row[]);
    setCourses((c ?? []) as Course[]);
  }, [filterCourseId]);

  if (checking) return <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>;
  if (!isAdmin)
    return (
      <div className="p-10 text-center text-sm space-y-2">
        <p>你没有权限编辑课程，请联系超级管理员。</p>
        {!authed && <Link to="/login" className="underline">去登录</Link>}
      </div>
    );

  async function addRow() {
    if (!newSlot.trim()) return toast.error("请填写时间");
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await (supabase as any).from("sunday_class_schedule").insert({
      slot_time: newSlot.trim(),
      course_id: filterCourseId,
      course_name: filterCourseName || null,
      weekly_topic: newTopic || null,
      teacher_name: newTeacher || null,
      notes: newNotes || null,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    setNewSlot(""); setNewTopic(""); setNewTeacher(""); setNewNotes("");
    toast.success("已添加");
    loadAll();
  }

  async function updateRow(id: string, patch: Partial<Row>) {
    const { error } = await (supabase as any).from("sunday_class_schedule").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  }

  async function delRow(id: string) {
    if (!confirm("删除此行?")) return;
    const { error } = await (supabase as any).from("sunday_class_schedule").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    loadAll();
  }

  function exportExcel() {
    const data = rows.map((r, i) => ({
      "序号": i + 1,
      "时间": r.slot_time,
      "课程": r.weekly_topic ?? "",
      "老师": r.teacher_name ?? "",
      "备注": r.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "课程表");
    const fileName = filterCourseName ? `${filterCourseName}_课程表` : "课程表";
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`已导出 ${data.length} 条`);
  }

  async function importExcel(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (json.length === 0) return toast.error("文件为空");
      const baseOrder = (rows[rows.length - 1]?.sort_order ?? 0);
      const inserts = json.map((r, idx) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") return String(r[k]).trim();
          }
          return null;
        };
        const slot = get(["时间", "日期", "time", "slot_time"]);
        return {
          slot_time: slot || "",
          weekly_topic: get(["课程", "本周课程", "topic", "weekly_topic"]),
          teacher_name: get(["老师", "教师", "teacher", "teacher_name"]),
          notes: get(["备注", "notes", "remark"]),
          course_id: filterCourseId,
          course_name: filterCourseName || null,
          sort_order: baseOrder + idx + 1,
        };
      }).filter((r) => r.slot_time);
      if (inserts.length === 0) return toast.error("未识别到有效数据(需含「时间」列)");
      const { error } = await (supabase as any).from("sunday_class_schedule").insert(inserts);
      if (error) return toast.error(error.message);
      toast.success(`已导入 ${inserts.length} 条`);
      loadAll();
    } catch (err) {
      toast.error("导入失败: " + (err as Error).message);
    }
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`@media print { .no-print { display:none !important; } @page { margin: 1.5cm; } body { background:#fff; } }`}</style>
      <header className="border-b border-border/60 no-print">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <h1 className="font-serif text-2xl">
              课程表{filterCourseName ? ` · ${filterCourseName}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link to="/admin"><Button variant="ghost" size="sm">返回后台</Button></Link>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importExcel(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              导入 Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
              导出 Excel
            </Button>
            <Button size="sm" variant="outline" onClick={printPage}>打印</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 print:py-0 print:px-0">
        <div className="hidden print:block mb-6 text-center">
          <h1 className="font-serif text-3xl">课程表{filterCourseName ? ` · ${filterCourseName}` : ""}</h1>
          <p className="text-sm text-muted-foreground mt-1">{new Date().toLocaleDateString("zh-CN")}</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-muted-foreground border-b border-border/60">
                <th className="py-2 px-3 w-16">序号</th>
                <th className="py-2 px-3 w-44">时间</th>
                <th className="py-2 px-3">课程</th>
                <th className="py-2 px-3 w-40">老师</th>
                <th className="py-2 px-3">备注</th>
                <th className="py-2 px-3 text-right w-20 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-3">
                    <Input
                      type="date"
                      defaultValue={r.slot_time}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== r.slot_time) updateRow(r.id, { slot_time: v });
                      }}
                      className="h-8 print:border-0 print:shadow-none print:px-0"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      defaultValue={r.weekly_topic ?? ""}
                      placeholder="课程"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (r.weekly_topic ?? "")) updateRow(r.id, { weekly_topic: v || null });
                      }}
                      className="h-8 print:border-0 print:shadow-none print:px-0"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      defaultValue={r.teacher_name ?? ""}
                      placeholder="老师"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (r.teacher_name ?? "")) updateRow(r.id, { teacher_name: v || null });
                      }}
                      className="h-8 print:border-0 print:shadow-none print:px-0"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      defaultValue={r.notes ?? ""}
                      placeholder="备注"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (r.notes ?? "")) updateRow(r.id, { notes: v || null });
                      }}
                      className="h-8 print:border-0 print:shadow-none print:px-0"
                    />
                  </td>
                  <td className="py-2 px-3 text-right no-print">
                    <button onClick={() => delRow(r.id)} className="text-xs text-destructive hover:underline">
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">暂无记录，请在下方添加或导入 Excel</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-card border border-border/50 rounded-2xl p-4 no-print">
          <h3 className="font-medium mb-3">新增一行</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input type="date" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
            <Input placeholder="课程" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
            <Input placeholder="老师" value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} />
            <Input placeholder="备注" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            <Button onClick={addRow}>添加</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            导入格式：时间｜课程｜老师｜备注（第一行为表头，与导出格式一致）。
            {courses.length > 0 && !filterCourseId && (
              <> 当前显示全部课程数据；要查看单门课程，请到后台「主日学」点击该课程后的「课程表」。</>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}