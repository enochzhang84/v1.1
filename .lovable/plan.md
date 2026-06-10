# 团契与小组模块 + 新人转项字段

## 一、数据库

新增表 `group_join_records`：
- id (uuid, pk)
- group_type (text, 'happiness_group' | 'grace_tea_group')
- record_date (date)
- name (text)
- gender (text, nullable)
- faith_status (text, nullable)
- joined_at (date, nullable)
- status (text, nullable) — 对聊天内容感觉怎么样
- notes (text, nullable)
- created_by (uuid, nullable, refs auth.users)
- created_at / updated_at (timestamptz)

RLS：
- super_admin / admin / worker(area='fellowship' or 通用) 可全部增删改查
- viewer 拒绝
- GRANT 给 authenticated / service_role

`registrations` 表新增列：
- `transfer_target text` — 取值：happiness_group / grace_tea_group / baptism_class / decision_record（前端做下拉显示中文）

恢复出厂时清空 `group_join_records`（更新 factory-reset.functions.ts 清单）。

## 二、后台 UI（src/routes/admin.tsx）

顶部工具栏在「主日学」与「活动」之间插入新标签「👥 团契与小组」，对应 module key 例如 `fellowship_group`。

页面包含 3 个子 Tab：
1. 幸福小组加入名单
2. 恩典茶经小组
3. 团契签到记录（复用现有 fellowship_checkins 组件/逻辑，从主日学入口移除该子 Tab）

子 Tab 1 / 2 复用同一组件 `GroupJoinRecordsPanel`，按 `group_type` 区分：
- 月历视图（参考信仰成长记录 / FaithFollowupCRM 风格）
- 表格列：日期 / 姓名 / 性别 / 信仰 / 加入时间 / 状态 / 备注 / 操作
- 新增 / 编辑（Dialog 表单）
- 删除（确认）
- 搜索（姓名 / 状态 / 备注 模糊）
- 导出 Excel（xlsx）

## 三、新人登记名单（迎宾接待）

`RegistrationListCRM` 表格增加「转项」列：
- 下拉显示：未设置 / 幸福小组 / 恩典茶经小组 / 受洗班 / 决志记录
- 内联或编辑对话框中可改
- 通过 `updateRegistration` server fn 更新（在 zod schema 增加 `transfer_target`）
- Excel 导出新增「转项」列

## 四、权限

新增 service area `fellowship`（或复用现有）。
- `SERVICE_AREAS` 增加 `fellowship`，label `团契与小组`
- 后台模块权限分配界面会自动渲染

主日学权限不再控制团契签到入口，但保留原代码兼容 fellowship_checkins 表数据。

## 五、不影响项

- 不删除 fellowship_checkins 数据 / 表
- 不修改 register.tsx 公开登记表单
- 主日学其他功能保留

## 技术细节

文件改动：
- 新建 migration（建表 + GRANT + RLS + 加列 + service_area enum 若需）
- 新建 `src/components/admin/GroupJoinRecordsPanel.tsx`
- 编辑 `src/routes/admin.tsx`（工具栏顺序 + 新模块视图 + 主日学移除团契签到子 tab）
- 编辑 `src/components/admin/RegistrationListCRM.tsx`（转项列与编辑）
- 编辑 `src/lib/registrations.functions.ts`（zod 增加 transfer_target）
- 编辑 `src/lib/permissions.ts`（增加 fellowship area）
- 编辑 `src/lib/factory-reset.functions.ts`（清空清单加 group_join_records）
- 等 types.ts 自动重生后再写依赖新字段的代码
