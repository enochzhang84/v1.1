## 目标

在后台新增一个「二维码自动检测工具」，一键检测全部二维码是否真的可用，包括：链接可达、是否跳 Lovable 登录页、新人登记是否能成功写入数据库、并自动清理测试数据。

## 实施范围

只新增，不改旧的（沿用之前确定的「只新增不动旧的」策略）。

### 1. 数据库变更（一个 migration）

**registrations 表新增字段**
- `is_test boolean not null default false` — 测试数据标记
- 后台名单 / 统计查询「不自动」改，先在 UI 层加 `eq('is_test', false)` 过滤（避免影响现有 RLS / 触发器逻辑）。如果后续要全局隐藏，再补一轮。

**新增表 `qr_test_logs`**
字段：`id, qr_name, qr_url, final_url, status (ok|warn|fail), http_status, error_message, entered_form_page, submitted_successfully, database_inserted, test_record_id, cleaned_up, created_at, created_by`

RLS：
- 只有 admin / super_admin 能 SELECT / INSERT
- 配套 GRANT 给 authenticated / service_role

### 2. 服务端逻辑 `src/lib/qr-autotest.functions.ts`

3 个 server function，全部 `requireSupabaseAuth`：

- `qrProbeUrl({ url })` — admin+：服务端 fetch URL（避免浏览器 CORS），返回 `{ httpStatus, finalUrl, redirected, error }`。判定 finalUrl 是否含 `lovable.app/login`、`lovableproject.com`、`/auth`、`/login`、`/admin` 等。
- `qrSubmitTestRegistration({ qrName, qrUrl })` — **仅 super_admin**：用 `supabaseAdmin` 写入一条 `is_test=true` 的 registration（姓名「系统测试」、邮箱 `qr-test+<ts>@lioneapps.com`、备注「二维码自动检测测试数据，请勿跟进」），返回 `insertedId`。
- `qrCleanupTestRegistration({ id })` — super_admin：删除该测试记录，返回 `cleanedUp`。
- 每步执行后写一条 `qr_test_logs`。

### 3. 前端组件 `src/components/admin/QrAutoTestPanel.tsx`

收集二维码（沿用 QrHealthCheckPanel 的来源逻辑）：主页新人/退修会、系统内置（sunday-checkin / fellowship-checkin）、`qr_library` 全部记录。

按钮：
1. 检测所有二维码（仅链接）
2. 完整检测（含提交测试数据，仅 super_admin 可见）
3. 查看检测日志（读 `qr_test_logs` 最近 50 条）

每行展示：名称 / URL / HTTP / finalUrl / 是否进入登记页 / 是否提交成功 / 是否入库 / 是否清理 / 状态徽章（🟢🟡🔴）。

URL 包含 `lovable.app`/`lovableproject.com`/`localhost`/`127.0.0.1` → 🟡 警告。
finalUrl 跳到 `/auth`、`/login`、`/admin` 或 Lovable 登录页 → 🔴 失败 + 提示「可能进入登录界面」。

新人登记二维码的「完整检测」流程：
1. 探测 URL
2. 抓取 HTML，正则检查是否包含「姓名 / 电话 / 邮箱 / 信仰 / 婚姻 / 介绍人 / 提交」等关键字段（轻量字段存在性检查，不真的填表）
3. 调用 `qrSubmitTestRegistration`（=直接 INSERT，模拟前台提交效果）
4. 用 service role 查询 `registrations` 确认入库
5. 调用 `qrCleanupTestRegistration` 删除；失败则标注「测试数据未清理」

### 4. 接入点

`HomePageSettingsPanel` 二维码管理区新增「自动检测」入口，挂载 `<QrAutoTestPanel />`。不动旧的 `QrHealthCheckPanel` / `UnifiedQrInspector`。

## 不做的事

- 不真的模拟手机端填表（用直接 INSERT 等价代替，更稳定）
- 不改 RLS 现有策略 / 不动 `registrations_autoflow` 触发器
- 不全局隐藏 is_test（先 UI 过滤，避免误伤）
- 不动正式域名 / 不动 `public-origin.ts`

## 风险

- `registrations_autoflow` 触发器会因 `faith=seeker` 自动写 `group_join_records`。测试数据 faith 留空即可避免触发；额外在清理时同样按 `source_registration_id` 清掉可能的孤儿。
- 服务端 fetch lovableproject.com 不一定能精确判断「微信里会不会跳登录」（那是平台对外部浏览器的拦截），只能根据响应内容/重定向尽力识别——会在 UI 上注明。

确认后我开始实现。