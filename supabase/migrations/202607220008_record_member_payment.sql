-- Record one independent manual payment for an existing member charge.
-- This migration never updates the original member charge amount.

begin;

set search_path = public, extensions;

create or replace function public.record_member_payment(
  p_member_charge_id uuid,
  p_amount_minor bigint,
  p_paid_on date,
  p_payment_method text,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_currency char(3);
  v_business_timezone text;
  v_payment_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_member_charge_id is null or p_paid_on is null then
    raise exception 'Member charge and payment date are required.'
      using errcode = '22023';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Payment amount must be positive.' using errcode = '22023';
  end if;

  if p_payment_method is null or btrim(p_payment_method) = '' then
    raise exception 'Payment method is required.' using errcode = '22023';
  end if;

  select member_charges.currency, profiles.business_timezone
  into v_currency, v_business_timezone
  from public.member_charges
  join public.billing_periods
    on billing_periods.id = member_charges.billing_period_id
    and billing_periods.owner_id = member_charges.owner_id
  join public.profiles
    on profiles.id = member_charges.owner_id
  where member_charges.id = p_member_charge_id
    and member_charges.owner_id = v_owner_id
    and member_charges.voided_at is null
    and billing_periods.status <> 'void';

  if v_currency is null then
    raise exception 'Member charge was not found.' using errcode = 'P0001';
  end if;

  insert into public.payments (
    owner_id,
    member_charge_id,
    amount_minor,
    currency,
    paid_at,
    payment_method,
    notes
  )
  values (
    v_owner_id,
    p_member_charge_id,
    p_amount_minor,
    v_currency,
    p_paid_on::timestamp at time zone v_business_timezone,
    btrim(p_payment_method),
    nullif(btrim(p_notes), '')
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all privileges
on function public.record_member_payment(uuid, bigint, date, text, text)
from public, anon;

grant execute
on function public.record_member_payment(uuid, bigint, date, text, text)
to authenticated;

commit;
