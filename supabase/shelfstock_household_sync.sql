-- Applied to Supabase project "TheGarden" (rmshsswlodfvdffnlqdy) as migration shelfstock_household_sync.
-- Everything lives in its own `shelfstock` schema (not exposed through the API); the app only
-- calls the three public.shelfstock_* functions, gated by the household code.

create schema if not exists shelfstock;
revoke all on schema shelfstock from public, anon, authenticated;

create table if not exists shelfstock.households (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Our Kitchen',
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table shelfstock.households enable row level security;
revoke all on shelfstock.households from public, anon, authenticated;

create or replace function public.shelfstock_create(p_name text, p_state jsonb)
returns table (code text, version integer)
language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  if pg_column_size(p_state) > 3000000 then raise exception 'kitchen too large'; end if;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from shelfstock.households h where h.code = v_code);
  end loop;
  insert into shelfstock.households (code, name, state) values (v_code, coalesce(nullif(trim(p_name), ''), 'Our Kitchen'), coalesce(p_state, '{}'::jsonb));
  return query select v_code, 1;
end $$;

create or replace function public.shelfstock_pull(p_code text)
returns table (name text, state jsonb, version integer, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select h.name, h.state, h.version, h.updated_at from shelfstock.households h where h.code = upper(trim(p_code));
$$;

-- Optimistic concurrency: only writes when the caller saw the latest version;
-- otherwise returns the newer cloud copy so the device can reconcile.
create or replace function public.shelfstock_push(p_code text, p_state jsonb, p_base integer)
returns table (ok boolean, version integer, state jsonb)
language plpgsql security definer set search_path = ''
as $$
declare h shelfstock.households%rowtype;
begin
  if pg_column_size(p_state) > 3000000 then raise exception 'kitchen too large'; end if;
  select * into h from shelfstock.households x where x.code = upper(trim(p_code)) for update;
  if not found then raise exception 'unknown household'; end if;
  if h.version <> p_base then
    return query select false, h.version, h.state;
    return;
  end if;
  update shelfstock.households x set state = p_state, version = h.version + 1, updated_at = now() where x.id = h.id;
  return query select true, h.version + 1, null::jsonb;
end $$;

revoke all on function public.shelfstock_create(text, jsonb) from public;
revoke all on function public.shelfstock_pull(text) from public;
revoke all on function public.shelfstock_push(text, jsonb, integer) from public;
grant execute on function public.shelfstock_create(text, jsonb) to anon, authenticated;
grant execute on function public.shelfstock_pull(text) to anon, authenticated;
grant execute on function public.shelfstock_push(text, jsonb, integer) to anon, authenticated;

-- ---- migration shelfstock_notices: background notifications ----
create table if not exists shelfstock.notices (
  id bigserial primary key,
  household_id uuid not null references shelfstock.households(id) on delete cascade,
  by_member text, kind text not null, text text not null,
  data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists notices_household_id_idx on shelfstock.notices (household_id, id);
alter table shelfstock.notices enable row level security;
revoke all on shelfstock.notices from public, anon, authenticated;
-- public.shelfstock_notify(code, by, kind, text, data) → id   (keeps 14 days)
-- public.shelfstock_notices(code, after_id) → newer notices, oldest first
-- (full function bodies applied via the Supabase migration of the same name)
