import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Screen = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  orientation: string;
  current_content_type: string;
  current_content_payload: Record<string, unknown> | null;
  playlist_id: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  sort_order: number;
};

type Playlist = {
  id: string;
  name: string;
  interval_seconds: number;
  loop_enabled: boolean;
};

type PlaylistItem = {
  id: string;
  playlist_id: string;
  sort_order: number;
  content_type: string;
  content_payload: Record<string, unknown> | null;
  duration_seconds: number | null;
};

// Content library — pages and named sections from the site that can be
// played on a TV screen or added to a playlist. Add new entries here as
// the site grows; no code changes needed elsewhere.
const CONTENT_LIBRARY: { group: string; items: { label: string; path: string }[] }[] = [
  {
    group: "首页",
    items: [
      { label: "完整页面", path: "/" },
      { label: "教会介绍", path: "/#about" },
      { label: "聚会时间", path: "/#services" },
      { label: "今日公告", path: "/#announcements" },
    ],
  },
  {
    group: "扫码登记",
    items: [{ label: "整页", path: "/register" }],
  },
  {
    group: "退修会",
    items: [
      { label: "完整页面", path: "/retreat" },
      { label: "活动介绍", path: "/retreat#intro" },
      { label: "报名二维码", path: "/retreat#register-qr" },
      { label: "时间地点", path: "/retreat#info" },
    ],
  },
  {
    group: "主日学",
    items: [
      { label: "课程介绍 / 课表", path: "/sunday-schedule" },
    ],
  },
  {
    group: "事工 / 服侍",
    items: [
      { label: "儿童事工签到", path: "/sunday-checkin" },
      { label: "事工申请", path: "/serve-apply" },
    ],
  },
  {
    group: "互动",
    items: [
      { label: "留言板", path: "/message-board" },
      { label: "意见反馈", path: "/feedback" },
    ],
  },
];

const ALL_LIBRARY_ENTRIES = CONTENT_LIBRARY.flatMap((g) =>
  g.items.map((it) => ({ ...it, group: g.group })),
);

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 60_000;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "从未";
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}小时前`;
  return `${Math.floor(sec / 86400)}天前`;
}

function describeContent(s: Screen): string {
  const p = (s.current_content_payload ?? {}) as { url?: string; title?: string };
  if (s.current_content_type === "playlist") return "播放列表";
  if (s.current_content_type === "emergency") return "🚨 紧急广播";
  if (s.current_content_type === "embed") {
    const url = p.url ?? "";
    const match = ALL_LIBRARY_ENTRIES.find((e) => e.path === url);
    if (match) return `${match.group} · ${match.label}`;
    return `网页：${url || "未设置"}`;
  }
  return p.title || s.current_content_type;
}

export function ScreenManager() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [posters, setPosters] = useState<{ id: string; slug: string | null; title: string; is_active: boolean }[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: i }, { data: po }] = await Promise.all([
      supabase.from("display_screens" as never).select("*").order("sort_order"),
      supabase.from("display_playlists" as never).select("*").order("name"),
      supabase.from("display_playlist_items" as never).select("*").order("sort_order"),
      supabase
        .from("display_posters" as never)
        .select("id, slug, title, is_active")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    setScreens((s as unknown as Screen[]) ?? []);
    setPlaylists((p as unknown as Playlist[]) ?? []);
    setItems((i as unknown as PlaylistItem[]) ?? []);
    setPosters((po as unknown as { id: string; slug: string | null; title: string; is_active: boolean }[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "display_screens" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_playlists" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_playlist_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_posters" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const updateScreen = async (id: string, patch: Partial<Screen>) => {
    const { error } = await supabase
      .from("display_screens" as never)
      .update(patch as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("已更新");
  };

  const setContent = async (
    screen: Screen,
    type: string,
    payload: Record<string, unknown> = {},
    playlistId: string | null = null,
  ) => {
    await updateScreen(screen.id, {
      current_content_type: type,
      current_content_payload: payload,
      playlist_id: type === "playlist" ? playlistId : null,
    });
  };

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({
    slug: "",
    name: "",
    location: "",
    orientation: "landscape",
  });
  const createScreen = async () => {
    if (!draft.slug || !draft.name) return toast.error("请填写 slug 和名称");
    const { error } = await supabase
      .from("display_screens" as never)
      .insert([{ ...draft, sort_order: screens.length + 1 } as never]);
    if (error) return toast.error(error.message);
    toast.success("已新增屏幕");
    setDraft({ slug: "", name: "", location: "", orientation: "landscape" });
    setShowNew(false);
  };

  const deleteScreen = async (id: string) => {
    if (!confirm("确定删除此屏幕？")) return;
    const { error } = await supabase.from("display_screens" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  // Emergency
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const broadcastEmergency = async () => {
    if (!emergencyMsg.trim()) return toast.error("请输入紧急通知内容");
    if (!confirm(`确认向全部 ${screens.length} 块屏幕发送紧急广播？`)) return;
    const { error } = await supabase
      .from("display_screens" as never)
      .update({
        current_content_type: "emergency",
        current_content_payload: { title: "紧急通知", message: emergencyMsg },
      } as never)
      .eq("is_active", true);
    if (error) toast.error(error.message);
    else toast.success("已广播");
  };

  // Playlists
  const [newPlName, setNewPlName] = useState("");
  const [newPlInterval, setNewPlInterval] = useState(10);
  const createPlaylist = async () => {
    if (!newPlName.trim()) return toast.error("请输入播放列表名称");
    const { data, error } = await supabase
      .from("display_playlists" as never)
      .insert([{ name: newPlName, interval_seconds: newPlInterval } as never])
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (data) {
      setPlaylists((prev) => {
        const next = [...prev, data as unknown as Playlist];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
    }
    setNewPlName("");
    setNewPlInterval(10);
    toast.success("已创建播放列表");
    load();
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm("删除此播放列表？")) return;
    const { error } = await supabase.from("display_playlists" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev.filter((it) => it.playlist_id !== id));
    toast.success("已删除");
    load();
  };

  const addLibraryItem = async (
    playlistId: string,
    entry: { label: string; path: string },
  ) => {
    const cur = items.filter((it) => it.playlist_id === playlistId);
    const sort = (cur[cur.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("display_playlist_items" as never).insert([
      {
        playlist_id: playlistId,
        sort_order: sort,
        content_type: "embed",
        content_payload: { url: entry.path, title: entry.label },
      } as never,
    ]);
    if (error) toast.error(error.message);
  };

  const updatePlaylistItem = async (id: string, patch: Partial<PlaylistItem>) => {
    const { error } = await supabase
      .from("display_playlist_items" as never)
      .update(patch as never)
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  const deletePlaylistItem = async (id: string) => {
    const { error } = await supabase.from("display_playlist_items" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const moveItem = async (id: string, dir: -1 | 1) => {
    const list = items
      .filter((it) => it.playlist_id === items.find((x) => x.id === id)?.playlist_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = list.findIndex((it) => it.id === id);
    const nb = list[idx + dir];
    if (!nb) return;
    await Promise.all([
      updatePlaylistItem(id, { sort_order: nb.sort_order }),
      updatePlaylistItem(nb.id, { sort_order: list[idx].sort_order }),
    ]);
  };

  const updatePlaylist = async (id: string, patch: Partial<Playlist>) => {
    const { error } = await supabase
      .from("display_playlists" as never)
      .update(patch as never)
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-serif text-xl">TV 屏幕管理（多屏数字标牌）</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/signage", "_blank")}>
            📢 宣传栏
          </Button>
          <Button onClick={() => setShowNew((v) => !v)}>
            {showNew ? "取消" : "+ 新增屏幕"}
          </Button>
        </div>
      </div>

      {posters.length > 0 && (
        <div className="text-xs text-muted-foreground">
          可在屏幕「自定义链接」中输入 <code>/display/poster/&lt;slug&gt;</code> 投放宣传内容，或选择下方播放列表添加宣传栏内容。
        </div>
      )}

      {showNew && (
        <div className="grid sm:grid-cols-4 gap-3 border border-border/50 rounded-xl p-4 bg-muted/30">
          <Input
            placeholder="标识 (如 lobby / front-door)"
            value={draft.slug}
            onChange={(e) =>
              setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
          />
          <Input
            placeholder="名称"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            placeholder="位置"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.orientation}
            onChange={(e) => setDraft({ ...draft, orientation: e.target.value })}
          >
            <option value="landscape">横屏</option>
            <option value="portrait">竖屏</option>
          </select>
          <div className="sm:col-span-4">
            <Button onClick={createScreen}>创建</Button>
          </div>
        </div>
      )}

      {/* Screens grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {screens.map((s) => {
          const online = isOnline(s.last_seen_at);
          return (
            <div
              key={s.id}
              className="border border-border/50 rounded-xl p-4 flex flex-col gap-3 bg-background"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        online ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.location || "—"} · {s.orientation === "portrait" ? "竖屏" : "横屏"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {online ? "在线" : "离线"} · 最后在线 {timeAgo(s.last_seen_at)}
                  </div>
                  <div className="text-xs mt-1">
                    当前：
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                      {describeContent(s)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/display/${s.slug}`, "_blank")}
                  >
                    打开
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteScreen(s.id)}>
                    删除
                  </Button>
                </div>
              </div>

              <ScreenContentEditor
                screen={s}
                playlists={playlists}
                onSet={(type, payload, playlistId) => setContent(s, type, payload, playlistId)}
                onSettings={(patch) => updateScreen(s.id, patch)}
              />
            </div>
          );
        })}
      </div>

      {/* Emergency broadcast */}
      <div className="border border-red-300 rounded-xl p-4 bg-red-50">
        <h3 className="font-semibold text-red-800 mb-2">🚨 紧急广播</h3>
        <Textarea
          placeholder="向所有屏幕推送紧急通知…"
          value={emergencyMsg}
          onChange={(e) => setEmergencyMsg(e.target.value)}
          rows={2}
        />
        <div className="mt-2">
          <Button variant="destructive" onClick={broadcastEmergency}>
            广播到全部屏幕
          </Button>
        </div>
      </div>

      {/* Playlists */}
      <div className="border border-border/50 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold">播放列表</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-xs"
            placeholder="新播放列表名称（如：大厅、前门、饭堂）"
            value={newPlName}
            onChange={(e) => setNewPlName(e.target.value)}
          />
          <Input
            type="number"
            className="w-32"
            min={2}
            value={newPlInterval}
            onChange={(e) => setNewPlInterval(Number(e.target.value) || 10)}
          />
          <span className="text-sm text-muted-foreground">默认秒/页</span>
          <Button onClick={createPlaylist}>创建</Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              items={items
                .filter((i) => i.playlist_id === pl.id)
                .sort((a, b) => a.sort_order - b.sort_order)}
              onAddLibrary={(entry) => addLibraryItem(pl.id, entry)}
              onAddCustom={(label, path) => addLibraryItem(pl.id, { label, path })}
              onUpdateItem={updatePlaylistItem}
              onDeleteItem={deletePlaylistItem}
              onMoveItem={moveItem}
              onUpdate={(patch) => updatePlaylist(pl.id, patch)}
              onDelete={() => deletePlaylist(pl.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenContentEditor({
  screen,
  playlists,
  onSet,
  onSettings,
}: {
  screen: Screen;
  playlists: Playlist[];
  onSet: (type: string, payload: Record<string, unknown>, playlistId: string | null) => void;
  onSettings: (patch: Partial<Screen>) => void;
}) {
  const payload = screen.current_content_payload ?? {};
  const [title, setTitle] = useState((payload.title as string) ?? "");
  const [message, setMessage] = useState((payload.message as string) ?? "");
  const [url, setUrl] = useState((payload.url as string) ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const p = screen.current_content_payload ?? {};
    setTitle((p.title as string) ?? "");
    setMessage((p.message as string) ?? "");
    setUrl((p.url as string) ?? "");
  }, [screen.id, screen.current_content_type, screen.current_content_payload]);

  return (
    <div className="space-y-2">
      {/* Content library selector — pick any site page or section */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">内容来源（页面 / 板块）</label>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs w-full"
          value={
            screen.current_content_type === "embed"
              ? ((screen.current_content_payload as { url?: string } | null)?.url ?? "")
              : ""
          }
          onChange={(e) => {
            const path = e.target.value;
            if (!path) return;
            const match = ALL_LIBRARY_ENTRIES.find((it) => it.path === path);
            onSet("embed", { url: path, title: match?.label ?? "" }, null);
          }}
        >
          <option value="">— 选择页面或板块 —</option>
          {CONTENT_LIBRARY.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((it) => (
                <option key={g.group + it.path + it.label} value={it.path}>
                  {it.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              const first = playlists[0];
              if (!first) return alert("请先创建播放列表");
              onSet("playlist", {}, first.id);
            }}
            className={`text-xs px-2 py-1 rounded border transition ${
              screen.current_content_type === "playlist"
                ? "bg-amber-200 border-amber-400 font-semibold"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            ▶ 播放列表
          </button>
          <button
            onClick={() => onSet("emergency", { title: "紧急通知", message: message || "请留意现场广播" }, null)}
            className={`text-xs px-2 py-1 rounded border transition ${
              screen.current_content_type === "emergency"
                ? "bg-red-200 border-red-400 font-semibold"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            🚨 紧急广播
          </button>
        </div>
      </div>

      {screen.current_content_type === "playlist" && (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
          value={screen.playlist_id ?? ""}
          onChange={(e) => onSet("playlist", {}, e.target.value || null)}
        >
          <option value="">— 选择播放列表 —</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.interval_seconds}秒）
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => setEditing((v) => !v)}
        className="text-xs underline text-muted-foreground"
      >
        {editing ? "收起" : "自定义链接 / 屏幕设置"}
      </button>
      {editing && (
        <div className="space-y-2 pt-1">
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="正文 / 紧急广播内容"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
          <Input
            placeholder="自定义路径（如 /retreat#xxx 或 https://...）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                onSet(
                  url ? "embed" : screen.current_content_type,
                  { title, message, url },
                  screen.playlist_id,
                )
              }
            >
              保存内容
            </Button>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={screen.orientation}
              onChange={(e) => onSettings({ orientation: e.target.value })}
            >
              <option value="landscape">横屏</option>
              <option value="portrait">竖屏</option>
            </select>
            <Input
              className="h-8 max-w-[160px]"
              value={screen.name}
              onChange={(e) => onSettings({ name: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistCard({
  playlist,
  items,
  onAddLibrary,
  onAddCustom,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onUpdate,
  onDelete,
}: {
  playlist: Playlist;
  items: PlaylistItem[];
  onAddLibrary: (entry: { label: string; path: string }) => void;
  onAddCustom: (label: string, path: string) => void;
  onUpdateItem: (id: string, patch: Partial<PlaylistItem>) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (id: string, dir: -1 | 1) => void;
  onUpdate: (patch: Partial<Playlist>) => void;
  onDelete: () => void;
}) {
  const [libPick, setLibPick] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customPath, setCustomPath] = useState("");

  return (
    <div className="border border-border/50 rounded-xl p-3 bg-background space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 max-w-[180px]"
          value={playlist.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <Input
          type="number"
          className="h-8 w-20"
          value={playlist.interval_seconds}
          onChange={(e) =>
            onUpdate({ interval_seconds: Number(e.target.value) || 10 })
          }
        />
        <span className="text-xs text-muted-foreground">秒/页</span>
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={playlist.loop_enabled}
            onChange={(e) => onUpdate({ loop_enabled: e.target.checked })}
          />
          循环播放
        </label>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          删除
        </Button>
      </div>

      <div className="space-y-1">
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground">暂无内容。从下方"内容库"选择页面/板块加入。</div>
        )}
        {items.map((it, idx) => {
          const p = it.content_payload ?? {};
          return (
            <div
              key={it.id}
              className="border border-border/40 rounded p-2 grid grid-cols-[auto,1fr,auto,auto] items-center gap-2 text-xs"
            >
              <span className="font-mono text-muted-foreground">#{idx + 1}</span>
              <Input
                className="h-7 text-xs"
                placeholder="标题"
                defaultValue={(p.title as string) ?? ""}
                onBlur={(e) =>
                  onUpdateItem(it.id, {
                    content_payload: { ...p, title: e.target.value },
                  })
                }
              />
              <Input
                className="h-7 w-16 text-xs"
                type="number"
                placeholder="秒"
                defaultValue={it.duration_seconds ?? ""}
                onBlur={(e) =>
                  onUpdateItem(it.id, {
                    duration_seconds: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <div className="flex gap-1">
                <button
                  onClick={() => onMoveItem(it.id, -1)}
                  className="px-1 text-muted-foreground hover:text-foreground"
                >
                  ↑
                </button>
                <button
                  onClick={() => onMoveItem(it.id, 1)}
                  className="px-1 text-muted-foreground hover:text-foreground"
                >
                  ↓
                </button>
                <button onClick={() => onDeleteItem(it.id)} className="text-red-600 px-1">
                  ×
                </button>
              </div>
              <div className="col-span-4">
                <Input
                  className="h-7 text-xs"
                  placeholder="页面路径"
                  defaultValue={(p.url as string) ?? ""}
                  onBlur={(e) =>
                    onUpdateItem(it.id, {
                      content_payload: { ...p, url: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Content library picker */}
      <div className="border-t border-border/40 pt-2 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">内容库</div>
        <div className="flex gap-2">
          <select
            className="h-8 rounded border border-input bg-background px-2 text-xs flex-1"
            value={libPick}
            onChange={(e) => setLibPick(e.target.value)}
          >
            <option value="">— 选择页面 / 板块 —</option>
            {CONTENT_LIBRARY.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((it) => (
                  <option key={g.group + it.path + it.label} value={it.path + "|" + it.label}>
                    {it.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!libPick) return;
              const [path, label] = libPick.split("|");
              onAddLibrary({ path, label });
              setLibPick("");
            }}
          >
            + 加入
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            className="h-8 text-xs max-w-[140px]"
            placeholder="自定义名称"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
          />
          <Input
            className="h-8 text-xs flex-1"
            placeholder="自定义路径（如 /xxx#section）"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!customPath.trim()) return;
              onAddCustom(customLabel || customPath, customPath.trim());
              setCustomLabel("");
              setCustomPath("");
            }}
          >
            + 加入
          </Button>
        </div>
      </div>
    </div>
  );
}