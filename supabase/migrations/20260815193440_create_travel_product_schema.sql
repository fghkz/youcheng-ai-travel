create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  locale text not null default 'zh-CN',
  timezone text not null default 'Asia/Shanghai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length_check check (
    display_name is null
    or char_length(btrim(display_name)) between 1 and 40
  ),
  constraint profiles_locale_not_blank_check check (char_length(btrim(locale)) > 0),
  constraint profiles_timezone_not_blank_check check (char_length(btrim(timezone)) > 0)
);

create table public.trips (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  destination text not null,
  hotel text not null default '',
  start_from_hotel boolean not null default false,
  start_date date not null,
  end_date date not null,
  daily_start_time time without time zone not null,
  daily_end_time time without time zone not null,
  transport_preference text not null,
  pace text not null default 'comfortable',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_id_user_id_key unique (id, user_id),
  constraint trips_title_length_check check (char_length(btrim(title)) between 1 and 80),
  constraint trips_destination_length_check check (char_length(btrim(destination)) between 1 and 40),
  constraint trips_hotel_length_check check (char_length(hotel) <= 100),
  constraint trips_hotel_origin_check check (not start_from_hotel or char_length(btrim(hotel)) > 0),
  constraint trips_date_range_check check (
    end_date >= start_date
    and end_date <= start_date + 14
  ),
  constraint trips_daily_time_check check (daily_end_time > daily_start_time),
  constraint trips_transport_preference_check check (
    transport_preference in ('transit', 'driving', 'either')
  ),
  constraint trips_pace_check check (pace in ('leisurely', 'comfortable', 'compact')),
  constraint trips_status_check check (status in ('draft', 'active', 'archived'))
);

create table public.trip_spots (
  id bigint generated always as identity primary key,
  trip_id bigint not null,
  user_id uuid not null,
  provider text not null,
  external_spot_id text not null,
  spot_name text not null,
  longitude double precision not null,
  latitude double precision not null,
  selected_order smallint not null,
  spot_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_spots_trip_owner_fkey
    foreign key (trip_id, user_id)
    references public.trips (id, user_id)
    on delete cascade,
  constraint trip_spots_provider_not_blank_check check (char_length(btrim(provider)) > 0),
  constraint trip_spots_external_id_not_blank_check check (char_length(btrim(external_spot_id)) > 0),
  constraint trip_spots_name_length_check check (char_length(btrim(spot_name)) between 1 and 100),
  constraint trip_spots_longitude_check check (longitude between -180 and 180),
  constraint trip_spots_latitude_check check (latitude between -90 and 90),
  constraint trip_spots_selected_order_check check (selected_order between 1 and 8),
  constraint trip_spots_snapshot_object_check check (jsonb_typeof(spot_snapshot) = 'object'),
  constraint trip_spots_trip_provider_external_key unique (trip_id, provider, external_spot_id),
  constraint trip_spots_trip_selected_order_key unique (trip_id, selected_order)
);

create table public.itinerary_versions (
  id bigint generated always as identity primary key,
  trip_id bigint not null,
  user_id uuid not null,
  version_no integer not null,
  is_current boolean not null default true,
  preferences_snapshot jsonb not null,
  itinerary_result jsonb not null,
  source_meta jsonb not null default '{}'::jsonb,
  model_provider text not null,
  model_name text not null,
  created_at timestamptz not null default now(),
  constraint itinerary_versions_trip_owner_fkey
    foreign key (trip_id, user_id)
    references public.trips (id, user_id)
    on delete cascade,
  constraint itinerary_versions_version_positive_check check (version_no > 0),
  constraint itinerary_versions_preferences_object_check check (jsonb_typeof(preferences_snapshot) = 'object'),
  constraint itinerary_versions_result_object_check check (jsonb_typeof(itinerary_result) = 'object'),
  constraint itinerary_versions_source_meta_object_check check (jsonb_typeof(source_meta) = 'object'),
  constraint itinerary_versions_model_provider_not_blank_check check (char_length(btrim(model_provider)) > 0),
  constraint itinerary_versions_model_name_not_blank_check check (char_length(btrim(model_name)) > 0),
  constraint itinerary_versions_trip_version_key unique (trip_id, version_no)
);

create table public.favorite_spots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  external_spot_id text not null,
  spot_name text not null,
  spot_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorite_spots_provider_not_blank_check check (char_length(btrim(provider)) > 0),
  constraint favorite_spots_external_id_not_blank_check check (char_length(btrim(external_spot_id)) > 0),
  constraint favorite_spots_name_length_check check (char_length(btrim(spot_name)) between 1 and 100),
  constraint favorite_spots_snapshot_object_check check (jsonb_typeof(spot_snapshot) = 'object'),
  constraint favorite_spots_user_provider_external_key unique (user_id, provider, external_spot_id)
);

create table private.generation_runs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  trip_id bigint references public.trips (id) on delete set null,
  operation text not null,
  provider text not null,
  model_name text not null,
  status text not null,
  latency_ms integer,
  input_tokens bigint,
  output_tokens bigint,
  error_code text,
  created_at timestamptz not null default now(),
  constraint generation_runs_operation_check check (
    operation in ('spot_summary', 'itinerary_generation')
  ),
  constraint generation_runs_provider_not_blank_check check (char_length(btrim(provider)) > 0),
  constraint generation_runs_model_name_not_blank_check check (char_length(btrim(model_name)) > 0),
  constraint generation_runs_status_check check (
    status in ('started', 'succeeded', 'failed', 'fallback')
  ),
  constraint generation_runs_latency_nonnegative_check check (latency_ms is null or latency_ms >= 0),
  constraint generation_runs_input_tokens_nonnegative_check check (input_tokens is null or input_tokens >= 0),
  constraint generation_runs_output_tokens_nonnegative_check check (output_tokens is null or output_tokens >= 0)
);

comment on table public.profiles is 'Product profile linked one-to-one with auth.users.';
comment on table public.trips is 'User-owned travel projects and planning preferences.';
comment on table public.trip_spots is 'Selected scenic spots with immutable provider snapshots.';
comment on table public.itinerary_versions is 'Versioned, validated AI itinerary results.';
comment on table public.favorite_spots is 'User-owned scenic spot favorites.';
comment on table private.generation_runs is 'Server-only AI operation telemetry without raw prompts or responses.';
comment on column public.trip_spots.spot_snapshot is 'Validated ScenicSpot JSON snapshot captured when the trip is saved.';
comment on column public.itinerary_versions.preferences_snapshot is 'Validated TripPreferences JSON used for this generation.';
comment on column public.itinerary_versions.itinerary_result is 'Validated ItineraryResult JSON returned by the planner.';

create index trips_user_updated_idx
  on public.trips (user_id, updated_at desc, id desc);

create index trip_spots_user_id_idx
  on public.trip_spots (user_id);

create index itinerary_versions_user_created_idx
  on public.itinerary_versions (user_id, created_at desc);

create unique index itinerary_versions_one_current_idx
  on public.itinerary_versions (trip_id)
  where is_current;

create index favorite_spots_user_created_idx
  on public.favorite_spots (user_id, created_at desc, id desc);

create index generation_runs_created_idx
  on private.generation_runs (created_at desc);

create index generation_runs_user_created_idx
  on private.generation_runs (user_id, created_at desc);

create index generation_runs_trip_id_idx
  on private.generation_runs (trip_id);

create index generation_runs_status_created_idx
  on private.generation_runs (status, created_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger trips_set_updated_at
before update on public.trips
for each row execute function private.set_updated_at();

create trigger trip_spots_set_updated_at
before update on public.trip_spots
for each row execute function private.set_updated_at();

create trigger favorite_spots_set_updated_at
before update on public.favorite_spots
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_spots enable row level security;
alter table public.itinerary_versions enable row level security;
alter table public.favorite_spots enable row level security;
alter table private.generation_runs enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy trips_select_own
on public.trips for select
to authenticated
using ((select auth.uid()) = user_id);

create policy trips_insert_own
on public.trips for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy trips_update_own
on public.trips for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy trips_delete_own
on public.trips for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy trip_spots_select_own
on public.trip_spots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy trip_spots_insert_own
on public.trip_spots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy trip_spots_update_own
on public.trip_spots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy trip_spots_delete_own
on public.trip_spots for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy itinerary_versions_select_own
on public.itinerary_versions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy itinerary_versions_insert_own
on public.itinerary_versions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy itinerary_versions_update_own
on public.itinerary_versions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy itinerary_versions_delete_own
on public.itinerary_versions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy favorite_spots_select_own
on public.favorite_spots for select
to authenticated
using ((select auth.uid()) = user_id);

create policy favorite_spots_insert_own
on public.favorite_spots for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy favorite_spots_update_own
on public.favorite_spots for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy favorite_spots_delete_own
on public.favorite_spots for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.trips from public, anon, authenticated;
revoke all on table public.trip_spots from public, anon, authenticated;
revoke all on table public.itinerary_versions from public, anon, authenticated;
revoke all on table public.favorite_spots from public, anon, authenticated;
revoke all on table private.generation_runs from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.trips to authenticated;
grant select, insert, update, delete on table public.trip_spots to authenticated;
grant select, insert, update, delete on table public.itinerary_versions to authenticated;
grant select, insert, update, delete on table public.favorite_spots to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.trips to service_role;
grant select, insert, update, delete on table public.trip_spots to service_role;
grant select, insert, update, delete on table public.itinerary_versions to service_role;
grant select, insert, update, delete on table public.favorite_spots to service_role;
grant select, insert, update, delete on table private.generation_runs to service_role;

grant usage, select on sequence public.trips_id_seq to authenticated, service_role;
grant usage, select on sequence public.trip_spots_id_seq to authenticated, service_role;
grant usage, select on sequence public.itinerary_versions_id_seq to authenticated, service_role;
grant usage, select on sequence public.favorite_spots_id_seq to authenticated, service_role;
grant usage, select on sequence private.generation_runs_id_seq to service_role;

create function public.create_itinerary_version(
  p_trip_id bigint,
  p_preferences_snapshot jsonb,
  p_itinerary_result jsonb,
  p_source_meta jsonb default '{}'::jsonb,
  p_model_provider text default 'deepseek',
  p_model_name text default 'deepseek-chat'
)
returns public.itinerary_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_version_no integer;
  v_result public.itinerary_versions;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_preferences_snapshot is null or jsonb_typeof(p_preferences_snapshot) <> 'object' then
    raise exception using errcode = '22023', message = 'preferences_snapshot must be a JSON object';
  end if;

  if p_itinerary_result is null or jsonb_typeof(p_itinerary_result) <> 'object' then
    raise exception using errcode = '22023', message = 'itinerary_result must be a JSON object';
  end if;

  if p_source_meta is null or jsonb_typeof(p_source_meta) <> 'object' then
    raise exception using errcode = '22023', message = 'source_meta must be a JSON object';
  end if;

  perform 1
  from public.trips
  where id = p_trip_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Trip not found or not owned by the current user';
  end if;

  select coalesce(max(version_no), 0) + 1
  into v_version_no
  from public.itinerary_versions
  where trip_id = p_trip_id and user_id = v_user_id;

  update public.itinerary_versions
  set is_current = false
  where trip_id = p_trip_id and user_id = v_user_id and is_current;

  insert into public.itinerary_versions (
    trip_id,
    user_id,
    version_no,
    is_current,
    preferences_snapshot,
    itinerary_result,
    source_meta,
    model_provider,
    model_name
  ) values (
    p_trip_id,
    v_user_id,
    v_version_no,
    true,
    p_preferences_snapshot,
    p_itinerary_result,
    p_source_meta,
    p_model_provider,
    p_model_name
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_itinerary_version(bigint, jsonb, jsonb, jsonb, text, text)
from public, anon;

grant execute on function public.create_itinerary_version(bigint, jsonb, jsonb, jsonb, text, text)
to authenticated, service_role;
