// 角色与事工模块定义 — 服务端与前端共用

export type Role = "super_admin" | "admin" | "worker" | "viewer";

export const SERVICE_AREAS = [
  "newcomer",
  "retreat",
  "kitchen",
  "welcome",
  "media",
  "sunday_school",
  "fellowship",
  "tv_display",
  "chat",
] as const;
export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const SERVICE_AREA_LABELS: Record<ServiceArea, string> = {
  newcomer: "新人登记",
  retreat: "退修会",
  kitchen: "厨房 / 订餐",
  welcome: "迎宾接待",
  media: "影音投影",
  sunday_school: "主日学",
  fellowship: "团契与小组",
  tv_display: "TV 屏幕管理",
  chat: "同工聊天",
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "超级管理员",
  admin: "管理员",
  worker: "同工",
  viewer: "访客",
};

export function isServiceArea(v: unknown): v is ServiceArea {
  return typeof v === "string" && (SERVICE_AREAS as readonly string[]).includes(v);
}

/** 是否可以进入 /admin 后台。viewer 与未登录均不可。 */
export function canAccessAdmin(role: Role | null): boolean {
  return role === "super_admin" || role === "admin" || role === "worker";
}

/** 是否可以访问指定事工模块 */
export function canAccessModule(
  role: Role | null,
  area: ServiceArea | null,
  target: ServiceArea,
): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "worker") return area === target;
  return false;
}

/** 是否可以管理其他用户（创建/改角色/删除） */
export function canManageUsers(role: Role | null): boolean {
  return role === "super_admin";
}

/** 是否可以查看「某模块」的统计分析。
 * - super_admin / admin → 永远 true
 * - worker → 必须属于该模块，且该模块的 analytics flag = true
 */
export function canAccessModuleAnalytics(
  role: Role | null,
  area: ServiceArea | null,
  target: ServiceArea,
  analyticsMap: Partial<Record<ServiceArea, boolean>>,
): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "worker") {
    return area === target && analyticsMap[target] === true;
  }
  return false;
}