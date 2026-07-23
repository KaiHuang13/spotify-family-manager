-- Make a member's billing start date default to the actual Spotify Family join date.

begin;

set search_path = public, extensions;

drop function if exists public.create_member_with_subscription(text, date, date, text);

create or replace function public.create_member_with_subscription(
  p_display_name text,
  p_joined_on date,
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
  v_subscription_started_on date;
  v_member_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Display name is required.' using errcode = '22023';
  end if;

  if p_joined_on is null then
    raise exception 'Member join date is required.' using errcode = '22023';
  end if;

  select subscriptions.id, subscriptions.started_on
  into v_subscription_id, v_subscription_started_on
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

  if p_joined_on < v_subscription_started_on then
    raise exception 'Member join date cannot precede the Spotify plan start date.'
      using errcode = '22023';
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
    p_joined_on
  );

  return v_member_id;
end;
$$;

revoke all privileges
on function public.create_member_with_subscription(text, date, text)
from public, anon;

grant execute
on function public.create_member_with_subscription(text, date, text)
to authenticated;

commit;
