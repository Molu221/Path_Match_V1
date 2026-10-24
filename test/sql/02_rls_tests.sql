-- Runs after the migration. Prints PASS/FAIL per check; any FAIL makes run_sql_tests.sh exit non-zero.
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create function t.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when coalesce(ok,false) then 'PASS' else 'FAIL' end, name; end $$;
create function t.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
create function t.n(q text) returns bigint language plpgsql as $$
declare c bigint; begin execute 'select count(*) from (' || q || ') s' into c; return c; end $$;
-- rows touched by a data-modifying statement (cannot be wrapped in a subquery)
create function t.m(q text) returns bigint language plpgsql as $$
declare c bigint; begin execute q; get diagnostics c = row_count; return c; end $$;
grant execute on all functions in schema t to anon, authenticated, service_role;

\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, email) values (:A, 'a@example.com'), (:B, 'b@example.com');
select t.check('signup trigger creates a profile per user', (select count(*) from public.profiles) = 2);
select t.check('inbox token is 24 hex chars', (select bool_and(inbox_token ~ '^[0-9a-f]{24}$') from public.profiles));
select t.check('inbox tokens differ between users', (select count(distinct inbox_token) from public.profiles) = 2);

-- seed data for both users as superuser
insert into public.applications (user_id, job_key, company, title, applied_at, status_updated_at) values
  (:A, 'bombardier|qa intern', 'Bombardier', 'Intern, Quality Analyst', now() - interval '2 days', now() - interval '2 days'),
  (:A, 'cae|ci intern',        'CAE',        'Continuous Improvement Intern', now() - interval '30 days', now() - interval '30 days'),
  (:B, 'moderna|coop',         'Moderna',    'Co-Op, Supply Chain Planning', now() - interval '1 day', now() - interval '1 day');
update public.applications set id = 'bbbbbbbb-0000-0000-0000-000000000001' where job_key = 'moderna|coop';
update public.applications set id = 'aaaaaaaa-0000-0000-0000-000000000001' where job_key = 'bombardier|qa intern';
insert into public.matches (user_id, job_key, company, title, score) values (:A, 'k', 'Bombardier', 'QA', 80), (:B, 'k', 'Moderna', 'SC', 70);
insert into public.blocked_companies (user_id, company_key, company) values (:A, 'x', 'X'), (:B, 'y', 'Y');
insert into public.email_events (user_id, message_id, kind, received_at, needs_review) values
  (:A, 'm-a', 'interview', now(), true), (:B, 'm-b', 'rejection', now(), true);
update public.email_events set id = 'bbbbbbbb-0000-0000-0000-0000000000e1' where message_id = 'm-b';
update public.email_events set id = 'aaaaaaaa-0000-0000-0000-0000000000e1' where message_id = 'm-a';

-- ============================== user A ==============================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select t.check('A sees only own profile',        t.n('select 1 from public.profiles') = 1);
select t.check('A sees only own applications',   t.n('select 1 from public.applications') = 2);
select t.check('A sees only own matches',        t.n('select 1 from public.matches') = 1);
select t.check('A sees only own blocked list',   t.n('select 1 from public.blocked_companies') = 1);
select t.check('A sees only own email events',   t.n('select 1 from public.email_events') = 1);
select t.check('A sees only own rows in the view', t.n('select 1 from public.applications_view') = 2);
select t.check('A cannot read B applications by id', t.n($$select 1 from public.applications where user_id = '22222222-2222-2222-2222-222222222222'$$) = 0);
select t.check('A cannot insert an application for B', t.fails($$insert into public.applications (user_id, job_key, company, title) values ('22222222-2222-2222-2222-222222222222','z','Z','Z')$$));
select t.check('A cannot insert a match for B',        t.fails($$insert into public.matches (user_id, job_key, company, title, score) values ('22222222-2222-2222-2222-222222222222','z','Z','Z',1)$$));
select t.check('A cannot update B application (0 rows)', t.m($$with u as (update public.applications set status='rejected' where user_id='22222222-2222-2222-2222-222222222222' returning 1) select * from u$$) = 0);
select t.check('A cannot delete B application (0 rows)', t.m($$with u as (delete from public.applications where user_id='22222222-2222-2222-2222-222222222222' returning 1) select * from u$$) = 0);
select t.check('A cannot move own row to B (with check)', t.fails($$update public.applications set user_id='22222222-2222-2222-2222-222222222222' where job_key='cae|ci intern'$$));
select t.check('A cannot change inbox_token directly',  t.fails($$update public.profiles set inbox_token='aaaaaaaaaaaaaaaaaaaaaaaa'$$));
select t.check('A can update own profile settings',     t.m($$with u as (update public.profiles set work_permit='ok', ghost_days=14 where user_id='11111111-1111-1111-1111-111111111111' returning 1) select * from u$$) = 1);
select t.check('A cannot insert email events (server only)', t.fails($$insert into public.email_events (user_id, message_id, kind, received_at) values ('11111111-1111-1111-1111-111111111111','forged','interview',now())$$));
select t.check('A cannot rewrite an event kind',        t.fails($$update public.email_events set kind='offer'$$));
select t.check('A can mark own event reviewed',         t.m($$with u as (update public.email_events set needs_review=false where message_id='m-a' returning 1) select * from u$$) = 1);
select t.check('A cannot execute apply_email_event',    t.fails($$select public.apply_email_event('11111111-1111-1111-1111-111111111111', (select id from public.applications limit 1), 'offer', now())$$));
select t.check('A cannot assign an event of B (real ids)',      t.fails($$select public.assign_email_event('bbbbbbbb-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000001')$$));
select t.check('A cannot attach own event to B application',    t.fails($$select public.assign_email_event('aaaaaaaa-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000001')$$));

-- ghosted is derived from ghost_days (A set 14 above): 30-day-old application is ghosted, 2-day-old is not
select t.check('old application is ghosted',   (select effective_status from public.applications_view where job_key='cae|ci intern') = 'ghosted');
select t.check('fresh application is applied', (select effective_status from public.applications_view where job_key='bombardier|qa intern') = 'applied');
select t.check('stored status is untouched by ghosting', (select status from public.applications where job_key='cae|ci intern') = 'applied');

-- assign own event to own application: status follows the email
select public.assign_email_event((select id from public.email_events where message_id='m-a'), (select id from public.applications where job_key='bombardier|qa intern'));
select t.check('assign_email_event applies interview status', (select status from public.applications where job_key='bombardier|qa intern') = 'interview');
select t.check('assigned event is linked and cleared',        (select application_id is not null and not needs_review from public.email_events where message_id='m-a'));

-- manual status then an older email must not override it
update public.applications set status='applied', status_source='manual', status_updated_at=now() where job_key='bombardier|qa intern';

-- rotate token only affects A
create temp table before_tokens as select user_id, inbox_token from public.profiles;
select t.check('rotate_inbox_token returns a new 24-hex token', public.rotate_inbox_token() ~ '^[0-9a-f]{24}$');
select t.check('rotate changed A token', (select inbox_token from public.profiles) <> (select inbox_token from before_tokens));

reset role;
select t.check('rotate did not touch B token', (select inbox_token from public.profiles where user_id = :B) is not null);

-- ============================== user B ==============================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.check('B sees only own applications', t.n('select 1 from public.applications') = 1);
select t.check('B does not see A events',      t.n($$select 1 from public.email_events where message_id='m-a'$$) = 0);
select t.check('B cannot attach own event to A application', t.fails($$select public.assign_email_event('bbbbbbbb-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000001')$$));
select t.check('B cannot assign an event of A',                  t.fails($$select public.assign_email_event('aaaaaaaa-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000001')$$));
reset role;
select t.check('failed cross-user assigns changed nothing', (select needs_review and application_id is null from public.email_events where message_id = 'm-b'));
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.check('B can assign own event to own application', not t.fails($$select public.assign_email_event('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000001')$$));
select t.check('B rejection email set B application to rejected', (select status from public.applications) = 'rejected');
reset role;

-- ============================== anonymous visitor ==============================
set role anon;
select t.check('anon cannot read applications', t.fails('select * from public.applications'));
select t.check('anon cannot read profiles',     t.fails('select * from public.profiles'));
select t.check('anon cannot read the view',     t.fails('select * from public.applications_view'));
select t.check('anon cannot read email events', t.fails('select * from public.email_events'));
select t.check('anon cannot call rotate_inbox_token', t.fails('select public.rotate_inbox_token()'));
reset role;

-- ============================== server (service role) ==============================
set role service_role;
select t.check('service role can insert events', not t.fails($$insert into public.email_events (user_id, message_id, kind, received_at) values ('11111111-1111-1111-1111-111111111111','s1','confirmation', now())$$));

select public.apply_email_event('11111111-1111-1111-1111-111111111111', (select id from public.applications where job_key='bombardier|qa intern'), 'rejection', now() - interval '1 day');
select t.check('older email does not override a newer manual status', (select status from public.applications where job_key='bombardier|qa intern') = 'applied');

select public.apply_email_event('11111111-1111-1111-1111-111111111111', (select id from public.applications where job_key='cae|ci intern'), 'confirmation', now() - interval '29 days');
select t.check('confirmation sets confirmed_at but keeps status applied',
  (select status = 'applied' and confirmed_at is not null from public.applications where job_key='cae|ci intern'));

select public.apply_email_event('11111111-1111-1111-1111-111111111111', (select id from public.applications where job_key='cae|ci intern'), 'rejection', now() - interval '10 days');
select t.check('newer rejection sets rejected', (select status = 'rejected' and status_source = 'email' from public.applications where job_key='cae|ci intern'));

select public.apply_email_event('22222222-2222-2222-2222-222222222222', (select id from public.applications where job_key='cae|ci intern'), 'offer', now());
select t.check('apply_email_event refuses another user''s application',
  (select status from public.applications where job_key='cae|ci intern') = 'rejected');
reset role;

-- ============================== account deletion cascades ==============================
delete from auth.users where id = :A;
select t.check('deleting a user removes every row they own',
  (select count(*) from public.profiles where user_id = :A)
 + (select count(*) from public.applications where user_id = :A)
 + (select count(*) from public.matches where user_id = :A)
 + (select count(*) from public.email_events where user_id = :A)
 + (select count(*) from public.blocked_companies where user_id = :A) = 0);
select t.check('deleting A leaves B intact', (select count(*) from public.applications where user_id = :B) = 1);
