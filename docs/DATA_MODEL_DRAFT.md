# 資料模型草案

## 1. 文件定位

本文件描述第一階段的概念資料模型，供需求討論與 Migration 設計使用。它不是可直接執行的資料庫 Schema；正式欄位、型別、索引、外鍵、觸發器與 RLS Policy 必須透過 Migration 建立並測試。

## 2. 共通原則

- 主要識別碼建議使用 UUID。
- 業務資料表均保留 `owner_id`，連結 Supabase Auth 使用者，並以 RLS 限制存取。
- 所有金額欄位使用最小貨幣單位整數，命名以 `_minor` 結尾；禁止浮點數。
- 貨幣使用 ISO 4217 三碼字串，例如 `TWD`。
- 時間戳記使用具時區的時間型別；純帳務日期使用日期型別，避免時區轉換改變日期。
- 可被停用或作廢的歷史資料優先保存狀態與時間，不直接硬刪除。
- `created_at`、`updated_at` 等稽核欄位由資料庫一致維護。
- 日期區間建議採半開區間：`start_date` 包含、`end_date` 不包含；最終規則需記錄於決策文件。

## 3. 實體關係概覽

```text
auth.users
  └─ profiles
       ├─ services
       │    └─ family_subscriptions
       │         └─ billing_periods
       │              └─ charges ───────────────┐
       ├─ members                               │
       │    └─ member_subscription_periods      │
       └─ payments                              │
            └─ payment_allocations ─────────────┘

profiles ── audit_events
```

`services` 與 `family_subscriptions` 讓資料概念上可擴充其他服務；第一階段只建立或使用 Spotify Premium Family 的資料，不實作多服務介面。

## 4. 資料表草案

### 4.1 `profiles`

管理者的應用程式資料，與 `auth.users` 一對一。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 等同 Auth user UUID，主鍵 |
| `display_name` | 管理者顯示名稱 |
| `default_currency` | 預設貨幣代碼 |
| `business_timezone` | 帳務顯示與提醒使用的 IANA 時區 |
| `created_at`、`updated_at` | 建立與更新時間 |

### 4.2 `services`

訂閱服務目錄。第一階段只有 Spotify。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `code` | 穩定代碼，例如 `spotify` |
| `name` | 顯示名稱 |
| `is_active` | 是否仍使用 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：同一擁有者的 `code` 唯一。

### 4.3 `family_subscriptions`

管理者實際支付的 Family 方案設定。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `service_id` | 對應服務 |
| `name` | 方案顯示名稱 |
| `status` | `active`、`inactive` 等狀態 |
| `billing_anchor_day` | 每期帳務基準日；是否需要依決策確認 |
| `currency` | 貨幣代碼 |
| `current_cost_minor` | 目前每期總成本快照；歷史仍以帳期為準 |
| `started_on`、`ended_on` | 方案有效期間 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：成本不得為負；結束日不得早於開始日。

### 4.4 `members`

Family 成員主檔。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `display_name` | 必填顯示名稱 |
| `contact_email` | 選填聯絡 Email，不作為登入帳號 |
| `contact_note` | 選填其他聯絡資訊 |
| `status` | `active` 或 `inactive` |
| `notes` | 管理者備註 |
| `deactivated_at` | 停用時間 |
| `created_at`、`updated_at` | 建立與更新時間 |

刪除規則：若已有訂閱期間、應收費用或付款關聯，資料庫必須阻止硬刪除。一般操作使用停用。

### 4.5 `member_subscription_periods`

成員加入某 Family 方案的一段有效期間與繳費設定。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `member_id` | 對應成員 |
| `family_subscription_id` | 對應 Family 方案 |
| `start_date` | 開始日，包含 |
| `end_date` | 結束日，建議不包含；啟用中可為空 |
| `payment_cycle` | `monthly` 或 `yearly` |
| `agreed_amount_minor` | 該繳費週期約定金額；最終語意待決策 |
| `currency` | 貨幣代碼 |
| `price_effective_from` | 價格生效日；若改採獨立價格表可移除 |
| `notes` | 例外或調整說明 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：金額不得為負；結束日須晚於開始日；同一成員在同一方案中的有效期間不得重疊。價格變更若需完整歷史，應新增期間或另建價格歷史表，不直接覆寫既有費用。

### 4.6 `billing_periods`

管理者支付 Spotify Family 費用的一個帳期。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `family_subscription_id` | 對應 Family 方案 |
| `period_start` | 帳期開始日，包含 |
| `period_end` | 帳期結束日，建議不包含 |
| `due_date` | 成員付款到期日 |
| `total_cost_minor` | 該期實際方案總成本 |
| `currency` | 貨幣代碼 |
| `status` | 例如 `draft`、`confirmed`、`closed`、`void` |
| `confirmed_at` | 確認時間 |
| `notes` | 帳期備註 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：金額不得為負；結束日須晚於開始日；同一方案的帳期不可重複；確認後影響金額的變更需走明確的重開或更正流程。

### 4.7 `charges`

帳期分配給個別成員的應收費用，是歷史金額快照。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `billing_period_id` | 對應帳期 |
| `member_id` | 應付款成員 |
| `member_subscription_period_id` | 產生費用時依據的成員訂閱期間 |
| `amount_minor` | 應收金額 |
| `currency` | 貨幣代碼 |
| `due_date` | 該筆應收到期日快照 |
| `calculation_method` | 平均、固定、按比例或人工調整等方式 |
| `calculation_snapshot` | 可重現計算的結構化快照；內容需版本化 |
| `adjustment_reason` | 人工調整時必填原因 |
| `voided_at`、`void_reason` | 作廢資訊 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：金額不得為負；同一帳期與成員原則上只有一筆有效應收；作廢不刪除。付款狀態不建議作為可任意修改的欄位，而由有效應收、付款分配與到期日推導。

### 4.8 `payments`

管理者手動登記的實際付款事件。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `member_id` | 付款成員 |
| `amount_minor` | 收到的總金額 |
| `currency` | 貨幣代碼 |
| `paid_on` | 付款日期 |
| `method` | 現金、轉帳或其他人工標記 |
| `reference` | 交易參考資訊，選填 |
| `notes` | 備註 |
| `voided_at`、`void_reason` | 作廢資訊 |
| `created_at`、`updated_at` | 建立與更新時間 |

限制建議：金額必須大於零；作廢付款不計入統計但仍保留歷史；更正方式依 `DEC-P05` 決定。

### 4.9 `payment_allocations`

將付款金額分配至應收費用的關聯資料。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `payment_id` | 對應付款 |
| `charge_id` | 對應應收費用 |
| `allocated_amount_minor` | 本次分配金額 |
| `created_at` | 建立時間 |

限制建議：分配金額必須大於零；同一付款對同一應收至多一筆有效分配；有效分配總額不得超過付款金額，也不得使應收累計付款超過應收金額，除非未來明確支援溢付。付款、應收與分配的貨幣及成員必須一致。

### 4.10 `audit_events`

記錄重要業務資料異動，提供歷史追蹤。

| 欄位 | 建議語意 |
| --- | --- |
| `id` | 主鍵 |
| `owner_id` | 資料擁有者 |
| `actor_user_id` | 操作者 Auth user UUID |
| `entity_type`、`entity_id` | 被異動的實體與識別碼 |
| `action` | 建立、更新、停用、確認、作廢等動作 |
| `before_snapshot`、`after_snapshot` | 必要欄位的異動前後快照 |
| `occurred_at` | 發生時間 |

注意：快照不得無限制保存不必要的個人或敏感資訊。第一階段可先針對付款、應收、帳期確認與成員停用等關鍵事件實作。

## 5. 衍生資料與狀態

以下資料建議由查詢、資料庫 View 或明確函式推導，不重複儲存為可任意編輯欄位：

- 應收已付金額：有效 `payment_allocations` 的加總。
- 應收未付餘額：`charge.amount_minor - 已付金額`。
- 付款未分配金額：`payment.amount_minor - 有效分配加總`。
- 付款狀態：
  - `paid`：未付餘額為零。
  - `partial`：已付大於零且未付餘額大於零。
  - `overdue`：未付餘額大於零且已超過到期日。
  - `unpaid`：未付且尚未逾期。
  - `void`：應收已作廢。
- 成員目前是否訂閱中：目前日期落在有效的成員訂閱期間內，且成員未停用。

## 6. 一致性與交易邊界

- 產生帳期應收費用應在單一資料庫交易內完成，避免只建立部分成員費用。
- 付款建立與付款分配若由同一操作送出，應在單一交易或具等效一致性保護的資料庫函式內完成。
- 需以資料庫限制或鎖定策略防止同一帳期重複產生費用與同時分配造成超額。
- `owner_id` 不得只由前端傳入並信任；資料庫 Policy 或函式需驗證其等於 `auth.uid()`。
- 關鍵跨表規則若無法只靠一般 Constraint 表達，應以受測試的資料庫函式或 Trigger 實作，並包含在 Migration 中。

## 7. 索引初稿

- 所有業務資料表的 `owner_id`。
- `members(owner_id, status)`。
- `member_subscription_periods(member_id, start_date, end_date)`。
- `billing_periods(family_subscription_id, period_start, period_end)`，並以唯一限制避免重複帳期。
- `charges(billing_period_id, member_id)` 與 `charges(member_id, due_date)`。
- `payments(member_id, paid_on)`。
- `payment_allocations(payment_id)` 與 `payment_allocations(charge_id)`。
- `audit_events(entity_type, entity_id, occurred_at)`。

正式索引仍需依實際查詢、資料量與執行計畫調整，避免未驗證的過度索引。

## 8. RLS 草案

- 所有業務資料表啟用 RLS。
- 一般 CRUD Policy 僅允許 `owner_id = auth.uid()` 的已登入使用者。
- 關聯新增或更新時，除檢查本列 `owner_id`，也必須確保引用資料屬於同一擁有者。
- `profiles.id` 僅能由同一個 `auth.uid()` 讀寫。
- 不提供匿名業務資料存取。
- 高權限管理操作若未來需要，應放在受控後端環境；不得在 GitHub Pages 前端使用 `service_role` key。

## 9. Migration 建議順序

1. 共用函式、時間戳記與必要 enum／check constraint。
2. `profiles`、`services`、`family_subscriptions`。
3. `members`、`member_subscription_periods` 與期間限制。
4. `billing_periods`、`charges`。
5. `payments`、`payment_allocations` 與總額保護。
6. `audit_events`。
7. 索引、View／推導函式。
8. 全部資料表的 RLS Policy 與對應測試。

實作時可依可回復性拆成更小的 Migration，但不得跳過版本化。

## 10. 實作前待確認

- `DEC-P01` 至 `DEC-P05` 對費用、期間與付款欄位的影響。
- 主要貨幣、是否允許同一管理者使用多種貨幣，以及跨貨幣統計規則。
- 業務時區與「今天／逾期」的判定時間。
- 是否需要獨立的方案價格歷史表，而不是在成員訂閱期間保存約定金額。
- 帳期確認後允許哪些修改，以及重開／作廢流程。
- 稽核快照的保存範圍與個人資料最小化要求。
