## 目标

为 HOC3 V2.0 母版增加「首次系统开通向导」，让母版复制到任何教会时：
- 首位 super_admin 注册时一次性完成账号 + 教会信息 + 认证域名 配置
- 之后所有认证邮件（找回密码、邮箱验证、邀请）统一使用 `auth_base_url`，不再跳到 Lovable Preview / localhost / 写死域名

## 一、数据层

### 1. 扩展 `app_settings` 表（key/value 结构）
检查现有结构后，使用统一 key 写入以下系统设置（若已是 key/value 表则只插入数据，若为列式表则迁移新增列）：

教会资料：
- `church_name_cn`, `church_name_en`, `church_phone`, `church_email`, `church_website`, `church_address`, `sunday_service_time`

认证 & 邮件：
- `auth_base_url`（如 `https://hoc3.org`，末尾不带 `/`）
- `email_sender_name`（如 `HOC3 Ministry Center`）
- `reply_to_email`（默认 = `church_email`）

新增 `setup_completed`（布尔）作为「向导是否完成」的明确标志，避免依赖 `user_roles` 是否为空的隐式判断。

### 2. RPC `public.is_system_initialized()`（SECURITY DEFINER，anon 可调用）
返回布尔：`setup_completed = true` 或 `user_roles` 中存在 `super_admin` 任一为真即视为已初始化。供前端在未登录状态下安全判断是否显示向导。

### 3. RPC `public.complete_initial_setup(payload jsonb)`（SECURITY DEFINER，anon 可调用）
- 入参：所有教会信息 + 认证/邮件设置 + `admin_user_id`（前端 signUp 成功后传入）
- 行为（事务）：
  1. 再次校验 `is_system_initialized() = false`，否则 raise exception
  2. 写入 / upsert 所有 `app_settings`
  3. 确保该 user_id 在 `user_roles` 表中拥有 `super_admin`（依赖现有 `handle_new_user` trigger 在表空时自动赋权；此处兜底 upsert）
  4. 写入 `setup_completed = true`

## 二、前端流程

### 1. 新增 `/setup` 路由（公开，3 步向导）
- Step 1: 创建超级管理员 — 姓名 / 邮箱 / 密码 / 确认密码 → 调用 `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- Step 2: 教会信息 — 7 个字段
- Step 3: 认证与邮件 — `auth_base_url` / `email_sender_name` / `reply_to_email`（默认带入 church_email）
- 完成：调用 `complete_initial_setup` RPC → 跳转 `/login`

### 2. `/login` 守卫
进入 `/login` 时先调用 `is_system_initialized` RPC：
- 若 `false` → 自动 `redirect` 到 `/setup`
- 若 `true` → 显示现有管理员登录页

`/setup` 反向守卫：若已初始化，自动跳 `/login`。

### 3. 找回密码 / 邮件统一读取 `auth_base_url`
新增 `src/lib/auth-base-url.ts`：
```ts
export async function getAuthBaseUrl(): Promise<string>
```
- 从 `app_settings` 读取 `auth_base_url`
- 兜底顺序：app_settings → `VITE_PUBLIC_SITE_URL` env → 抛错（不再 fallback 到 `window.location.origin`）
- 内部缓存（模块级 Promise）

替换 `src/lib/public-origin.ts` 中所有「`window.location.origin` 兜底」逻辑，改为读取 `auth_base_url`。

调用方更新：
- `src/routes/forgot-password.tsx`：`resetPasswordForEmail(email, { redirectTo: \`${authBaseUrl}/reset-password\` })`
- `src/routes/login.tsx`：同上
- `src/routes/lovable/email/auth/webhook.ts`：所有链接生成读取 `auth_base_url`，邮件主题/正文中的「系统名称 / 教会中文名 / Reply-To」也从 `app_settings` 读取
- `src/lib/email-templates/recovery.tsx`：标题改为 `重置您的 ${email_sender_name} 管理员密码`，正文 `您正在重置「${church_name_cn}」后台管理员密码`

### 4. 后台「系统设置」入口
在 `/admin` 下新增 `/admin/settings/church`（教会资料）和 `/admin/settings/auth`（认证设置）两页，仅 super_admin 可访问，用于以后修改向导填写的所有字段。

## 三、初始化（恢复出厂）规则

新增 super_admin 专用 RPC `public.factory_reset()`（SECURITY DEFINER，仅 super_admin 可调用）：
- 保留：`user_roles`、`user_profiles`、`app_settings`（教会资料 + 认证设置）、`home_page_settings`、`home_page_content`、`site-assets`（Logo）、`qr_library`、`qr_categories`
- 清空：`registrations`、`retreat_registrations`、`attendance_records`、`sunday_school_checkins`、`adult_class_checkins`、`fellowship_checkins`、`chat_messages`、`messages`、`feedbacks`、`contacts`、`decisions`、`baptisms`、其他历史业务表

（本轮先实现 RPC + 后台按钮入口；具体清空表清单按上方明示。）

## 四、安全/边界

- `complete_initial_setup` 与 `is_system_initialized` 都用 SECURITY DEFINER，并 `GRANT EXECUTE TO anon, authenticated`
- `complete_initial_setup` 内部再次校验「未初始化」，防止并发或绕过前端二次调用
- `auth_base_url` 写入时去除末尾 `/`，前端拼接 `/reset-password` 时保证只有一个 `/`
- 不写入任何 Lovable / Supabase 字样到面向用户的文案

## 五、本轮交付清单

1. 一个 SQL migration：扩展/约定 `app_settings` 用法 + `is_system_initialized` + `complete_initial_setup` + `factory_reset` RPC + grants
2. 新文件：`src/lib/auth-base-url.ts`、`src/routes/setup.tsx`、`src/routes/_authenticated/admin/settings.church.tsx`、`src/routes/_authenticated/admin/settings.auth.tsx`
3. 修改：`src/routes/login.tsx`（初始化守卫 + 用 authBaseUrl）、`src/routes/forgot-password.tsx`、`src/routes/lovable/email/auth/webhook.ts`、`src/lib/email-templates/recovery.tsx`、`src/lib/public-origin.ts`
4. `/admin` 侧栏增加「系统设置 → 教会资料 / 认证设置」入口

## 六、需要您确认的两个点

1. `app_settings` 当前是 key/value 结构（3 列：key/value/...）还是列式？我会先读它的实际 schema 再决定是 INSERT key/value 还是 ALTER TABLE 加列。
2. 「恢复出厂设置」本轮是否一起实现？还是只搭好开通向导，工厂重置留到下一轮？

如果您直接回复「按计划执行，app_settings 由你决定，工厂重置一起做」，我就开始落地。
