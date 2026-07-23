-- Configure a member's payment cycle without creating payments, charges, or
-- prepaid-balance allocations.

begin;

set search_path = public, extensions;

create or replace function public.configure_member_payment_cycle(
  p_subscription_member_id uuid,
  p_payment_cycle text,
  p_monthly_share_amount bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_updated_subscription_member_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_subscription_member_id is null then
    raise exception 'Subscription member is required.' using errcode = '22023';
  end if;

  if p_payment_cycle is null
    or p_payment_cycle not in ('monthly', 'yearly') then
    raise exception 'Payment cycle must be monthly or yearly.'
      using errcode = '22023';
  end if;

  if p_monthly_share_amount is null or p_monthly_share_amount < 0 then
    raise exception 'Monthly share amount must be nonnegative.'
      using errcode = '22023';
  end if;

  update public.subscription_members
  set
    payment_frequency = p_payment_cycle,
    monthly_share_minor = p_monthly_share_amount,
    cycle_amount_minor = case
      when p_payment_cycle = 'monthly' then p_monthly_share_amount
      else p_monthly_share_amount * 12
    end,
    currency = subscriptions.currency,
    billing_anchor_date = subscription_members.start_date
  from public.subscriptions
  where subscription_members.id = p_subscription_member_id
    and subscription_members.owner_id = v_owner_id
    and subscription_members.end_date is null
    and subscription_members.payment_frequency is null
    and subscription_members.monthly_share_minor is null
    and subscription_members.cycle_amount_minor is null
    and subscription_members.currency is null
    and subscription_members.billing_anchor_date is null
    and subscriptions.id = subscription_members.subscription_id
    and subscriptions.owner_id = v_owner_id
  returning subscription_members.id into v_updated_subscription_member_id;

  if v_updated_subscription_member_id is null then
    raise exception 'Active subscription member was not found.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all privileges
on function public.configure_member_payment_cycle(uuid, text, bigint)
from public, anon;

grant execute
on function public.configure_member_payment_cycle(uuid, text, bigint)
to authenticated;

commit;
