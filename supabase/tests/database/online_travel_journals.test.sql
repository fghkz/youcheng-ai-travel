begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

select has_table('public', 'travel_journeys', 'journeys table exists');
select has_table('public', 'travel_journey_stops', 'journey stops table exists');
select has_table('public', 'travel_journal_entries', 'journal entries table exists');
select has_table('public', 'travel_journal_media', 'journal media table exists');
select has_table('public', 'travel_page_documents', 'page documents table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.travel_journeys'::regclass), 'journeys has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_journey_stops'::regclass), 'stops has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_journal_entries'::regclass), 'entries has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_journal_media'::regclass), 'media has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_page_documents'::regclass), 'documents has RLS');
select has_function('public', 'start_travel_journey', array['bigint', 'text', 'text'], 'transactional journey starter exists');
select has_index('public', 'travel_journeys', 'travel_journeys_one_active_plan_idx', 'active journey idempotency index exists');
select is((select public from storage.buckets where id = 'travel-journal-media'), false, 'journal media bucket is private');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'journal-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('32000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'journal-other@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);

insert into public.trips (
  user_id, title, destination, start_date, end_date, daily_start_time, daily_end_time,
  transport_preference, status, final_content, final_route, finalized_at, version
) values (
  '31000000-0000-0000-0000-000000000001', '大理春日手记', '大理', '2026-09-12', '2026-09-13', '09:00', '18:00',
  'either', 'finalized',
  '{"days":[{"date":"2026-09-12","theme":"洱海","notes":"","items":[{"spotId":"erhai","placeName":"洱海","arrivalTime":"09:00","visitStartTime":"09:00","visitEndTime":"11:00","selected":true,"transport":"","accommodation":"","budget":"","reminder":"","notes":"","routeFromPrevious":null}]}],"warnings":[],"userRequest":""}',
  '{"days":[]}', now(), 2
);

select public.create_itinerary_version(
  (select id from public.trips where title = '大理春日手记'), '{}',
  '{"days":[{"date":"2026-09-12","theme":"洱海","items":[{"spotId":"erhai","arrivalTime":"09:00","visitStartTime":"09:00","visitEndTime":"11:00","routeFromPrevious":null}]}]}',
  '{}', 'test', 'test'
);

select lives_ok(
  $$select public.start_travel_journey((select id from public.trips where title = '大理春日手记'), 'dali-spring-a1b2c3', 'cute')$$,
  'owner can start a finalized journey'
);
select is((select count(*) from public.travel_journeys), 1::bigint, 'first start creates one journey');
select is((select count(*) from public.travel_journey_stops), 1::bigint, 'stops come from finalized content');
select is((select source_plan_version from public.travel_journeys limit 1), 2, 'journey stores the finalized plan version');
select lives_ok(
  $$select public.start_travel_journey((select id from public.trips where title = '大理春日手记'), 'ignored-slug-a1b2c3', 'elegant')$$,
  'repeated start returns the active journey'
);
select is((select count(*) from public.travel_journeys), 1::bigint, 'repeated start remains idempotent');

insert into public.travel_journal_entries (journey_id, stop_id, author_id, title, body, status, is_public, sort_order)
select j.id, s.id, j.owner_id, value.title, '{"type":"doc","content":[{"type":"paragraph","text":"记录"}]}', value.status, value.is_public, value.sort_order
from public.travel_journeys j join public.travel_journey_stops s on s.journey_id = j.id
cross join (values ('公开记录', 'ready', true, 1), ('草稿记录', 'draft', true, 2), ('私密记录', 'ready', false, 3)) as value(title, status, is_public, sort_order);

insert into public.travel_journal_media (journey_id, entry_id, stop_id, owner_id, storage_path, mime_type, size_bytes, sort_order)
select e.journey_id, e.id, e.stop_id, e.author_id, e.author_id::text || '/' || e.journey_id::text || '/' || e.sort_order || '.webp', 'image/webp', 1000, 1
from public.travel_journal_entries e;

select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.travel_journeys), 0::bigint, 'another user cannot read a private journey');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
update public.travel_journeys set visibility = 'public', published_at = now();

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.travel_journeys), 1::bigint, 'anonymous visitor reads a published journey');
select is((select count(*) from public.travel_journey_stops), 1::bigint, 'anonymous visitor reads public stops');
select is((select count(*) from public.travel_journal_entries), 1::bigint, 'anonymous visitor sees only ready public entries');
select is((select count(*) from public.travel_journal_media), 1::bigint, 'anonymous visitor sees only media attached to ready public entries');
select is((select count(*) from public.travel_page_documents), 1::bigint, 'anonymous visitor reads the published page document');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
update public.travel_journeys set visibility = 'private', published_at = null;

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.travel_journeys), 0::bigint, 'unpublished journey disappears immediately');
select is((select count(*) from public.travel_journal_entries), 0::bigint, 'unpublished entries disappear immediately');
select is((select count(*) from public.travel_journal_media), 0::bigint, 'unpublished media disappears immediately');

reset role;
select * from finish();
rollback;
