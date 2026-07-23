-- Deactivate a member without deleting membership or financial history.

begin;

set search_path = public, extensions;

create or replace function public.deactivate_member(
  p_member_id uuid,
  p_exited_on date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_updated_member_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_member_id is null or p_exited_on is null then
    raise exception 'Member and exit date are required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.subscription_members
    where subscription_members.owner_id = v_owner_id
      and subscription_members.member_id = p_member_id
      and subscription_members.end_date is null
      and p_exited_on <= subscription_members.start_date
  ) then
    raise exception 'Exit date must be later than subscription start date.'
      using errcode = '22023';
  end if;

  update public.subscription_members
  set end_date = p_exited_on
  where subscription_members.owner_id = v_owner_id
    and subscription_members.member_id = p_member_id
    and subscription_members.end_date is null;

  update public.members
  set
    status = 'inactive',
    deactivated_on = p_exited_on
  where members.id = p_member_id
    and members.owner_id = v_owner_id
    and members.status = 'active'
  returning members.id into v_updated_member_id;

  if v_updated_member_id is null then
    raise exception 'Active member was not found.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all privileges
on function public.deactivate_member(uuid, date)
from public, anon;

grant execute
on function public.deactivate_member(uuid, date)
to authenticated;

commit;
