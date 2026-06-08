import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";

type Reg = {
  id: string;
  name: string;
  name_en: string | null;
  faith: string | null;
  faith_years: number | null;
  faith_other: string | null;
  referrer_type: string | null;
  invited_by: string | null;
  referrer_other: string | null;
  source_channel: string | null;
  notes: string | null;
  created_at: string;
};

const SAN_FRANCISCO_TIME_ZONE = "America/Los_Angeles";

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function getOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return zonedAsUtc - date.getTime();
}

function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
}

function getTodayRangeForSanFrancisco() {
  const { year, month, day } = getTimeZoneParts(new Date(), SAN_FRANCISCO_TIME_ZONE);
  return {
    start: zonedMidnightToUtc(year, month, day, SAN_FRANCISCO_TIME_ZONE).toISOString(),
    end: zonedMidnightToUtc(year, month, day + 1, SAN_FRANCISCO_TIME_ZONE).toISOString(),
  };
}

export const Route = createFileRoute("/today-preview")({
  component: PreviewPage,
});

const FONT_OPTIONS = [
  { label: "华文宋体", value: '"STSong","SimSun","宋体",serif' },
  { label: "华文楷体", value: '"STKaiti","KaiTi","楷体",serif' },
  { label: "华文黑体", value: '"STHeiti","SimHei","黑体",sans-serif' },
  { label: "华文仿宋", value: '"STFangsong","FangSong","仿宋",serif' },
  { label: "微软雅黑", value: '"Microsoft YaHei","微软雅黑",sans-serif' },
  { label: "苹方", value: '"PingFang SC","苹方",sans-serif' },
  { label: "思源宋体", value: '"Source Han Serif SC","Noto Serif SC",serif' },
  { label: "思源黑体", value: '"Source Han Sans SC","Noto Sans SC",sans-serif' },
  { label: "Serif (Georgia)", value: 'Georgia,"Times New Roman",serif' },
  { label: "Sans (System)", value: 'system-ui,-apple-system,sans-serif' },
];

function formatFaith(r: Reg): string {
  if (r.faith === "christian") return "基督徒";
  if (r.faith === "seeker") return "慕道友";
  if (r.faith === "other") return r.faith_other ? `其他:${r.faith_other}` : "其他";
  return "—";
}

function formatReferrer(r: Reg): string {
  if (r.referrer_type === "self") return "自己";
  if (r.referrer_type === "friend") return r.invited_by ? `亲友:${r.invited_by}` : "亲友";
  if (r.referrer_type === "other") return r.referrer_other ? `其他:${r.referrer_other}` : "其他";
  return "—";
}

function formatSource(r: Reg): string {
  switch (r.source_channel) {
    case "chatgpt":
      return "ChatGPT";
    case "maps":
      return "谷歌/苹果地图";
    case "wechat":
      return "微信/小红书";
    case "youtube":
      return "YouTube";
    case "missionary":
      return "宣教士";
    default:
      return "—";
  }
}

function PreviewPage() {
  const navigate = useNavigate();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const v = Number(localStorage.getItem("today-preview:pageSize"));
    return v > 0 ? v : 5;
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === "undefined") return 36;
    const v = Number(localStorage.getItem("today-preview:fontSize"));
    return v >= 12 ? v : 36;
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    if (typeof window === "undefined") return FONT_OPTIONS[0].value;
    return localStorage.getItem("today-preview:fontFamily") || FONT_OPTIONS[0].value;
  });

  useEffect(() => {
    localStorage.setItem("today-preview:pageSize", String(pageSize));
  }, [pageSize]);
  useEffect(() => {
    localStorage.setItem("today-preview:fontSize", String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem("today-preview:fontFamily", fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          navigate({ to: "/login" });
          return;
        }
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.session.user.id)
          .in("role", ["admin", "super_admin"]);
        if (!roleData || roleData.length === 0) {
          // 没有权限就停留在当前页面显示提示，不强制跳转登录
          setLoading(false);
          return;
        }
        const { start, end } = getTodayRangeForSanFrancisco();
        const cols =
          "id,name,name_en,faith,faith_years,faith_other,referrer_type,invited_by,referrer_other,source_channel,notes,created_at";
        let { data, error } = await supabase
          .from("registrations")
          .select(cols)
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: false });
        if (error) console.error("[today-preview] query error", error);
        setRegs((data ?? []) as Reg[]);
      } catch (e) {
        console.error("[today-preview] fetch failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: SAN_FRANCISCO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalPages = Math.max(1, Math.ceil(regs.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = regs.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const cellStyle: React.CSSProperties = {
    fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: 1.4,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-10 max-w-[1400px]">
        <header className="text-center mb-8 pb-6 border-b border-border/60">
          <h1 className="font-serif text-4xl mb-2">基督三家欢迎你</h1>
          <p className="text-muted-foreground">
            {today} · 共 {regs.length} 条登记
          </p>
        </header>

        <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-4 w-4 mr-1" /> 设置
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            打印
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            关闭
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">加载中...</p>
        ) : regs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">今天暂无新登记</p>
        ) : (
          <>
            <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl">
              <table className="w-full" style={{ fontFamily }}>
                <thead>
                  <tr className="border-b-2 border-border bg-muted/30">
                    <th className="py-4 px-4 text-left font-semibold" style={cellStyle}>日期</th>
                    <th className="py-4 px-4 text-left font-semibold" style={cellStyle}>姓名</th>
                    <th className="py-4 px-4 text-left font-semibold" style={cellStyle}>信仰</th>
                    <th className="py-4 px-4 text-left font-semibold" style={cellStyle}>介绍人</th>
                    <th className="py-4 px-4 text-left font-semibold" style={cellStyle}>认识途径</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-4 px-4 whitespace-nowrap" style={cellStyle}>
                        {new Date(r.created_at).toLocaleDateString("zh-CN", {
                          timeZone: SAN_FRANCISCO_TIME_ZONE,
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </td>
                      <td className="py-4 px-4" style={cellStyle}>{r.name}</td>
                      <td className="py-4 px-4" style={cellStyle}>{formatFaith(r)}</td>
                      <td className="py-4 px-4" style={cellStyle}>{formatReferrer(r)}</td>
                      <td className="py-4 px-4" style={cellStyle}>{formatSource(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {currentPage + 1} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>显示设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">每页条目数</Label>
              <input
                type="number"
                min={1}
                max={50}
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">字体大小 ({fontSize}px)</Label>
              <input
                type="range"
                min={12}
                max={96}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                min={12}
                max={96}
                value={fontSize}
                onChange={(e) =>
                  setFontSize(Math.max(12, Math.min(96, Number(e.target.value) || 12)))
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">字体</Label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div
                className="mt-2 p-3 border border-border/50 rounded-md bg-muted/20"
                style={{ fontFamily, fontSize: `${Math.min(fontSize, 28)}px` }}
              >
                预览：基督三家欢迎你 ABC 123
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
