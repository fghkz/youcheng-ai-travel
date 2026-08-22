create table public.scenic_image_cache (
  provider text not null,
  external_spot_id text not null,
  match_version text not null default 'amap-poi-v3',
  spot_name text not null,
  destination text not null,
  images jsonb not null default '[]'::jsonb,
  matched_poi_id text,
  matched_poi_name text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, external_spot_id, match_version),
  constraint scenic_image_cache_images_array check (jsonb_typeof(images) = 'array'),
  constraint scenic_image_cache_image_limit check (jsonb_array_length(images) <= 3)
);

create index scenic_image_cache_expires_at_idx on public.scenic_image_cache (expires_at);

alter table public.scenic_image_cache enable row level security;

revoke all on table public.scenic_image_cache from anon, authenticated;
grant select, insert, update, delete on table public.scenic_image_cache to service_role;


