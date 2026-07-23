-- First-phase core schema for Spotify Family Manager.
-- This migration intentionally creates only:
-- profiles, subscriptions, members, and subscription_members.

begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

set search_path = public, extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key,
  display_name text not null,
  default_currency char(3) not null default 'TWD',
  business_timezone text not null default 'Asia/Taipei',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_auth_user_fk
    foreign key (id)
    references auth.users (id)
    on delete restrict,
  constraint profiles_display_name_not_blank_check
    check (btrim(display_name) <> ''),
  constraint profiles_default_currency_format_check
    check (default_currency::text ~ '^[A-Z]{3}$'),
  constraint profiles_business_timezone_not_blank_check
    check (btrim(business_timezone) <> '')
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  service_code text not null default 'spotify',
  plan_name text not null default 'Spotify Premium Family',
  status text not null default 'active',
  seat_limit smallint not null default 6,
  current_cost_minor bigint not null,
  currency char(3) not null default 'TWD',
  provider_billing_cycle text not null default 'monthly',
  current_cost_effective_from date not null,
  started_on date not null,
  ended_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint subscriptions_owner_service_start_unique
    unique (owner_id, service_code, started_on),
  constraint subscriptions_id_owner_unique
    unique (id, owner_id),
  constraint subscriptions_service_code_not_blank_check
    check (btrim(service_code) <> ''),
  constraint subscriptions_plan_name_not_blank_check
    check (btrim(plan_name) <> ''),
  constraint subscriptions_status_check
    check (status in ('active', 'inactive')),
  constraint subscriptions_seat_limit_positive_check
    check (seat_limit > 0),
  constraint subscriptions_cost_nonnegative_check
    check (current_cost_minor >= 0),
  constraint subscriptions_currency_format_check
    check (currency::text ~ '^[A-Z]{3}$'),
  constraint subscriptions_provider_billing_cycle_check
    check (provider_billing_cycle in ('monthly', 'yearly')),
  constraint subscriptions_dates_check
    check (ended_on is null or ended_on > started_on),
  constraint subscriptions_status_dates_check
    check (
      (status = 'active' and ended_on is null)
      or (status = 'inactive' and ended_on is not null)
    ),
  constraint subscriptions_cost_effective_date_check
    check (
      current_cost_effective_from >= started_on
      and (
        ended_on is null
        or current_cost_effective_from < ended_on
      )
    )
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  display_name text not null,
  contact_email text,
  contact_note text,
  is_owner boolean not null default false,
  status text not null default 'active',
  deactivated_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint members_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint members_id_owner_unique
    unique (id, owner_id),
  constraint members_display_name_not_blank_check
    check (btrim(display_name) <> ''),
  constraint members_contact_email_not_blank_check
    check (contact_email is null or btrim(contact_email) <> ''),
  constraint members_status_check
    check (status in ('active', 'inactive')),
  constraint members_status_dates_check
    check (
      (status = 'active' and deactivated_on is null)
      or (status = 'inactive' and deactivated_on is not null)
    )
);

create table public.subscription_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subscription_id uuid not null,
  member_id uuid not null,
  start_date date not null,
  end_date date,
  payment_frequency text not null default 'monthly',
  monthly_share_minor bigint not null,
  cycle_amount_minor bigint not null,
  currency char(3) not null default 'TWD',
  billing_anchor_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscription_members_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint subscription_members_subscription_owner_fk
    foreign key (subscription_id, owner_id)
    references public.subscriptions (id, owner_id)
    on delete restrict,
  constraint subscription_members_member_owner_fk
    foreign key (member_id, owner_id)
    references public.members (id, owner_id)
    on delete restrict,
  constraint subscription_members_start_unique
    unique (subscription_id, member_id, start_date),
  constraint subscription_members_dates_check
    check (end_date is null or end_date > start_date),
  constraint subscription_members_payment_frequency_check
    check (payment_frequency in ('monthly', 'yearly')),
  constraint subscription_members_monthly_share_nonnegative_check
    check (monthly_share_minor >= 0),
  constraint subscription_members_cycle_amount_nonnegative_check
    check (cycle_amount_minor >= 0),
  constraint subscription_members_cycle_amount_check
    check (
      (payment_frequency = 'monthly' and cycle_amount_minor = monthly_share_minor)
      or (
        payment_frequency = 'yearly'
        and cycle_amount_minor = monthly_share_minor * 12
      )
    ),
  constraint subscription_members_currency_format_check
    check (currency::text ~ '^[A-Z]{3}$'),
  constraint subscription_members_billing_anchor_check
    check (
      billing_anchor_date >= start_date
      and (end_date is null or billing_anchor_date < end_date)
    ),
  constraint subscription_members_no_overlapping_periods
    exclude using gist (
      subscription_id with =,
      member_id with =,
      daterange(start_date, end_date, '[)') with &&
    )
    deferrable initially immediate
);

create unique index subscriptions_one_active_service_per_owner_idx
  on public.subscriptions (owner_id, service_code)
  where status = 'active';

create index subscriptions_owner_status_idx
  on public.subscriptions (owner_id, status);

create index subscriptions_owner_service_idx
  on public.subscriptions (owner_id, service_code);

create unique index members_one_owner_member_idx
  on public.members (owner_id)
  where is_owner = true;

create index members_owner_status_idx
  on public.members (owner_id, status);

create index members_owner_display_name_idx
  on public.members (owner_id, display_name);

create unique index subscription_members_one_open_membership_idx
  on public.subscription_members (subscription_id, member_id)
  where end_date is null;

create index subscription_members_subscription_dates_idx
  on public.subscription_members (subscription_id, start_date, end_date);

create index subscription_members_member_start_idx
  on public.subscription_members (member_id, start_date desc);

create index subscription_members_owner_frequency_idx
  on public.subscription_members (owner_id, payment_frequency);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger subscription_members_set_updated_at
before update on public.subscription_members
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.members enable row level security;
alter table public.subscription_members enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (owner_id = auth.uid());

create policy subscriptions_insert_own
on public.subscriptions
for insert
to authenticated
with check (owner_id = auth.uid());

create policy subscriptions_update_own
on public.subscriptions
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy members_select_own
on public.members
for select
to authenticated
using (owner_id = auth.uid());

create policy members_insert_own
on public.members
for insert
to authenticated
with check (owner_id = auth.uid());

create policy members_update_own
on public.members
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy subscription_members_select_own
on public.subscription_members
for select
to authenticated
using (owner_id = auth.uid());

create policy subscription_members_insert_own
on public.subscription_members
for insert
to authenticated
with check (owner_id = auth.uid());

create policy subscription_members_update_own
on public.subscription_members
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

revoke all on table public.profiles from anon;
revoke all on table public.subscriptions from anon;
revoke all on table public.members from anon;
revoke all on table public.subscription_members from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.subscriptions to authenticated;
grant select, insert, update on table public.members to authenticated;
grant select, insert, update on table public.subscription_members to authenticated;

-- DELETE is intentionally not granted and no DELETE policies are created.
-- Historical membership data must be closed or deactivated, not hard-deleted.

commit;
