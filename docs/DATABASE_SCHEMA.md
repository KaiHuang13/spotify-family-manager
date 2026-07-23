# 第一階段資料庫 Schema 草案

## 1. 文件定位

本文件依據 `PRODUCT_REQUIREMENTS.md`、`requirements.md`、`business-rules.md`、`DECISIONS.md`、`DATA_MODEL_DRAFT.md` 與 `architecture.md`，提出第一階段最小 PostgreSQL 資料模型。

本文件僅為設計草案：

- 不代表已建立資料庫。
- 不包含可執行 SQL。
- 不建立或執行 Migration。
- 正式實作時，所有資料表、Constraint、Index、Trigger、Function 與 RLS Policy 都必須透過 Migration 建立並測試。

## 2. 設計原則

- 第一階段只有一位管理者，但所有業務表仍保留 `owner_id`，以 `auth.uid()` 作為 RLS 邊界。
- 主鍵原則上使用 `uuid`，預設由 `gen_random_uuid()` 產生。
- 所有金額以最小貨幣單位整數保存，使用 `bigint` 並以 `_minor` 結尾；新臺幣 50 元保存為 `50`，不得使用浮點數。
- 貨幣使用三碼 ISO 4217 代碼，第一階段預設 `TWD`。
- 純帳務日期使用 `date`；事件時間使用 `timestamptz`。
- 日期區間採半開區間：`start_date` 包含、`end_date` 不包含。若 `end_date` 為空，代表目前仍有效。
- 財務與歷史資料不得硬刪除；使用停用、作廢或反向分錄保留軌跡。
- 付款狀態由應收金額、有效付款分配與到期日推導，不另外維護可手動編輯的狀態欄位。
- `created_at`、`updated_at` 預設由資料庫維護，不信任前端提供的時間。

## 3. 第一階段資料表

核心資料表共八張：

1. `profiles`
2. `subscriptions`
3. `members`
4. `subscription_members`
5. `billing_periods`
6. `member_charges`
7. `payments`
8. `audit_logs`

若未來需要讓一筆真實付款跨多筆應收，需再加入關聯表：

9. `payment_allocations`

第二份 Migration 尚未建立 `payment_allocations`。目前以多筆 `payments` 直接指向同一筆 `member_charges` 支援部分付款；一筆付款跨多筆應收及單筆年繳款分配十二個月份仍屬後續擴充。

## 4. 關係概覽

```text
auth.users
  └─ profiles
      ├─ subscriptions
      │   ├─ subscription_members ── members
      │   └─ billing_periods
      │       └─ member_charges ── subscription_members
      ├─ members
      ├─ payments ── member_charges
      │   └─ payment_allocations（後續擴充）
      └─ audit_logs
```

## 5. 資料表詳細設計

### 5.1 `profiles`

#### 用途

保存應用程式需要的管理者設定，與 Supabase Auth 的 `auth.users` 一對一。第一階段只有一位管理者，但不將管理者 UUID 寫死在其他資料中。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | 無 | 同時是主鍵與 Auth user UUID |
| `display_name` | `text` | 是 | 無 | 管理者顯示名稱 |
| `default_currency` | `char(3)` | 是 | `TWD` | 預設貨幣代碼 |
| `business_timezone` | `text` | 是 | `Asia/Taipei` | 到期與報表使用的 IANA 時區 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`id` → `auth.users.id`。
- Unique Constraint：主鍵已保證每個 Auth user 只有一份 profile，不需額外唯一限制。
- Index：主鍵索引已足夠；第一階段不需額外索引。
- Check：`default_currency` 必須為三個大寫英文字母。

#### 刪除策略

建議 `ON DELETE RESTRICT`。管理者仍有任何業務或帳務歷史時，不允許直接刪除 Auth user 或 profile；應先完成明確的資料封存流程。

#### 關係

- 一個 `profile` 擁有多個 `subscriptions`、`members`、`billing_periods`、`payments` 與 `audit_logs`。
- 所有業務表的 `owner_id` 都指向本表 `id`。

### 5.2 `subscriptions`

#### 用途

保存管理者持有的 Spotify Premium Family 方案及目前設定。第一階段不建立獨立 `services` 表，而以 `service_code` 表示 Spotify，以降低最初複雜度。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `service_code` | `text` | 是 | `spotify` | 服務穩定代碼 |
| `plan_name` | `text` | 是 | `Spotify Premium Family` | 方案顯示名稱 |
| `status` | `text` | 是 | `active` | `active` 或 `inactive` |
| `seat_limit` | `smallint` | 是 | `6` | 方案總名額，包含管理者 |
| `current_cost_minor` | `bigint` | 是 | 無 | 目前每個供應商帳期的方案總費用 |
| `currency` | `char(3)` | 是 | `TWD` | 方案貨幣 |
| `provider_billing_cycle` | `text` | 是 | `monthly` | Spotify 向管理者收費週期 |
| `current_cost_effective_from` | `date` | 是 | 無 | 目前費用開始生效日 |
| `started_on` | `date` | 是 | 無 | 方案開始日 |
| `ended_on` | `date` | 否 | `NULL` | 方案結束日，不包含 |
| `notes` | `text` | 否 | `NULL` | 管理備註 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`。
- Unique Constraint：`(owner_id, service_code, started_on)`，避免同一開始日重複建立相同服務方案。
- Partial Unique Index：同一 `owner_id`、`service_code` 最多一筆 `status = 'active'` 的方案。
- Index：`(owner_id, status)`、`(owner_id, service_code)`。
- Check：`seat_limit > 0`、`current_cost_minor >= 0`、貨幣為三碼大寫、`ended_on > started_on` 或為空。

#### 刪除策略

一旦有成員資格或帳期，採 `ON DELETE RESTRICT`。停止使用時將 `status` 改為 `inactive` 並填寫 `ended_on`，不可連帶刪除歷史帳期。

#### 關係

- 一個 `subscription` 有多筆 `subscription_members`。
- 一個 `subscription` 有多筆 `billing_periods`。

### 5.3 `members`

#### 用途

保存 Spotify Family 成員主檔。成員資料與訂閱期間分開，以支援退出後重新加入、未來多方案及保留歷史。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `display_name` | `text` | 是 | 無 | 姓名或暱稱 |
| `contact_email` | `text` | 否 | `NULL` | 選填聯絡 Email，不作登入帳號 |
| `contact_note` | `text` | 否 | `NULL` | 其他最少必要聯絡資訊 |
| `is_owner` | `boolean` | 是 | `false` | 是否為方案管理者本人 |
| `joined_on` | `date` | 否 | `NULL` | 成員加入日期；既有資料可能未知，新建流程必填 |
| `status` | `text` | 是 | `active` | `active` 或 `inactive` |
| `deactivated_on` | `date` | 否 | `NULL` | 停用日期 |
| `notes` | `text` | 否 | `NULL` | 管理備註 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`。
- Unique Constraint：不以姓名或 Email 強制唯一，避免同名與共用聯絡資料造成錯誤。
- Partial Unique Index：每個 `owner_id` 最多一筆 `is_owner = true` 的成員。
- Index：`(owner_id, status)`、`(owner_id, display_name)`。
- Check：`status = 'inactive'` 時應有 `deactivated_on`；啟用中原則上不填停用日。

#### 刪除策略

只要已有 `subscription_members`、`member_charges`、`payments` 或稽核紀錄，就使用 `ON DELETE RESTRICT`。成員離開時改為 `inactive`，不得硬刪除。

#### 關係

- 一個 `member` 可有多段 `subscription_members`。
- 一個 `member` 可有多筆 `payments`。
- 應收紀錄透過 `subscription_members` 連回成員。

### 5.4 `subscription_members`

#### 用途

保存成員參與特定方案的一段有效期間、月繳或年繳選擇及該期間的約定價格。退出後重新加入或調整價格時新增一筆期間，不覆寫舊資料。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `subscription_id` | `uuid` | 是 | 無 | 所屬方案 |
| `member_id` | `uuid` | 是 | 無 | 所屬成員 |
| `start_date` | `date` | 是 | 無 | 訂閱開始日，包含 |
| `end_date` | `date` | 否 | `NULL` | 資格結束日，不包含 |
| `payment_frequency` | `text` | 否 | `NULL` | 帳務設定完成後為 `monthly` 或 `yearly` |
| `monthly_share_minor` | `bigint` | 否 | `NULL` | 帳務設定完成後保存每月應認列的成員分攤金額 |
| `cycle_amount_minor` | `bigint` | 否 | `NULL` | 帳務設定完成後保存每次收款週期應收總額 |
| `currency` | `char(3)` | 否 | `NULL` | 帳務設定完成後保存約定貨幣 |
| `billing_anchor_date` | `date` | 否 | `NULL` | 月繳首期或年繳週年的帳務起算基準；不是一般訂閱開始日期 |
| `notes` | `text` | 否 | `NULL` | 例外規則或人工調整說明 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`subscription_id` → `subscriptions.id`；`member_id` → `members.id`。
- Unique Constraint：`(subscription_id, member_id, start_date)`。
- Exclusion Constraint：同一 `subscription_id`、`member_id` 的有效日期區間不可重疊。這不是一般 Unique Constraint，正式 Migration 需以 PostgreSQL range／exclusion 能力實作。
- Partial Unique Index：同一方案與成員最多一筆 `end_date IS NULL` 的有效資格。
- Index：`(subscription_id, start_date, end_date)`、`(member_id, start_date DESC)`、`(owner_id, payment_frequency)`。
- Check：帳務欄位必須全部為空或全部完成設定；已設定時金額不得為負、貨幣為三碼大寫、月繳時 `cycle_amount_minor = monthly_share_minor`、年繳時原則上 `cycle_amount_minor` 等於十二個月分配合計。結束日須晚於開始日。

#### 刪除策略

已有 `member_charges` 時採 `ON DELETE RESTRICT`。成員退出時填寫 `end_date`；價格、頻率或起算規則改變時關閉舊期間並新增新期間。

#### 關係

- 每筆資格屬於一個 `subscription` 與一個 `member`。
- 一筆資格可產生多筆 `member_charges`。

### 5.5 `billing_periods`

#### 用途

保存 Spotify 方案的每個供應商帳期及當期實際總成本快照。它回答「管理者該期付給 Spotify 多少」，不等同個別成員的應收。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `subscription_id` | `uuid` | 是 | 無 | 所屬方案 |
| `period_start` | `date` | 是 | 無 | 帳期開始日，包含 |
| `period_end` | `date` | 是 | 無 | 帳期結束日，不包含 |
| `due_date` | `date` | 否 | `NULL` | 成員應收到期日；舊資料可能未知，新建帳期流程必填 |
| `provider_cost_minor` | `bigint` | 是 | 無 | 該期 Spotify 實際總費用快照 |
| `currency` | `char(3)` | 是 | `TWD` | 該期貨幣快照 |
| `status` | `text` | 是 | `draft` | `draft`、`confirmed`、`closed` 或 `void` |
| `confirmed_at` | `timestamptz` | 否 | `NULL` | 確認時間 |
| `voided_at` | `timestamptz` | 否 | `NULL` | 作廢時間 |
| `void_reason` | `text` | 否 | `NULL` | 作廢原因 |
| `notes` | `text` | 否 | `NULL` | 帳期備註 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`subscription_id` → `subscriptions.id`。
- Unique Constraint：`(subscription_id, period_start, period_end)`。
- Exclusion Constraint：同一方案的有效帳期不可重疊；作廢帳期可依正式規則排除。
- Index：`(subscription_id, period_start DESC)`、`(owner_id, status, period_start DESC)`。
- Check：`period_end > period_start`、`due_date` 不得早於開始日、`provider_cost_minor >= 0`、貨幣為三碼大寫；`status = 'confirmed'` 或 `closed` 時必須有 `confirmed_at`；`status = 'void'` 時必須有作廢資訊。

#### 刪除策略

一旦確認或已產生 `member_charges`，採 `ON DELETE RESTRICT`。錯誤帳期改為 `void`，不硬刪除。

#### 關係

- 每個帳期屬於一個 `subscription`。
- 一個帳期包含多筆 `member_charges`。

### 5.6 `member_charges`

#### 用途

保存成員在特定月份的應收與收入認列金額快照。月繳通常每月一筆；年繳也拆成十二筆月度應收／認列資料，再由同一筆年繳付款分配至各月。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `subscription_id` | `uuid` | 是 | 無 | 所屬方案，用於跨表擁有者與方案一致性 |
| `billing_period_id` | `uuid` | 是 | 無 | 對應 Spotify 帳期 |
| `subscription_member_id` | `uuid` | 是 | 無 | 產生應收時依據的成員資格版本 |
| `collection_cycle_id` | `uuid` | 是 | `gen_random_uuid()` | 將同一次月繳或年繳應收群組化 |
| `cycle_sequence` | `smallint` | 是 | `1` | 在收款週期中的月份序號 |
| `cycle_length` | `smallint` | 是 | `1` | 月繳為 1，年繳通常為 12 |
| `coverage_start` | `date` | 是 | 無 | 本筆金額涵蓋開始日 |
| `coverage_end` | `date` | 是 | 無 | 本筆金額涵蓋結束日，不包含 |
| `amount_minor` | `bigint` | 是 | 無 | 本月應收／認列金額快照 |
| `currency` | `char(3)` | 是 | `TWD` | 貨幣快照 |
| `due_date` | `date` | 是 | 無 | 該收款週期到期日；年繳十二筆可共用同一到期日 |
| `payment_frequency_snapshot` | `text` | 是 | 無 | 產生時的 `monthly` 或 `yearly` |
| `calculation_method` | `text` | 是 | `fixed` | 例如 `fixed`、`owner_remainder`、`manual` |
| `calculation_snapshot` | `jsonb` | 是 | 空物件 | 保存版本、原月額、年額、席次與差額處理等可重現依據 |
| `voided_at` | `timestamptz` | 否 | `NULL` | 作廢時間 |
| `void_reason` | `text` | 否 | `NULL` | 作廢原因 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`(billing_period_id, owner_id, subscription_id)` → `billing_periods`；`(subscription_member_id, owner_id, subscription_id)` → `subscription_members`。複合外鍵確保三者屬於同一管理者與方案。
- Unique Constraint：`(billing_period_id, subscription_member_id)`，避免同一成員資格在同一帳期重複產生費用。若未來允許同期多項調整，需改用有效列 Partial Unique Index。
- Index：`(subscription_member_id, coverage_start DESC)`、`(collection_cycle_id, cycle_sequence)`、`(owner_id, due_date)`、`(billing_period_id)`。
- Check：`amount_minor >= 0`、`coverage_end > coverage_start`、`cycle_length > 0`、`cycle_sequence BETWEEN 1 AND cycle_length`、貨幣為三碼大寫；作廢時必須有原因。

#### 刪除策略

一旦確認或已有付款，採 `ON DELETE RESTRICT`。錯誤應收使用作廢；需要財務更正時，正式實作應採作廢重建或反向調整，不覆寫已付款歷史。

#### 關係

- 每筆應收屬於一個 `billing_period` 與一個 `subscription_member`。
- 一筆應收可接受多筆 `payments`，因此可支援部分付款。
- `collection_cycle_id` 將同一次年繳對應的十二筆月度應收分組。

### 5.7 `payments`

#### 用途

保存管理者手動登記的實際收款事件。第二份 Migration 的最小模型讓每筆付款直接屬於一筆成員應收；同一應收可有多筆付款。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `member_charge_id` | `uuid` | 是 | 無 | 本次付款對應的成員應收 |
| `amount_minor` | `bigint` | 是 | 無 | 實際收到總額 |
| `currency` | `char(3)` | 是 | `TWD` | 付款貨幣 |
| `paid_at` | `timestamptz` | 是 | 無 | 實際付款時間 |
| `payment_method` | `text` | 否 | `NULL` | 現金、轉帳或管理者自訂標記 |
| `reference` | `text` | 否 | `NULL` | 選填外部交易參考，不保存敏感銀行資料 |
| `notes` | `text` | 否 | `NULL` | 備註 |
| `status` | `text` | 是 | `posted` | `posted` 或 `void` |
| `voided_at` | `timestamptz` | 否 | `NULL` | 作廢時間 |
| `void_reason` | `text` | 否 | `NULL` | 作廢原因 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |
| `updated_at` | `timestamptz` | 是 | `now()` | 最後更新時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`(member_charge_id, owner_id, currency)` → `member_charges`，確保付款與應收的擁有者及貨幣一致。
- Unique Constraint：第一階段不強制 `reference` 唯一，因現金付款可能沒有參考碼，且不同來源可能重複。若日後串接金流，再建立來源加外部交易 ID 的複合唯一限制。
- Index：`(member_charge_id, paid_at DESC)`、`(owner_id, paid_at DESC)`、`(owner_id, status)`。
- Check：`amount_minor > 0`、貨幣為三碼大寫；`status = 'void'` 時必須有 `voided_at` 與原因。

#### 刪除策略

付款一旦建立即不可硬刪除。誤登付款改為 `void`；若需更正，建立替代付款並保留稽核紀錄。

#### 關係

- 每筆付款直接屬於一個 `member_charge`，付款成員可由應收的 `subscription_member` 關係取得。
- 同一筆應收可有多筆獨立付款。
- 目前一筆付款不能跨多筆應收；需要此能力時再新增 `payment_allocations` 並以新 Migration 調整關聯。

### 5.8 `payment_allocations`（後續擴充，尚未建立）

#### 用途

未來若需要讓一筆真實付款跨多筆應收，使用本表保存付款與成員應收之間的金額分配。第二份 Migration 不建立此表。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 是 | `gen_random_uuid()` | 主鍵 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `payment_id` | `uuid` | 是 | 無 | 付款 |
| `member_charge_id` | `uuid` | 是 | 無 | 被支付的應收 |
| `allocated_amount_minor` | `bigint` | 是 | 無 | 本次分配金額 |
| `reversed_at` | `timestamptz` | 否 | `NULL` | 取消分配時間 |
| `reversal_reason` | `text` | 否 | `NULL` | 取消原因 |
| `created_at` | `timestamptz` | 是 | `now()` | 建立時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`payment_id` → `payments.id`；`member_charge_id` → `member_charges.id`。
- Unique Constraint：同一付款與應收只保留一筆有效分配；可使用 `(payment_id, member_charge_id)` 的 Partial Unique Index 排除已反向分配。
- Index：`(payment_id)`、`(member_charge_id)`、`(owner_id, created_at DESC)`。
- Check：`allocated_amount_minor > 0`；反向分配時必須有原因。
- 跨表規則：付款、應收、分配必須屬於同一 `owner_id`、同一成員與同一貨幣；付款有效分配總額不得超過付款金額；應收有效分配總額不得超過應收金額。這些規則需由受測試的交易函式、Trigger 或鎖定策略保護，不能只靠前端檢查。

#### 刪除策略

不硬刪除已確認的分配。錯誤分配使用 `reversed_at` 與 `reversal_reason` 取消，再建立正確分配。

#### 關係

- 多筆分配屬於一筆 `payment`。
- 多筆分配可指向同一筆 `member_charge`。
- 本表形成 `payments` 與 `member_charges` 的多對多關係。

### 5.9 `audit_logs`

#### 用途

以 append-only 方式記錄關鍵業務異動，例如成員停用、資格期間變更、帳期確認／作廢、應收調整、付款作廢與付款分配反向。

#### 欄位

| 欄位 | PostgreSQL 型態 | 必填 | 預設值 | 說明 |
| --- | --- | --- | --- | --- |
| `id` | `bigint` | 是 | identity 自動遞增 | 主鍵，依事件順序增加 |
| `owner_id` | `uuid` | 是 | 無 | 資料擁有者 |
| `actor_user_id` | `uuid` | 否 | `NULL` | 操作者 Auth user；系統事件可為空 |
| `entity_type` | `text` | 是 | 無 | 例如 `member`、`billing_period`、`payment` |
| `entity_id` | `uuid` | 是 | 無 | 被異動資料的 UUID |
| `action` | `text` | 是 | 無 | 例如 `created`、`updated`、`deactivated`、`voided` |
| `before_snapshot` | `jsonb` | 否 | `NULL` | 異動前必要欄位快照 |
| `after_snapshot` | `jsonb` | 否 | `NULL` | 異動後必要欄位快照 |
| `request_id` | `uuid` | 否 | `NULL` | 串連同一次操作的多筆事件 |
| `occurred_at` | `timestamptz` | 是 | `now()` | 事件發生時間 |

#### Key、Constraint 與 Index

- 主鍵：`id`。
- 外鍵：`owner_id` → `profiles.id`；`actor_user_id` → `auth.users.id`，建議 `ON DELETE SET NULL`。
- `entity_id` 不設通用外鍵，因它會指向不同資料表；完整性由建立稽核事件的受控流程保證。
- Unique Constraint：不需要；同一實體可在同一操作中產生多個不同事件。
- Index：`(owner_id, occurred_at DESC)`、`(entity_type, entity_id, occurred_at DESC)`、`(request_id)`。
- Check：`entity_type`、`action` 不得為空字串；至少一個前後快照或明確 action 應能說明事件。

#### 刪除策略

Append-only。一般應用程式角色不得更新或刪除；保存期限若未來需要調整，必須另做管理決策與受控封存程序。

#### 關係

- 每筆事件屬於一個 `profile`。
- `actor_user_id` 指向操作人，但即使 Auth user 日後不存在，事件仍須保留。
- 透過 `entity_type` 與 `entity_id` 對應各業務資料。

## 6. 核心計算與狀態

### 6.1 應收付款狀態

不在 `member_charges` 儲存可手動修改的付款狀態，也不使用單一 `paid` 布林值。以直接關聯的有效付款加總推導：

- `paid_minor`：`status = 'posted'` 的 `payments.amount_minor` 加總。
- `balance_minor`：`max(member_charges.amount_minor - paid_minor, 0)`。
- `paid`：有效付款總額等於應付金額。
- `partially_paid`：有效付款總額大於 0 且小於應付金額。
- `overpaid`：有效付款總額大於應付金額。
- `overdue`：餘額大於 0 且目前業務日期晚於 `due_date`。
- `unpaid`：尚無有效付款、仍有餘額且未逾期。
- `void`：`member_charges.voided_at` 不為空。

`status = 'void'` 的付款不納入加總。第二份 Migration 不建立衍生狀態欄位或統計 View，由後續查詢或受控函式計算。

### 6.2 帳期彙總

- 供應商成本：加總有效 `billing_periods.provider_cost_minor`。
- 成員應收：加總有效 `member_charges.amount_minor`。
- 實收：依報表目的，可按 `payments.paid_at` 採現金基礎，或按 `member_charges.coverage_start` 與分配採應計基礎。
- 管理者負擔：當期供應商成本減去其他成員當期應收；若管理者本人也建立 `member_charges`，則可直接以其應收呈現並核對總額。

## 7. 額外設計說明

### 7.1 Spotify 方案總費用如何保存

- `subscriptions.current_cost_minor` 保存目前設定，供建立下一期帳期時使用。
- 每個 `billing_periods.provider_cost_minor` 保存該期實際費用快照。
- Spotify 調價時只更新 `subscriptions.current_cost_minor` 與 `current_cost_effective_from`；已存在的 `billing_periods` 不回寫。
- 第一階段文件提到目前方案為新臺幣 298 元，但 Schema 不把 298 設成資料庫永久預設，避免未來調價後新資料仍誤用舊價格；首次建立方案時由應用程式明確寫入。

### 7.2 成員月繳與年繳如何表達

- `subscription_members.payment_frequency` 表示 `monthly` 或 `yearly`。
- `monthly_share_minor` 保存每月應認列金額，例如一般成員 50 元。
- `cycle_amount_minor` 保存每次收款週期總額：月繳通常為 50；年繳通常為 600。
- 收費頻率或價格改變時，關閉舊 `subscription_members` 期間並新增一筆，不修改歷史期間。

### 7.3 年繳預付款如何分配到各月份

1. 依年繳資格建立十二筆月度 `member_charges`。
2. 十二筆使用同一個 `collection_cycle_id`，`cycle_sequence` 為 1 至 12，`cycle_length` 為 12。
3. 第二份 Migration 只支援付款直接對應單一應收，尚不能以一筆 `payments` 分配到十二筆月度應收。
4. 正式開放年繳預付款時，應再建立 `payment_allocations` Migration，讓一筆年繳付款分配到十二個月份；不要把一筆真實收款偽裝成十二次獨立付款。
5. 若年額無法被十二整除，依正式決策採固定且可重現的差額順序，並寫入 `calculation_snapshot`；不得使用浮點數平均。

`member_charges` 已保留十二個月份的群組與序號欄位，但年繳付款分配功能在 `payment_allocations` 建立前仍未完成。

### 7.4 成員中途加入或退出如何處理

- 初次加入日期保存於 `members.joined_on`；每段訂閱的開始與退出日期以 `subscription_members.start_date`、`end_date` 表達。
- 新增成員時，加入日期可早於或等於訂閱開始日期，不可晚於訂閱開始日期。
- `billing_anchor_date` 是完成月繳或年繳設定時才填入的帳務週期基準，不代表一般訂閱開始日期。
- 依目前業務規則草案，月中加入或退出不按日比例；符合該期收費條件時產生整期 `member_charges`，並在 `calculation_snapshot` 記錄規則版本。
- 退出後不再產生新應收。已確認的舊應收不因退出而自動刪除。
- 年繳提前退出是否退款在現有文件中仍屬待確認規則。Schema 支援保留既有已付款分配、作廢未來應收或建立更正，但正式行為必須先記錄於 `DECISIONS.md`。
- `billing_periods` 是 Spotify 方案帳期，`member_charges.coverage_start/end` 是成員費用涵蓋區間；兩者分開可容納加入日與 Spotify 扣款日不同的情況。

### 7.5 部分付款如何處理

- 每次實際收款建立一筆 `payments`。
- 多筆 `payments` 可指向同一 `member_charge`，因此可分次付清。
- `payments.amount_minor` 必須大於 0；不允許零或負數付款。
- 目前一筆付款只對應一筆應收，不能跨期分配。跨多筆應收與溢繳抵扣需等 `payment_allocations` 或其他明確的 Credit 模型建立後處理。
- 目前 Schema 未以跨列 Constraint 阻止付款總額超過應收金額；應用層先提示，正式自動抵扣規則確定後再以受控交易函式保護。
- 現有 `business-rules.md` 對「是否允許分次付款」仍有問號，但產品需求明確要求部分付款。Schema 保留部分付款能力，最終 UI 是否開放由後續決策決定。

### 7.6 歷史帳期如何避免被未來調價覆蓋

- `subscriptions` 保存目前價格，不作為歷史報表的唯一來源。
- `billing_periods.provider_cost_minor` 保存 Spotify 當期成本快照。
- `member_charges.amount_minor` 保存成員當期應收快照。
- `member_charges.payment_frequency_snapshot` 與 `calculation_snapshot` 保存產生時使用的週期和計算依據。
- 已確認帳期不得因 `subscriptions` 或 `subscription_members` 更新而自動重算；錯誤應透過作廢／更正流程處理並寫入 `audit_logs`。

### 7.7 哪些資料可以簡化，哪些不能合併

#### 第一階段可以簡化

- 不建立 `services` 表：將 `service_code = 'spotify'` 放在 `subscriptions`。擴充第二種服務前再正規化。
- 不建立獨立方案價格歷史表：目前價格放在 `subscriptions`，歷史價格由 `billing_periods` 與 `member_charges` 快照保護。若需要預排多次未來調價，再新增價格期間表。
- 不建立付款方式字典表：第一階段使用 `payments.payment_method` 文字欄位。
- 不建立獨立溢繳／錢包表：以付款未分配餘額表示可用溢繳，待下一期建立後再分配。
- 不建立報表彙總表：先由帳期、應收、付款及分配即時計算；資料量證明需要時再新增 View 或 Materialized View。

#### 不應合併

- `members` 與 `subscription_members` 不能合併：成員身分與每次加入／退出、月繳／年繳及價格期間的生命週期不同。
- `subscriptions` 與 `billing_periods` 不能合併：前者是目前方案設定，後者是不可被調價覆寫的歷史成本快照。
- `billing_periods` 與 `member_charges` 不能合併：前者是 Spotify 供應商帳期總成本，後者是每位成員的個別應收。
- `member_charges` 與 `payments` 不能合併：應收與實際收款是不同事實，且需支援未付、部分付款、跨期付款與年繳。
- 目前部分付款可用多筆 `payments` 指向同一應收，不需要 `paid` 布林值；但若要支援一筆付款跨多筆應收或正確分配單筆年繳款，`payment_allocations` 仍不能省略。
- `audit_logs` 不能以一般 `updated_at` 取代：時間戳只能說明最後更新時間，無法說明修改前後內容、作廢原因與事件順序。

## 8. RLS 與擁有者一致性草案

- `profiles.id` 只允許 `auth.uid() = id` 的使用者存取。
- 所有業務表預設拒絕匿名存取，僅允許 `owner_id = auth.uid()`。
- 新增或更新關聯資料時，除檢查本列 `owner_id`，也必須確認所有外鍵資料屬於同一 `owner_id`。
- `audit_logs` 對一般前端角色只開放讀取與受控新增，不開放任意更新或刪除。
- `owner_id` 不得只依賴前端傳值；正式實作需由 RLS、受控函式或資料庫 Constraint 共同保護。
- 前端只使用 publishable／anon key，不使用 `service_role` key。

獨立 RLS Migration 已建立於 `supabase/migrations/202607220003_consolidate_rls_policies.sql`，並取代前兩份 Migration 中分散定義的 Policy。七張現有 `public` 業務表均啟用 RLS；完整 Policy 操作說明與 SQL Editor 手動測試步驟見 `docs/RLS.md`。

目前不建立 Delete Policy，也不授予 authenticated `DELETE` 權限。歷史業務資料必須依各表規則採停用、結束期間、關閉或作廢，不得以硬刪除繞過保存要求。

## 9. 後續帳務 Migration 前必須確認

- 年繳成員提前退出的退款或不退款規則。
- 是否在 UI 開放部分付款；Schema 已保留能力。
- 溢繳自動抵扣或由管理者手動分配。
- 年費除不盡十二個月時的差額順序。
- 成員費用區間與 Spotify 供應商帳期不完全對齊時，應收歸屬哪一個 `billing_period`。
- 管理者本人是否一定建立 `members` 與 `member_charges`，以及未滿額時其負擔金額的計算方式。
- 帳期確認後允許的更正流程，以及使用作廢重建或反向調整。
- 稽核快照保存哪些欄位與保存期限，避免保存不必要個資。

上述事項不阻擋 `profiles`、`subscriptions`、`members` 與 `subscription_members` 的核心結構；建立帳期、應收、付款與稽核 Migration 前仍須完成相關決策。

## 10. 實作狀態

第一份核心 Migration 已依本文件建立於：

- `supabase/migrations/202607220001_initial_core_schema.sql`

本次 Migration 僅定義：

- `profiles`
- `subscriptions`
- `members`
- `subscription_members`
- 共用 `updated_at` Trigger Function 與四張表的 Trigger
- 四張表的必要 Constraint、Index、RLS Policy 與 authenticated 最小權限

實作決策如下：

- 金額使用最小貨幣單位 `bigint`，不用浮點數。
- `profiles.id` 直接對應 `auth.users.id`，刪除採 `RESTRICT`。
- 所有跨表外鍵均採 `RESTRICT`，不使用危險的 Cascade Delete。
- `subscription_members` 使用 `btree_gist` 與日期區間 Exclusion Constraint 防止同一成員資格重疊。
- 以複合外鍵確保 `subscription_members` 引用的方案、成員與 `owner_id` 一致。
- 月繳週期金額必須等於單月分攤；年繳週期金額必須等於十二個月分攤合計。
- 四張表皆啟用 RLS；前端 authenticated 角色僅授予讀取、新增、更新，不授予刪除。
- 本文件更新與 Migration 建立不代表已在任何本機或遠端 Supabase 資料庫執行。

## 11. Supabase SQL Editor 安全執行與驗證

正式執行前：

1. 確認選取的是開發或測試 Supabase Project，不先在正式資料庫嘗試。
2. 備份既有 Schema，並確認目前尚無同名資料表、Policy、Trigger 或 `set_updated_at` Function。
3. 在 SQL Editor 新建空白 Query，完整貼入單一 Migration 檔內容；不要混入 `.env.local`、anon key、secret key 或 `service_role` key。
4. 先逐段閱讀 SQL，確認只建立四張指定資料表及其直接附屬物件。
5. Migration 已包在單一 Transaction；由具管理權限的人員在 SQL Editor 完整執行一次。任何語句失敗時應讓整個 Transaction 回滾，不要只挑失敗後的片段重跑。
6. 成功後不要重複執行同一 Migration；後續修改應建立新 Migration。
7. SQL Editor 手動執行不代表本機 Migration 歷史已自動同步。之後若改用 Supabase CLI 或 `db push`，必須先確認遠端 Migration History，避免同一檔案再次執行。

執行後驗證：

1. Table Editor 應只新增 `profiles`、`subscriptions`、`members`、`subscription_members` 四張業務表。
2. 確認四張表的 RLS 均為啟用狀態，且只有 authenticated 自有資料的 Select、Insert、Update Policy，沒有 Delete Policy。
3. 確認所有金額欄位是 `bigint`，UUID 主鍵與 `created_at`、`updated_at` 都存在。
4. 確認 `subscription_members` 對 `subscriptions`、`members` 的外鍵刪除動作是 `RESTRICT`，沒有 Cascade Delete。
5. 使用測試使用者驗證：本人可新增及讀取自己的資料；匿名請求、其他使用者資料及 Delete 操作應被拒絕。
6. 嘗試建立重疊的成員資格、負金額、無效日期或年繳金額不等於十二個月合計的測試資料，應被 Constraint 拒絕。
7. 更新任一測試資料後，確認 `updated_at` 自動變更。

若執行失敗，先保留完整錯誤訊息並停止，不要以刪表或重跑部分 SQL 的方式修補；應修正 Migration、在乾淨的測試環境重新驗證，再決定正式處理方式。

## 12. 第二份 Migration 實作狀態

第二份 Migration 已建立於：

- `supabase/migrations/202607220002_billing_and_payments.sql`

本次 Migration 僅新增：

- `billing_periods`
- `member_charges`
- `payments`
- 三張表直接需要的 Constraint、Index、`updated_at` Trigger、RLS Policy 與 authenticated 最小權限

另在第二份 Migration 中為既有 `subscription_members` 新增 `(id, owner_id, subscription_id)` Unique Constraint，作為 `member_charges` 擁有者與方案一致性複合外鍵的引用目標；第一份 Migration 檔案本身未修改。

實作決策如下：

- `billing_periods.provider_cost_minor` 使用 `bigint` 保存當期 Spotify 方案費用快照，不受未來 `subscriptions.current_cost_minor` 調整影響。
- `member_charges.amount_minor` 使用 `bigint` 保存每位成員當期應付金額快照。
- 每次實際付款建立一筆獨立 `payments`，並直接連到一筆 `member_charges`。
- 同一筆 `member_charges` 可有多筆 `status = 'posted'` 的付款，因此支援部分付款。
- `payments.amount_minor` 必須大於 0，不允許零或負數付款。
- `payments.status` 只描述付款紀錄是有效或作廢，不代表應收是否付清。
- 應收的 `unpaid`、`partially_paid`、`paid`、`overpaid`、`overdue` 狀態由有效付款總額、應付金額與到期日推導，不保存單一 `paid` 布林值。
- 所有外鍵使用 `ON DELETE RESTRICT`，三張表均啟用 RLS，authenticated 沒有 Delete Policy 或 Delete 權限。
- 本次不建立 `payment_allocations`、`audit_logs`、統計表或狀態 View。

### 第二份 Migration 驗證重點

1. 先在已成功套用第一份 Migration 的全新開發／測試 Project 執行。
2. 確認只新增三張資料表，且第一份 Migration 建立的四張表仍存在、欄位未被覆寫。
3. 建立帳期後修改 `subscriptions.current_cost_minor`，確認既有 `billing_periods.provider_cost_minor` 不會改變。
4. 對同一筆 50 元應收建立兩筆 20 元與 30 元付款，確認兩筆付款分別保存，且有效付款加總為 50 元。
5. 嘗試建立 0 元或負數付款，應由 `payments_amount_positive_check` 拒絕。
6. 確認資料表中沒有 `paid` 布林欄位；付款狀態由有效付款加總與 `due_date` 推導。
7. 確認匿名與其他使用者無法存取，authenticated 僅能讀取、新增、更新自己的資料，Delete 應被拒絕。
8. 確認所有外鍵均為 `RESTRICT`，不存在 Cascade Delete。

### 目前限制

- 一筆付款只能直接對應一筆應收。
- 一筆付款跨多筆應收、單筆年繳款分配十二個月份及正式溢繳抵扣，需由後續 `payment_allocations` 或 Credit 模型 Migration 完成。
- 付款總額是否可超過應收金額尚未以跨列資料庫規則限制，應在溢繳規則定案後以受控交易函式處理。
- 本文件更新與 Migration 建立不代表已在任何本機或遠端 Supabase 資料庫執行。

## 13. 待設定帳務的成員 Migration 實作狀態

第四份 Migration 已建立於：

- `supabase/migrations/202607220004_allow_pending_member_billing_setup.sql`

本次變更：

- `members` 新增可為空的 `joined_on`，避免對既有資料填入推測日期；新增成員的受控流程要求此日期必填。
- `subscription_members` 的繳費方式、金額、貨幣及 `billing_anchor_date` 改為可為空，並以 Check Constraint 強制帳務欄位只能「全部未設定」或「全部已設定」。
- `subscription_members.start_date` 保存訂閱開始日期；`billing_anchor_date` 留待月繳／年繳設定時填入。
- 新增 `create_member_with_subscription` 資料庫函式。函式從 `auth.uid()` 取得 owner，在同一 Transaction 內建立 `members` 與 `subscription_members`，避免只建立其中一筆而破壞關聯。
- 函式只選取登入管理者自己的啟用中 Spotify 訂閱，採 `SECURITY INVOKER` 並由既有 RLS 繼續檢查；匿名角色沒有執行權限。
- 本次未建立成員修改、刪除、付款或帳期功能，也未在任何遠端資料庫執行 Migration。

## 14. 成員退出與停用 Migration 實作狀態

第五份 Migration 已建立於：

- `supabase/migrations/202607220005_deactivate_member.sql`

`deactivate_member` 函式以登入者的 `auth.uid()` 限制 owner，並在同一 Transaction 中完成：

- 將成員 `status` 改為 `inactive`。
- 將退出日期寫入 `members.deactivated_on`。
- 將該成員所有仍開放的 `subscription_members.end_date` 設為同一退出日期。
- 保留原本的成員、訂閱期間、應收與付款資料，不執行實體 `DELETE`。
- 停用成員仍由 owner 的查詢讀取，可在成員清單及後續歷史頁沿既有關聯查詢其付款歷史。

函式採 `SECURITY INVOKER` 並由既有 RLS 持續保護，只授予 authenticated 執行權限。退出日期必須晚於仍開放訂閱期間的開始日期。本文件更新與 Migration 建立不代表已在任何本機或遠端 Supabase 資料庫執行。

## 15. 成員繳費週期設定 Migration 實作狀態

第六份 Migration 已建立於：

- `supabase/migrations/202607220006_configure_member_payment_cycle.sql`

欄位對應：

- 產品欄位 `payment_cycle` 對應既有 `subscription_members.payment_frequency`，只接受 `monthly` 或 `yearly`。
- 產品欄位 `monthly_share_amount` 對應既有最小貨幣單位整數 `subscription_members.monthly_share_minor`。
- `monthly` 的 `cycle_amount_minor` 等於每月分攤金額。
- `yearly` 只代表成員一次預繳十二個月，`cycle_amount_minor` 等於每月分攤金額乘以十二；`monthly_share_minor` 仍維持單月金額。
- 貨幣沿用所屬方案的貨幣，`billing_anchor_date` 使用成員訂閱開始日期，使待設定的帳務欄位一次完整建立。

`configure_member_payment_cycle` 函式使用 `auth.uid()`、`SECURITY INVOKER` 與既有 RLS，只能首次設定登入管理者自己、帳務欄位仍全部為空的開放中訂閱成員。已完成的設定不直接覆寫；日後變更週期或金額時應關閉舊期間並建立新期間，以保留歷史。本次不建立 `payments`、`member_charges`、預繳分配或跨月抵扣，也不代表已在任何本機或遠端 Supabase 資料庫執行 Migration。

## 16. 手動建立月度帳期 Migration 實作狀態

第七份 Migration 已建立於：

- `supabase/migrations/202607220007_create_monthly_billing_period.sql`

本次變更：

- `billing_periods` 新增可為空的 `due_date`，避免對既有帳期填入推測日期；新的受控建立流程要求必填。
- `create_monthly_billing_period` 在單一 Transaction 中建立 `billing_periods` 費用快照與符合資格的 `member_charges`。
- 帳期固定為一個日曆月，採 `[period_start, period_end)` 半開區間。
- 成員資格條件為 `start_date <= period_start`，且 `end_date` 為空或晚於 `period_start`。
- 每筆 `member_charges.amount_minor` 直接快照成員訂閱期間的 `monthly_share_minor`，不按日比例。
- `payment_frequency_snapshot` 保留建立當時的 monthly／yearly；yearly 本次仍建立單月應收，不套用預繳款或抵扣。
- 若任何符合資格的成員尚未完成繳費設定，整個 Transaction 失敗，不建立不完整帳期。
- 同一訂閱已有重疊的非作廢帳期時拒絕建立；原有 Unique 與 Exclusion Constraint 仍提供最終防護。
- 函式使用 `auth.uid()`、`SECURITY INVOKER` 與既有 RLS，不含自動排程。

本次不建立付款、不分配 Yearly 預繳款，也不代表已在任何本機或遠端 Supabase 資料庫執行 Migration。

## 17. 手動登記付款 Migration 實作狀態

第八份 Migration 已建立於：

- `supabase/migrations/202607220008_record_member_payment.sql`

`record_member_payment` 函式：

- 每次呼叫新增一筆獨立 `payments`，不更新 `member_charges.amount_minor`。
- 付款金額使用最小貨幣單位 `bigint` 且必須大於 0。
- 同一 `member_charge` 可重複呼叫並建立多筆付款，因此支援分次付款。
- 前端只傳 `member_charge_id`；函式以 `auth.uid()` 驗證應收與帳期皆屬於登入管理者，並從應收取得貨幣，避免成員、帳期、owner 或貨幣錯配。
- 付款日期依 `profiles.business_timezone` 轉為 `payments.paid_at` 保存。
- 作廢應收或作廢帳期不可新增付款。
- 函式採 `SECURITY INVOKER` 並由既有 RLS 持續保護，匿名角色沒有執行權限。

本次不建立付款修改、刪除、跨帳期分配、Yearly 預繳抵扣或自動金流，也不代表已在任何本機或遠端 Supabase 資料庫執行 Migration。
