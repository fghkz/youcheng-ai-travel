begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'scenic_image_cache', 'scenic image cache table exists');
select has_pk('public', 'scenic_image_cache', 'scenic image cache has a primary key');
select has_index('public', 'scenic_image_cache', 'scenic_image_cache_expires_at_idx', 'cache expiry index exists');
select ok((select relrowsecurity from pg_class where oid = 'public.scenic_image_cache'::regclass), 'cache has RLS');

set local role anon;
select throws_ok($$select * from public.scenic_image_cache$$, 'anonymous visitors cannot read the internal cache');
reset role;

set local role authenticated;
select throws_ok($$select * from public.scenic_image_cache$$, 'authenticated users cannot read the internal cache');
reset role;

set local role service_role;
select lives_ok(
  $$insert into public.scenic_image_cache (provider, external_spot_id, spot_name, destination, images, expires_at)
    values ('aliyun-scenic-api', 'aliyun-west-lake', '杭州西湖', '杭州', '["https://img.example/west-lake.webp"]', now() + interval '14 days')$$,
  'service role can populate the cache'
);
select throws_ok(
  $$insert into public.scenic_image_cache (provider, external_spot_id, spot_name, destination, images, expires_at)
    values ('aliyun-scenic-api', 'too-many', '测试景点', '杭州', '["https://img.example/1.webp","https://img.example/2.webp","https://img.example/3.webp","https://img.example/4.webp"]', now() + interval '14 days')$$,
  'cache rejects more than three images'
);

reset role;
select * from finish();
rollback;