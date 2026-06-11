// 统一二维码注册表 helper。
// 设计：数据库只存 route_path，运行时与 getPublicOrigin() 拼接得到完整 URL。
// 更换正式域名时，只需更新 app_settings.auth_base_url，所有二维码同步切换。
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/public-origin";

export type QrRegistryItem = {
  id: string;
  name: string;
  route_path: string;
  module: string | null;
  is_system: boolean;
  sort_order: number;
};

/** 系统内置二维码兜底（与初始 seed 一致），万一表读取失败也能展示。 */
export const BUILTIN_QR_REGISTRY: Array<Omit<QrRegistryItem, "id">> = [
  { name: "新人登记", route_path: "/register", module: "newcomer", is_system: true, sort_order: 10 },
  { name: "退修会登记", route_path: "/retreat-register", module: "retreat", is_system: true, sort_order: 20 },
  { name: "主日签到", route_path: "/sunday-checkin", module: "sunday", is_system: true, sort_order: 30 },
  { name: "团契 / 小组签到", route_path: "/fellowship-checkin", module: "fellowship", is_system: true, sort_order: 40 },
  { name: "成人主日学（春季）", route_path: "/adult-checkin/summer", module: "sunday", is_system: true, sort_order: 50 },
  { name: "成人主日学（秋季）", route_path: "/adult-checkin/fall", module: "sunday", is_system: true, sort_order: 60 },
  { name: "服务申请", route_path: "/serve-apply", module: "ministry", is_system: true, sort_order: 70 },
  { name: "问题反馈", route_path: "/feedback", module: "feedback", is_system: true, sort_order: 80 },
];

export function buildQrUrl(routePath: string, origin?: string): string {
  const base = (origin ?? getPublicOrigin()).replace(/\/+$/, "");
  const path = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${base}${path}`;
}

export async function loadQrRegistry(): Promise<QrRegistryItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("qr_registry")
      .select("id, name, route_path, module, is_system, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) return data as QrRegistryItem[];
  } catch { /* fall through */ }
  // 兜底：返回内置项（用 route_path 做 id）
  return BUILTIN_QR_REGISTRY.map((it) => ({ ...it, id: it.route_path }));
}
