-- Path Match: private accounts, saved matches, application tracker, email events.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table carries user_id and has Row-Level Security: a signed-in user can only ever read or
-- change their own rows, even if the page code has a bug.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  -- secret local part of the user's forwarding address: <inbox_token>@<your inbound domain>
  inbox_token     text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  work_permit     text,
  target_term     text,
  ghost_days      int  not null default 21 check (ghost_days between 7 and 90),
  -- parsed CV keywords with short excerpts. The CV file and its full text are never stored.
  cv_keywords     jsonb,
  cv_saved_at     timestamptz,
  last_inbound_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- matches
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  job_key    text not null,               -- normalised "company|title"
  company    text not null,
  title      text not null,
  loc        text,
  url        text,
  source     text,
  posted_on  date,
  score      int  not null,
  role_fit   int,
  level_fit  int,
  overlap    int,
  flags      jsonb,
  saved_at   timestamptz not null default now(),
  unique (user_id, job_key)
);

-- ---------------------------------------------------------------- applications
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_key           text not null,
  company           text not null,
  title             text not null,
  loc               text,
  url               text,
  source            text,
  status            text not null default 'applied'
                    check (status in ('applied','interview','offer','rejected','withdrawn')),
  status_source     text not null default 'applied' check (status_source in ('applied','manual','email')),
  status_updated_at timestamptz not null default now(),
  applied_at        timestamptz not null default now(),
  confirmed_at      timestamptz,          -- first "we received your application" email
  last_email_at     timestamptz,
  notes             text,
  unique (user_id, job_key)
);
create index if not exists applications_user_idx on public.applications (user_id, applied_at desc);

-- ---------------------------------------------------------------- email events
-- One row per recognised job email. The body is never stored.
create table if not exists public.email_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  message_id     text not null,
  kind           text not null check (kind in ('confirmation','interview','rejection','offer','verification')),
  confidence     text check (confidence in ('high','medium','low')),
  from_domain    text,
  subject_hint   text,                    -- first 100 characters of the subject (see STORE_SUBJECT)
  received_at    timestamptz not null,
  needs_review   boolean not null default false,
  candidates     uuid[] not null default '{}',
  note           text,                    -- Gmail forwarding confirmation code
  created_at     timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists email_events_user_idx on public.email_events (user_id, received_at desc);

-- ---------------------------------------------------------------- blocked companies
create table if not exists public.blocked_companies (
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_key text not null,
  company     text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, company_key)
);

-- ---------------------------------------------------------------- row-level security
alter table public.profiles          enable row level security;
alter table public.matches           enable row level security;
alter table public.applications      enable row level security;
alter table public.email_events      enable row level security;
alter table public.blocked_companies enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists matches_all on public.matches;
create policy matches_all on public.matches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists applications_all on public.applications;
create policy applications_all on public.applications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists email_events_select on public.email_events;
drop policy if exists email_events_update on public.email_events;
drop policy if exists email_events_delete on public.email_events;
create policy email_events_select on public.email_events for select to authenticated using (user_id = auth.uid());
create policy email_events_update on public.email_events for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy email_events_delete on public.email_events for delete to authenticated using (user_id = auth.uid());

drop policy if exists blocked_all on public.blocked_companies;
create policy blocked_all on public.blocked_companies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- table privileges (defence in depth)
-- Anonymous visitors get nothing. Signed-in users get only the columns the page needs to write.
revoke all on public.profiles, public.matches, public.applications, public.email_events, public.blocked_companies from anon;

revoke insert, update on public.profiles from authenticated;
grant  insert (user_id) on public.profiles to authenticated;
grant  update (work_permit, target_term, ghost_days, cv_keywords, cv_saved_at) on public.profiles to authenticated;

-- inbox_token is read-only for the page; it can only change through rotate_inbox_token().
-- email events are written only by the server (service role); the user may mark one reviewed.
revoke insert, update on public.email_events from authenticated;
grant  update (needs_review) on public.email_events to authenticated;

-- ---------------------------------------------------------------- new user -> profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- view with the "ghosted" status
-- Ghosted is derived, never stored: still "applied" after ghost_days with no interview/rejection/offer.
create or replace view public.applications_view with (security_invoker = true) as
select a.*,
       case when a.status = 'applied'
                 and now() - a.applied_at > make_interval(days => p.ghost_days)
            then 'ghosted' else a.status end as effective_status,
       p.ghost_days
from public.applications a
join public.profiles p on p.user_id = a.user_id;

grant select on public.applications_view to authenticated;
revoke all on public.applications_view from anon;

-- ---------------------------------------------------------------- status transitions (server only)
-- Called by the inbound-email function (service role) and by assign_email_event().
-- An email only changes the status if it is newer than the last status change, so an old forwarded
-- email can never undo something the user set by hand.
create or replace function public.apply_email_event(p_user uuid, p_app uuid, p_kind text, p_received timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.applications%rowtype;
  new_status text;
begin
  select * into a from public.applications where id = p_app and user_id = p_user for update;
  if not found then return; end if;

  update public.applications
     set last_email_at = greatest(coalesce(last_email_at, '-infinity'::timestamptz), p_received),
         confirmed_at  = case when p_kind = 'confirmation' then coalesce(confirmed_at, p_received) else confirmed_at end
   where id = a.id;

  new_status := case p_kind
                  when 'interview' then 'interview'
                  when 'offer'     then 'offer'
                  when 'rejection' then 'rejected'
                  else null end;

  if new_status is not null and new_status <> a.status and p_received > a.status_updated_at then
    update public.applications
       set status = new_status, status_source = 'email', status_updated_at = p_received
     where id = a.id;
  end if;
end $$;

revoke all on function public.apply_email_event(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_email_event(uuid, uuid, text, timestamptz) to service_role;

-- ---------------------------------------------------------------- user-callable helpers
create or replace function public.assign_email_event(p_event uuid, p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.email_events%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into e from public.email_events where id = p_event and user_id = auth.uid() for update;
  if not found then raise exception 'email not found'; end if;
  if not exists (select 1 from public.applications where id = p_app and user_id = auth.uid()) then
    raise exception 'application not found';
  end if;
  update public.email_events set application_id = p_app, needs_review = false where id = p_event;
  perform public.apply_email_event(auth.uid(), p_app, e.kind, e.received_at);
end $$;

create or replace function public.rotate_inbox_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  t := encode(extensions.gen_random_bytes(12), 'hex');
  update public.profiles set inbox_token = t where user_id = auth.uid();
  return t;
end $$;

revoke all on function public.assign_email_event(uuid, uuid) from public, anon;
revoke all on function public.rotate_inbox_token() from public, anon;
grant execute on function public.assign_email_event(uuid, uuid) to authenticated;
grant execute on function public.rotate_inbox_token() to authenticated;

-- ---------------------------------------------------------------- live updates for the tracker tab
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications') then
      alter publication supabase_realtime add table public.applications;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'email_events') then
      alter publication supabase_realtime add table public.email_events;
    end if;
  end if;
end $$;
