-- Consolidate Row Level Security for every current public business table.
-- This migration supersedes the policies declared by the first two migrations.

begin;

set search_path = public, extensions;

-- Remove the policies created by the earlier schema migrations so that all
-- application-facing tables follow one consistent ownership policy set.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_insert_own on public.subscriptions;
drop policy if exists subscriptions_update_own on public.subscriptions;

drop policy if exists members_select_own on public.members;
drop policy if exists members_insert_own on public.members;
drop policy if exists members_update_own on public.members;

drop policy if exists subscription_members_select_own on public.subscription_members;
drop policy if exists subscription_members_insert_own on public.subscription_members;
drop policy if exists subscription_members_update_own on public.subscription_members;

drop policy if exists billing_periods_select_own on public.billing_periods;
drop policy if exists billing_periods_insert_own on public.billing_periods;
drop policy if exists billing_periods_update_own on public.billing_periods;

drop policy if exists member_charges_select_own on public.member_charges;
drop policy if exists member_charges_insert_own on public.member_charges;
drop policy if exists member_charges_update_own on public.member_charges;

drop policy if exists payments_select_own on public.payments;
drop policy if exists payments_insert_own on public.payments;
drop policy if exists payments_update_own on public.payments;

-- RLS remains enabled explicitly even when the preceding migrations already
-- enabled it. This makes the security requirement visible in one migration.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.members enable row level security;
alter table public.subscription_members enable row level security;
alter table public.billing_periods enable row level security;
alter table public.member_charges enable row level security;
alter table public.payments enable row level security;

-- profiles is the authenticated owner's account record. Its primary key is
-- also the auth.users id, so id is the ownership key for this table.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy subscriptions_insert_own
on public.subscriptions
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy subscriptions_update_own
on public.subscriptions
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy members_select_own
on public.members
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy members_insert_own
on public.members
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy members_update_own
on public.members
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy subscription_members_select_own
on public.subscription_members
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy subscription_members_insert_own
on public.subscription_members
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy subscription_members_update_own
on public.subscription_members
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy billing_periods_select_own
on public.billing_periods
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy billing_periods_insert_own
on public.billing_periods
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy billing_periods_update_own
on public.billing_periods
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy member_charges_select_own
on public.member_charges
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy member_charges_insert_own
on public.member_charges
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy member_charges_update_own
on public.member_charges
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy payments_select_own
on public.payments
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy payments_insert_own
on public.payments
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy payments_update_own
on public.payments
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

-- Table privileges and RLS are both required. Anonymous access and all
-- destructive or administrative privileges are removed explicitly.
revoke all privileges on table public.profiles from public, anon, authenticated;
revoke all privileges on table public.subscriptions from public, anon, authenticated;
revoke all privileges on table public.members from public, anon, authenticated;
revoke all privileges on table public.subscription_members from public, anon, authenticated;
revoke all privileges on table public.billing_periods from public, anon, authenticated;
revoke all privileges on table public.member_charges from public, anon, authenticated;
revoke all privileges on table public.payments from public, anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.subscriptions to authenticated;
grant select, insert, update on table public.members to authenticated;
grant select, insert, update on table public.subscription_members to authenticated;
grant select, insert, update on table public.billing_periods to authenticated;
grant select, insert, update on table public.member_charges to authenticated;
grant select, insert, update on table public.payments to authenticated;

-- No DELETE policy or DELETE grant is created. Historical business records
-- must be deactivated, closed, or voided instead of being hard-deleted.

commit;
