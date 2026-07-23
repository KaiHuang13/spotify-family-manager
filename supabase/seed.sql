-- Optional local/test seed data.
--
-- Auth users should be created through Supabase Auth rather than inserted
-- directly into auth.users. This seed initializes business data for the first
-- existing Auth user and safely does nothing when no Auth user exists.

begin;

set search_path = public, extensions;

do $$
declare
  v_admin_id uuid;
  v_admin_name text;
begin
  select
    auth.users.id,
    coalesce(
      nullif(auth.users.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(auth.users.email, '@', 1), ''),
      'test-administrator'
    )
  into v_admin_id, v_admin_name
  from auth.users
  order by auth.users.created_at
  limit 1;

  if v_admin_id is null then
    raise notice
      'Seed skipped: create a test user through Supabase Auth, then rerun this seed.';
    return;
  end if;

  insert into public.profiles (
    id,
    display_name,
    default_currency,
    business_timezone
  )
  values (
    v_admin_id,
    v_admin_name,
    'TWD',
    'Asia/Taipei'
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.subscriptions
    where subscriptions.owner_id = v_admin_id
      and subscriptions.service_code = 'spotify'
      and subscriptions.status = 'active'
  ) then
    insert into public.subscriptions (
      owner_id,
      service_code,
      plan_name,
      status,
      seat_limit,
      current_cost_minor,
      currency,
      provider_billing_cycle,
      current_cost_effective_from,
      started_on
    )
    values (
      v_admin_id,
      'spotify',
      'Spotify Premium Family',
      'active',
      6,
      298,
      'TWD',
      'monthly',
      date '2026-07-06',
      date '2026-07-06'
    );
  end if;
end;
$$;

commit;
