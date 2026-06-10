## 团契与小组模块优化 — 自动化牧养漏斗

将新人登记打通到后续所有跟进模块，实现「只登记一次，全流程自动关联」。

---

### 一、数据库变更（一次迁移）

**1. `group_join_records` 表新增字段：**
- `follow_up_status text` — 跟进状态，默认 `'待邀请'`
- `status_note text` — 状态备注（如「工作忙/出差」）
- `attended_count int default 0` — 参加次数
- `last_attended_at date` — 最近参加日期
- `source_registration_id uuid` — 关联 registrations.id（用于自动建档去重）
- `transferred_out boolean default false` — 是否已转出

**2. `registrations` 表：**
- `transfer_target` 字段已存在，作为唯一「转项」入口。
- 不再额外加字段。

**3. 新增信仰成长档案表 `faith_growth_profiles`（如果项目里没有现成可复用表，则新建）：**
- `id, registration_id (uuid, unique), name, phone, email, registered_at, faith_status, notes, created_at, updated_at`
- RLS：super_admin / admin / worker(area='newcomer' 或 'fellowship') 可读写。
- GRANT authenticated / service_role。
> 若仓库中已有 `FaithFollowupCRM` 对应的表（如 `faith_followups`），则复用并只补字段，不新建。实现阶段会先查证。

**4. 触发器 `trg_registration_autoflow`（AFTER INSERT/UPDATE OF transfer_target, faith ON registrations）：**

逻辑：
- INSERT 时：
  - 自动 upsert `faith_growth_profiles`（按 registration_id 去重）。
  - 若 `faith = 'seeker'`（慕道友），自动 insert `group_join_records`：
    - `group_type='happiness_group'`, `follow_up_status='待邀请'`, `source_registration_id=NEW.id`, `record_date=today`。
- UPDATE `transfer_target` 时：
  - 找到该 registration 关联的 happiness_group / grace_tea_group 记录，标记原记录 `transferred_out=true`、`follow_up_status='已转出'`。
  - 根据新 `transfer_target` 自动在目标表插入新记录：
    - `happiness_group` → group_join_records (happiness)
    - `grace_tea_group` → group_join_records (grace_tea)
    - `baptism_class` → decisions/baptisms（若表存在则插入待跟进，否则仅写入 faith profile 备注）
    - `decision_record` → decisions 表
  - 同名记录用 `source_registration_id` 去重，避免重复创建。

**5. `group_join_records` 状态变更触发器：**
- 当 `follow_up_status` 改为 `'已参加'` 时：`attended_count = attended_count + 1`，`last_attended_at = today`。

---

### 二、UI 变更

**`GroupJoinRecordsPanel.tsx`：**
- 表格新增「跟进状态」列，下拉直接编辑：
  待邀请 / 已邀请 / 已参加 / 未参加 / 持续跟进 / 转团契 / 转受洗班 / 暂停跟进 / 失联 / 已转出
- 表格新增「参加次数」「最近参加」两列（只读）。
- 编辑弹窗加入「跟进状态」「状态备注」字段。
- 来自自动登记的记录显示一个小标签「← 登记自动创建」。

**`RegistrationListCRM.tsx`：**
- 「转项」下拉已存在 — 更新文案，添加提示「修改后将自动建立对应跟进记录」。
- 列表新增显示「跟进进度」徽章（根据 registration_id 在 group_join_records / decisions / baptisms 出现的状态汇总）。

**新增牧养漏斗统计组件 `MinistryFunnelStats.tsx`：**
- 位置：数据统计模块顶部。
- 一个垂直/横向漏斗图：新人登记 → 幸福小组 → 恩典茶经小组 → 决志 → 受洗 → 加入服事。
- 每层显示总人数 + 上层转化率。
- 数据源：分别 count(registrations) / count(group_join_records by type) / count(decisions) / count(baptisms) / count(service_applications approved)。

---

### 三、保护与兼容

- 触发器使用 `SECURITY DEFINER` 并 `SET search_path = public`。
- 所有自动写入用 `ON CONFLICT (source_registration_id, group_type) DO NOTHING`（先加唯一索引）避免重复。
- 不影响现有手动新增流程。
- 工厂重置已包含 `group_join_records`，新增 `faith_growth_profiles`（若新建）也加入清理列表。

---

### 四、技术清单

- 1 个 migration：加字段 + 唯一索引 + 触发器 + 可能的新表。
- 编辑：`src/components/admin/GroupJoinRecordsPanel.tsx`、`src/components/admin/RegistrationListCRM.tsx`。
- 新建：`src/components/admin/analytics/MinistryFunnelStats.tsx`，并挂载到 `src/routes/admin.tsx` 数据统计标签页顶部。
- 更新：`src/lib/factory-reset.functions.ts`（如新增表）。

请确认后我会先发起 migration（需要您批准），再写代码。
