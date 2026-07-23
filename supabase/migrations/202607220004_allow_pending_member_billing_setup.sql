-- Allow a member and subscription period to be created before billing terms
-- are configured. This migration also provides one atomic create operation.

begin;

set search_path = public, extensions;

alter table public.members
  add column joined_on date;

alter table public.subscription_members
  alter column payment_frequency drop default,
  alter column payment_frequency drop not null,
  alter column monthly_share_minor drop not null,
  alter column cycle_amount_minor drop not null,
  alter column currency drop default,
  alter column currency drop not null,
  alter column billing_anchor_date drop not null;

alter table public.subscription_members
  add constraint subscription_members_billing_setup_completeness_check
  check (
    (
      payment_frequency is null
      and monthly_share_minor is null
      and cycle_amount_minor is null
      and currency is null
      and billing_anchor_date is null
    )
    or (
      payment_frequency is not null
      and monthly_share_minor is not null
      and cycle_amount_minor is not null
      and currency is not null
      and billing_anchor_date is not null
    )
  );

create or replace function public.create_member_with_subscription(
  p_display_name text,
  p_joined_on date,
  p_subscription_start_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_subscription_id uuid;
  v_member_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Display name is required.' using errcode = '22023';
  end if;

  if p_joined_on is null or p_subscription_start_date is null then
    raise exception 'Member dates are required.' using errcode = '22023';
  end if;

  if p_subscription_start_date < p_joined_on then
    raise exception 'Subscription start date cannot precede joined date.'
      using errcode = '22023';
  end if;

  select subscriptions.id
  into v_subscription_id
  from public.subscriptions
  where subscriptions.owner_id = v_owner_id
    and subscriptions.service_code = 'spotify'
    and subscriptions.status = 'active'
  order by subscriptions.started_on desc
  limit 1;

  if v_subscription_id is null then
    raise exception 'An active Spotify subscription is required.'
      using errcode = 'P0001';
  end if;

  insert into public.members (
    owner_id,
    display_name,
    joined_on,
    notes
  )
  values (
    v_owner_id,
    btrim(p_display_name),
    p_joined_on,
    nullif(btrim(p_notes), '')
  )
  returning id into v_member_id;

  insert into public.subscription_members (
    owner_id,
    subscription_id,
    member_id,
    start_date
  )
  values (
    v_owner_id,
    v_subscription_id,
    v_member_id,
    p_subscription_start_date
  );

  return v_member_id;
end;
$$;

revoke all privileges
on function public.create_member_with_subscription(text, date, date, text)
from public, anon;

grant execute
on function public.create_member_with_subscription(text, date, date, text)
to authenticated;

commit;
