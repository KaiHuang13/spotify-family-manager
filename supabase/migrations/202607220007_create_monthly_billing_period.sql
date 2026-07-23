-- Manually create one monthly billing period and its member charge snapshots.
-- This migration does not schedule future periods or apply yearly prepayments.

begin;

set search_path = public, extensions;

alter table public.billing_periods
  add column due_date date;

alter table public.billing_periods
  add constraint billing_periods_due_date_check
  check (due_date is null or due_date >= period_start);

create or replace function public.create_monthly_billing_period(
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_provider_cost_minor bigint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_subscription_id uuid;
  v_currency char(3);
  v_billing_period_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_period_start is null
    or p_period_end is null
    or p_due_date is null then
    raise exception 'Billing period dates are required.' using errcode = '22023';
  end if;

  if p_period_end <> (p_period_start + interval '1 month')::date then
    raise exception 'Billing period must span exactly one calendar month.'
      using errcode = '22023';
  end if;

  if p_due_date < p_period_start then
    raise exception 'Due date cannot precede the period start date.'
      using errcode = '22023';
  end if;

  if p_provider_cost_minor is null or p_provider_cost_minor < 0 then
    raise exception 'Provider cost must be nonnegative.' using errcode = '22023';
  end if;

  select subscriptions.id, subscriptions.currency
  into v_subscription_id, v_currency
  from public.subscriptions
  where subscriptions.owner_id = v_owner_id
    and subscriptions.service_code = 'spotify'
    and subscriptions.status = 'active'
    and subscriptions.started_on <= p_period_start
  order by subscriptions.started_on desc
  limit 1;

  if v_subscription_id is null then
    raise exception 'An active Spotify subscription is required.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.billing_periods
    where billing_periods.owner_id = v_owner_id
      and billing_periods.subscription_id = v_subscription_id
      and billing_periods.status <> 'void'
      and daterange(
        billing_periods.period_start,
        billing_periods.period_end,
        '[)'
      ) && daterange(p_period_start, p_period_end, '[)')
  ) then
    raise exception 'A billing period already exists for this date range.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.subscription_members
    where subscription_members.owner_id = v_owner_id
      and subscription_members.subscription_id = v_subscription_id
      and subscription_members.start_date <= p_period_start
      and (
        subscription_members.end_date is null
        or subscription_members.end_date > p_period_start
      )
      and (
        subscription_members.payment_frequency is null
        or subscription_members.monthly_share_minor is null
        or subscription_members.currency is null
      )
  ) then
    raise exception 'Every eligible member must have billing settings.'
      using errcode = 'P0001';
  end if;

  insert into public.billing_periods (
    owner_id,
    subscription_id,
    period_start,
    period_end,
    due_date,
    provider_cost_minor,
    currency
  )
  values (
    v_owner_id,
    v_subscription_id,
    p_period_start,
    p_period_end,
    p_due_date,
    p_provider_cost_minor,
    v_currency
  )
  returning id into v_billing_period_id;

  insert into public.member_charges (
    owner_id,
    subscription_id,
    billing_period_id,
    subscription_member_id,
    coverage_start,
    coverage_end,
    amount_minor,
    currency,
    due_date,
    payment_frequency_snapshot,
    calculation_method,
    calculation_snapshot
  )
  select
    v_owner_id,
    v_subscription_id,
    v_billing_period_id,
    subscription_members.id,
    p_period_start,
    p_period_end,
    subscription_members.monthly_share_minor,
    subscription_members.currency,
    p_due_date,
    subscription_members.payment_frequency,
    'monthly_share_snapshot',
    jsonb_build_object(
      'rule', 'active_at_period_start',
      'monthly_share_minor', subscription_members.monthly_share_minor,
      'payment_cycle', subscription_members.payment_frequency,
      'yearly_prepayment_applied', false
    )
  from public.subscription_members
  where subscription_members.owner_id = v_owner_id
    and subscription_members.subscription_id = v_subscription_id
    and subscription_members.start_date <= p_period_start
    and (
      subscription_members.end_date is null
      or subscription_members.end_date > p_period_start
    );

  return v_billing_period_id;
end;
$$;

revoke all privileges
on function public.create_monthly_billing_period(date, date, date, bigint)
from public, anon;

grant execute
on function public.create_monthly_billing_period(date, date, date, bigint)
to authenticated;

commit;
