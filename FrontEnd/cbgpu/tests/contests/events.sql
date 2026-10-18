\set ON_ERROR_STOP on
begin;
insert into auth.users values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000004');
create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', description; end if; end $$;
create function pg_temp.expect_failure(command text, description text) returns void language plpgsql as $$
declare failed boolean := false;
begin begin execute command; exception when others then failed := true; end;
if not failed then raise exception 'FAILED (unexpected success): %', description; end if; end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.contests(id,host_id,title,fields,event_start_at,event_end_at,location_type,location_name,address,capacity,registration_questions) values (
 '40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','통합 행사',
 '[{"id":"20000000-0000-4000-8000-000000000001","type":"text","label":"작품 소개","description":"","required":false}]',
 clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 2 hours','hybrid','강당','본관 1층',1,
 '[{"id":"50000000-0000-4000-8000-000000000001","type":"text","label":"소속","required":true,"options":[]}]');
insert into public.event_access_details(contest_id,meeting_url,access_note) values ('40000000-0000-4000-8000-000000000001','https://example.com/private','입장 암호 1234');
insert into public.event_hosts(contest_id,user_id,role) values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','checkin');

-- The first guest is confirmed and can read protected join details.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_failure($q$insert into public.event_registrations(contest_id,user_id,attendee_name,answers) values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','첫 참가자','{}')$q$,'required registration answer is enforced');
insert into public.event_registrations(contest_id,user_id,attendee_name,answers) values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','첫 참가자','{"50000000-0000-4000-8000-000000000001":"1학년"}');
select pg_temp.assert_true((select status='confirmed' from public.event_registrations),'first guest is confirmed');
select pg_temp.assert_true((select count(*)=1 from public.event_access_details),'confirmed guest reads private access details');
select pg_temp.expect_failure($q$update public.event_registrations set attendee_name='변조' where user_id='00000000-0000-4000-8000-000000000002'$q$,'guest cannot alter registration answers');

-- Capacity is serialized by the contest row lock, so the next guest is waitlisted.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
insert into public.event_registrations(contest_id,user_id,attendee_name,answers) values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','둘째 참가자','{"50000000-0000-4000-8000-000000000001":"2학년"}');
select pg_temp.assert_true((select status='waitlisted' from public.event_registrations),'capacity overflow enters waitlist');
select pg_temp.assert_true((select count(*)=0 from public.event_access_details),'waitlisted guest cannot read private join link');

-- Check-in staff can stamp a confirmed ticket but cannot approve or edit guests.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
update public.event_registrations set checked_in_at=clock_timestamp() where user_id='00000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select checked_in_at is not null from public.event_registrations where user_id='00000000-0000-4000-8000-000000000002'),'check-in staff can check in a confirmed guest');
select pg_temp.expect_failure($q$update public.event_registrations set status='confirmed' where user_id='00000000-0000-4000-8000-000000000003'$q$,'check-in staff cannot approve waitlist');

-- The host manages approval, sessions and announcements.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.event_registrations set status='confirmed' where user_id='00000000-0000-4000-8000-000000000003';
insert into public.event_sessions(contest_id,title,starts_at,ends_at,location) values ('40000000-0000-4000-8000-000000000001','개회식',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 30 minutes','강당');
insert into public.event_announcements(contest_id,author_id,title,content,audience) values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','준비물','노트북을 가져오세요.','confirmed');
select pg_temp.assert_true((select count(*)=2 from public.event_registrations),'host reads all registrations');

-- A participant may cancel their own application, and nothing else.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
update public.event_registrations set status='cancelled' where user_id='00000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select status='cancelled' from public.event_registrations),'participant can cancel');
select pg_temp.expect_failure($q$update public.event_registrations set status='confirmed' where user_id='00000000-0000-4000-8000-000000000002'$q$,'participant cannot restore or self-approve');
rollback;
\echo 'PASS: event registration, capacity, waitlist, private access, check-in roles and host operations'
