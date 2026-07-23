# Row Level Security（RLS）

## 1. 適用範圍

獨立 RLS Migration：

- `supabase/migrations/202607220003_consolidate_rls_policies.sql`

目前 `public` Schema 共有七張業務資料表，全部啟用 RLS：

- `profiles`
- `subscriptions`
- `members`
- `subscription_members`
- `billing_periods`
- `member_charges`
- `payments`

`profiles.id` 同時是 `auth.users.id`，因此此表以 `id = auth.uid()` 判斷資料擁有者。其餘六張表均以不可為空的 `owner_id = auth.uid()` 判斷資料擁有者。

前端只使用 Supabase 公開用戶端金鑰與登入者 JWT。`service_role` 會略過 RLS，不得放入前端、Git Repository 或 GitHub Pages，也不是前端存取失敗時的替代解法。

## 2. 權限基線

- `PUBLIC`、`anon` 與 `authenticated` 原有資料表權限先全部撤銷。
- 僅重新授予 `authenticated` 各表的 `SELECT`、`INSERT`、`UPDATE`。
- `anon` 沒有資料表權限，也沒有任何 Policy，因此未登入使用者不可讀寫。
- 不授予 `DELETE`，也不建立 Delete Policy。歷史資料須以停用、結束期間、關閉或作廢方式保留。
- RLS 保護的是透過一般應用程式角色執行的查詢。Supabase Dashboard SQL Editor 通常以具管理權限的資料庫角色執行，可能略過 RLS，因此測試時必須切換到 `anon` 或 `authenticated` 角色。

## 3. Policy 與保護操作

每張表都有三條 Policy，Policy 名稱由資料表名稱加上操作組成：

| Policy 後綴 | PostgreSQL 操作 | 保護方式 |
| --- | --- | --- |
| `_select_own` | `SELECT` | `USING` 只讓登入者看見自己的列；其他 owner 的列會被過濾。 |
| `_insert_own` | `INSERT` | `WITH CHECK` 拒絕建立 owner 不屬於登入者的列。 |
| `_update_own` | `UPDATE` | `USING` 限制只能選中自己的既有列，`WITH CHECK` 同時禁止把資料的 owner 改成其他人。 |

實際 Policy 如下：

| 資料表 | Select Policy | Insert Policy | Update Policy | Owner 條件 |
| --- | --- | --- | --- | --- |
| `profiles` | `profiles_select_own` | `profiles_insert_own` | `profiles_update_own` | `id = auth.uid()` |
| `subscriptions` | `subscriptions_select_own` | `subscriptions_insert_own` | `subscriptions_update_own` | `owner_id = auth.uid()` |
| `members` | `members_select_own` | `members_insert_own` | `members_update_own` | `owner_id = auth.uid()` |
| `subscription_members` | `subscription_members_select_own` | `subscription_members_insert_own` | `subscription_members_update_own` | `owner_id = auth.uid()` |
| `billing_periods` | `billing_periods_select_own` | `billing_periods_insert_own` | `billing_periods_update_own` | `owner_id = auth.uid()` |
| `member_charges` | `member_charges_select_own` | `member_charges_insert_own` | `member_charges_update_own` | `owner_id = auth.uid()` |
| `payments` | `payments_select_own` | `payments_insert_own` | `payments_update_own` | `owner_id = auth.uid()` |

沒有 `_delete_own` Policy。即使列屬於目前登入者，前端角色仍不能硬刪除。

## 4. SQL Editor 手動測試

### 4.1 準備兩位測試使用者

1. 只在開發或測試 Supabase Project 進行。
2. 在 Authentication 建立兩位測試使用者 A、B，記下兩個 UUID。
3. 先套用前三份 Migration。
4. 下列 `<USER_A_UUID>`、`<USER_B_UUID>` 必須替換為實際 UUID。
5. 每段預期失敗的測試應分開執行，以免 PostgreSQL 錯誤中止同一個 Transaction。

SQL Editor 預設的管理角色可能略過 RLS。以下每段都使用 `SET LOCAL ROLE` 與 JWT claim 模擬真正的 API 角色，並以 `ROLLBACK` 避免留下測試資料。

### 4.2 驗證匿名使用者不可讀取

```sql
begin;
set local role anon;
select * from public.members;
rollback;
```

預期結果：因 `anon` 沒有 `SELECT` 權限而收到 `permission denied`，而不是取得資料。

### 4.3 建立測試擁有者資料

先以使用者 A 身分建立自己的 Profile 與 Member：

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_A_UUID>', 'role', 'authenticated')::text,
  true
);

insert into public.profiles (id, display_name)
values ('<USER_A_UUID>', 'RLS User A');

insert into public.members (owner_id, display_name)
values ('<USER_A_UUID>', 'A Member');

select id, owner_id, display_name
from public.members;
rollback;
```

預期結果：新增成功，查詢只回傳 A 自己的資料。若 Profile 已存在，可省略該筆 `profiles` Insert。

### 4.4 驗證不能冒用其他 Owner 新增

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_A_UUID>', 'role', 'authenticated')::text,
  true
);

insert into public.members (owner_id, display_name)
values ('<USER_B_UUID>', 'Forbidden Member');
rollback;
```

預期結果：收到 `new row violates row-level security policy`，資料不會建立。

### 4.5 驗證不能讀取或修改其他 Owner 資料

先以管理角色準備 A、B 各自的資料，或透過各自登入身分建立。接著以 A 身分執行：

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_A_UUID>', 'role', 'authenticated')::text,
  true
);

select owner_id, display_name
from public.members;

update public.members
set display_name = 'Should Not Change'
where owner_id = '<USER_B_UUID>';
rollback;
```

預期結果：Select 不會出現 B 的列，Update 影響 0 列。

### 4.6 驗證不能更換 Owner

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_A_UUID>', 'role', 'authenticated')::text,
  true
);

update public.members
set owner_id = '<USER_B_UUID>'
where owner_id = '<USER_A_UUID>';
rollback;
```

預期結果：`WITH CHECK` 拒絕更新，收到 RLS Policy 錯誤。

### 4.7 驗證不能硬刪除

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_A_UUID>', 'role', 'authenticated')::text,
  true
);

delete from public.members
where owner_id = '<USER_A_UUID>';
rollback;
```

預期結果：因 `authenticated` 沒有 `DELETE` 權限而收到 `permission denied`。

## 5. 套用後檢查

可使用具管理權限的 SQL Editor 查詢設定狀態；以下查詢只檢查 metadata，不代表應用程式角色的實際 RLS 測試：

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'subscriptions',
    'members',
    'subscription_members',
    'billing_periods',
    'member_charges',
    'payments'
  )
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

預期七張表的 `rowsecurity` 全部為 `true`，每張表恰好有 Select、Insert、Update 三條 owner Policy，且沒有 Delete Policy。
