-- This migration version is intentionally retained so environments that
-- already recorded it do not develop a migration-history gap.
--
-- Test administrator data has moved to supabase/seed.sql. Schema migrations
-- must not depend on a particular auth.users row already existing.

begin;

set search_path = public, extensions;

commit;
