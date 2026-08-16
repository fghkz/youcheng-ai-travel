begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_schema('private', 'private schema exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'trips', 'trips table exists');
select has_table('public', 'trip_spots', 'trip_spots table exists');
select has_table('public', 'itinerary_versions', 'itinerary_versions table exists');
select has_table('public', 'favorite_spots', 'favorite_spots table exists');
select has_table('private', 'generation_runs', 'generation_runs table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.trips'::regclass),
  'trips has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.trip_spots'::regclass),
  'trip_spots has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.itinerary_versions'::regclass),
  'itinerary_versions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.favorite_spots'::regclass),
  'favorite_spots has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.generation_runs'::regclass),
  'generation_runs has RLS enabled'
);

select has_index(
  'public',
  'trips',
  'trips_user_updated_idx',
  'trip list cursor index exists'
);
select has_index(
  'public',
  'itinerary_versions',
  'itinerary_versions_one_current_idx',
  'one-current-version index exists'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'schema-user-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'schema-user-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select is(
  (select count(*) from public.profiles where id in (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid
  )),
  2::bigint,
  'auth user trigger creates profiles'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    insert into public.trips (
      user_id,
      title,
      destination,
      hotel,
      start_from_hotel,
      start_date,
      end_date,
      daily_start_time,
      daily_end_time,
      transport_preference,
      pace
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '杭州三日游',
      '杭州',
      '西湖边酒店',
      true,
      '2026-10-02',
      '2026-10-04',
      '09:00',
      '18:00',
      'either',
      'comfortable'
    )
  $$,
  'owner can create a valid trip'
);

select throws_ok(
  $$
    insert into public.trips (
      user_id, title, destination, hotel, start_from_hotel,
      start_date, end_date, daily_start_time, daily_end_time,
      transport_preference
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '无酒店行程', '杭州', '', true,
      '2026-10-02', '2026-10-04', '09:00', '18:00', 'transit'
    )
  $$,
  '23514',
  null,
  'hotel is required when starting from hotel'
);

select throws_ok(
  $$
    insert into public.trips (
      user_id, title, destination, start_date, end_date,
      daily_start_time, daily_end_time, transport_preference
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '超长行程', '杭州', '2026-10-02', '2026-10-20',
      '09:00', '18:00', 'transit'
    )
  $$,
  '23514',
  null,
  'trip duration cannot exceed fifteen days'
);

select lives_ok(
  $$
    insert into public.trip_spots (
      trip_id, user_id, provider, external_spot_id, spot_name,
      longitude, latitude, selected_order, spot_snapshot
    )
    select
      id,
      user_id,
      'aliyun-scenic-api',
      'west-lake',
      '杭州西湖',
      120.148,
      30.243,
      1,
      '{"name":"杭州西湖","images":[]}'::jsonb
    from public.trips
    where title = '杭州三日游'
  $$,
  'owner can add a valid scenic spot snapshot'
);

select throws_ok(
  $$
    insert into public.trip_spots (
      trip_id, user_id, provider, external_spot_id, spot_name,
      longitude, latitude, selected_order, spot_snapshot
    )
    select
      id,
      user_id,
      'aliyun-scenic-api',
      'invalid-ninth',
      '第九个景点',
      120.1,
      30.2,
      9,
      '{}'::jsonb
    from public.trips
    where title = '杭州三日游'
  $$,
  '23514',
  null,
  'selected order limits a trip to eight spots'
);

select throws_ok(
  $$
    insert into public.trip_spots (
      trip_id, user_id, provider, external_spot_id, spot_name,
      longitude, latitude, selected_order, spot_snapshot
    )
    select
      id,
      user_id,
      'aliyun-scenic-api',
      'west-lake',
      '杭州西湖',
      120.148,
      30.243,
      2,
      '{}'::jsonb
    from public.trips
    where title = '杭州三日游'
  $$,
  '23505',
  null,
  'the same provider spot cannot be added twice'
);

select lives_ok(
  $$
    insert into public.favorite_spots (
      user_id, provider, external_spot_id, spot_name, spot_snapshot
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'aliyun-scenic-api',
      'west-lake',
      '杭州西湖',
      '{"name":"杭州西湖"}'::jsonb
    )
  $$,
  'owner can save a favorite independent of the trip'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.trips),
  0::bigint,
  'another user cannot see the trip'
);

select throws_ok(
  $$
    insert into public.trips (
      user_id, title, destination, start_date, end_date,
      daily_start_time, daily_end_time, transport_preference
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '伪造行程', '杭州', '2026-10-02', '2026-10-03',
      '09:00', '18:00', 'transit'
    )
  $$,
  '42501',
  null,
  'RLS rejects a forged owner id'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    select public.create_itinerary_version(
      (select id from public.trips where title = '杭州三日游'),
      '{"pace":"comfortable"}'::jsonb,
      '{"days":[]}'::jsonb,
      '{"routes":"live"}'::jsonb,
      'deepseek',
      'deepseek-chat'
    )
  $$,
  'owner can create the first itinerary version'
);

select lives_ok(
  $$
    select public.create_itinerary_version(
      (select id from public.trips where title = '杭州三日游'),
      '{"pace":"compact"}'::jsonb,
      '{"days":[{"date":"2026-10-02"}]}'::jsonb,
      '{}'::jsonb,
      'deepseek',
      'deepseek-chat'
    )
  $$,
  'owner can create a replacement itinerary version'
);

select is(
  (select count(*) from public.itinerary_versions),
  2::bigint,
  'regeneration keeps historical versions'
);

select is(
  (select count(*) from public.itinerary_versions where is_current),
  1::bigint,
  'a trip has exactly one current itinerary version'
);

select lives_ok(
  $$delete from public.trips where title = '杭州三日游'$$,
  'owner can delete a trip'
);

select is(
  (select count(*) from public.trip_spots),
  0::bigint,
  'deleting a trip cascades selected spots'
);

select is(
  (select count(*) from public.itinerary_versions),
  0::bigint,
  'deleting a trip cascades itinerary versions'
);

select is(
  (select count(*) from public.favorite_spots),
  1::bigint,
  'deleting a trip preserves favorites'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'private.generation_runs', 'select'),
  'authenticated users cannot select generation telemetry'
);

delete from auth.users
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  0::bigint,
  'deleting an auth user cascades the profile'
);

select is(
  (select count(*) from public.favorite_spots where user_id = '10000000-0000-0000-0000-000000000001'),
  0::bigint,
  'deleting an auth user cascades favorites'
);

select * from finish();
rollback;
