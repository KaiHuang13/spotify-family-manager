-- Second-phase billing schema for Spotify Family Manager.
-- This migration intentionally creates only:
-- billing_periods, member_charges, and payments.

begin;

set search_path = public, extensions;

-- Required for composite ownership-safe references from member_charges.
-- The first migration file remains unchanged.
alter table public.subscription_members
  add constraint subscription_members_id_owner_subscription_unique
  unique (id, owner_id, subscription_id);

create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subscription_id uuid not null,
  period_start date not null,
  period_end date not null,
  provider_cost_minor bigint not null,
  currency char(3) not null default 'TWD',
  status text not null default 'draft',
  confirmed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_periods_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint billing_periods_subscription_owner_fk
    foreign key (subscription_id, owner_id)
    references public.subscriptions (id, owner_id)
    on delete restrict,
  constraint billing_periods_subscription_dates_unique
    unique (subscription_id, period_start, period_end),
  constraint billing_periods_id_owner_subscription_unique
    unique (id, owner_id, subscription_id),
  constraint billing_periods_dates_check
    check (period_end > period_start),
  constraint billing_periods_provider_cost_nonnegative_check
    check (provider_cost_minor >= 0),
  constraint billing_periods_currency_format_check
    check (currency::text ~ '^[A-Z]{3}$'),
  constraint billing_periods_status_check
    check (status in ('draft', 'confirmed', 'closed', 'void')),
  constraint billing_periods_status_timestamps_check
    check (
      (
        status = 'draft'
        and confirmed_at is null
        and voided_at is null
        and void_reason is null
      )
      or (
        status in ('confirmed', 'closed')
        and confirmed_at is not null
        and voided_at is null
        and void_reason is null
      )
      or (
        status = 'void'
        and voided_at is not null
        and void_reason is not null
        and btrim(void_reason) <> ''
      )
    ),
  constraint billing_periods_no_overlapping_active_periods
    exclude using gist (
      subscription_id with =,
      daterange(period_start, period_end, '[)') with &&
    )
    where (status <> 'void')
    deferrable initially immediate
);

create table public.member_charges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subscription_id uuid not null,
  billing_period_id uuid not null,
  subscription_member_id uuid not null,
  collection_cycle_id uuid not null default gen_random_uuid(),
  cycle_sequence smallint not null default 1,
  cycle_length smallint not null default 1,
  coverage_start date not null,
  coverage_end date not null,
  amount_minor bigint not null,
  currency char(3) not null default 'TWD',
  due_date date not null,
  payment_frequency_snapshot text not null,
  calculation_method text not null default 'fixed',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint member_charges_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint member_charges_billing_period_owner_subscription_fk
    foreign key (billing_period_id, owner_id, subscription_id)
    references public.billing_periods (id, owner_id, subscription_id)
    on delete restrict,
  constraint member_charges_subscription_member_owner_subscription_fk
    foreign key (subscription_member_id, owner_id, subscription_id)
    references public.subscription_members (id, owner_id, subscription_id)
    on delete restrict,
  constraint member_charges_billing_member_unique
    unique (billing_period_id, subscription_member_id),
  constraint member_charges_id_owner_currency_unique
    unique (id, owner_id, currency),
  constraint member_charges_coverage_dates_check
    check (coverage_end > coverage_start),
  constraint member_charges_amount_nonnegative_check
    check (amount_minor >= 0),
  constraint member_charges_currency_format_check
    check (currency::text ~ '^[A-Z]{3}$'),
  constraint member_charges_cycle_length_positive_check
    check (cycle_length > 0),
  constraint member_charges_cycle_sequence_check
    check (cycle_sequence between 1 and cycle_length),
  constraint member_charges_payment_frequency_check
    check (payment_frequency_snapshot in ('monthly', 'yearly')),
  constraint member_charges_calculation_method_not_blank_check
    check (btrim(calculation_method) <> ''),
  constraint member_charges_calculation_snapshot_object_check
    check (jsonb_typeof(calculation_snapshot) = 'object'),
  constraint member_charges_void_check
    check (
      (
        voided_at is null
        and void_reason is null
      )
      or (
        voided_at is not null
        and void_reason is not null
        and btrim(void_reason) <> ''
      )
    )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  member_charge_id uuid not null,
  amount_minor bigint not null,
  currency char(3) not null default 'TWD',
  paid_at timestamptz not null,
  payment_method text,
  reference text,
  notes text,
  status text not null default 'posted',
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_owner_fk
    foreign key (owner_id)
    references public.profiles (id)
    on delete restrict,
  constraint payments_member_charge_owner_currency_fk
    foreign key (member_charge_id, owner_id, currency)
    references public.member_charges (id, owner_id, currency)
    on delete restrict,
  constraint payments_amount_positive_check
    check (amount_minor > 0),
  constraint payments_currency_format_check
    check (currency::text ~ '^[A-Z]{3}$'),
  constraint payments_payment_method_not_blank_check
    check (payment_method is null or btrim(payment_method) <> ''),
  constraint payments_reference_not_blank_check
    check (reference is null or btrim(reference) <> ''),
  constraint payments_status_check
    check (status in ('posted', 'void')),
  constraint payments_status_void_check
    check (
      (
        status = 'posted'
        and voided_at is null
        and void_reason is null
      )
      or (
        status = 'void'
        and voided_at is not null
        and void_reason is not null
        and btrim(void_reason) <> ''
      )
    )
);

create index billing_periods_subscription_start_idx
  on public.billing_periods (subscription_id, period_start desc);

create index billing_periods_owner_status_start_idx
  on public.billing_periods (owner_id, status, period_start desc);

create index member_charges_subscription_member_coverage_idx
  on public.member_charges (subscription_member_id, coverage_start desc);

create index member_charges_collection_cycle_idx
  on public.member_charges (collection_cycle_id, cycle_sequence);

create index member_charges_owner_due_date_idx
  on public.member_charges (owner_id, due_date);

create index member_charges_billing_period_idx
  on public.member_charges (billing_period_id);

create index payments_member_charge_paid_at_idx
  on public.payments (member_charge_id, paid_at desc);

create index payments_owner_paid_at_idx
  on public.payments (owner_id, paid_at desc);

create index payments_owner_status_idx
  on public.payments (owner_id, status);

create trigger billing_periods_set_updated_at
before update on public.billing_periods
for each row execute function public.set_updated_at();

create trigger member_charges_set_updated_at
before update on public.member_charges
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

alter table public.billing_periods enable row level security;
alter table public.member_charges enable row level security;
alter table public.payments enable row level security;

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

revoke all on table public.billing_periods from anon;
revoke all on table public.member_charges from anon;
revoke all on table public.payments from anon;

grant select, insert, update on table public.billing_periods to authenticated;
grant select, insert, update on table public.member_charges to authenticated;
grant select, insert, update on table public.payments to authenticated;

-- DELETE is intentionally not granted and no DELETE policies are created.
-- Charge payment state is derived from posted payment totals and due dates;
-- no mutable paid boolean is stored.

commit;
