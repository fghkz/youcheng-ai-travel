-- AI travel journal 2.0. Existing trips remain plans; journeys are immutable snapshots.
alter table public.trips
  add column final_content jsonb,
  add column final_route jsonb,
  add column finalized_at timestamptz,
  add column version integer not null default 1;
alter table public.trips
  drop constraint trips_status_check,
  add constraint trips_status_check check (status in ('draft', 'active', 'finalized', 'archived')),
  add constraint trips_final_content_object_check check (final_content is null or jsonb_typeof(final_content) = 'object'),
  add constraint trips_final_route_object_check check (final_route is null or jsonb_typeof(final_route) = 'object'),
  add constraint trips_version_positive_check check (version > 0);

create table public.travel_journeys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_trip_id bigint not null references public.trips (id) on delete restrict,
  source_plan_version integer not null,
  plan_snapshot jsonb not null,
  title text not null,
  summary text not null default '',
  companion_label text not null default '',
  closing_message text not null default '',
  status text not null default 'in_progress',
  visibility text not null default 'private',
  theme_key text not null default 'cute',
  slug text not null unique,
  cover_media_id uuid,
  planned_start_date date not null,
  planned_end_date date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  published_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_journeys_title_length_check check (char_length(btrim(title)) between 1 and 100),
  constraint travel_journeys_summary_length_check check (char_length(summary) <= 1000),
  constraint travel_journeys_companion_length_check check (char_length(companion_label) <= 80),
  constraint travel_journeys_closing_length_check check (char_length(closing_message) <= 1000),
  constraint travel_journeys_status_check check (status in ('planned', 'in_progress', 'completed')),
  constraint travel_journeys_visibility_check check (visibility in ('private', 'public')),
  constraint travel_journeys_theme_check check (theme_key in ('cute', 'nostalgic', 'joyful', 'elegant')),
  constraint travel_journeys_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 8 and 96),
  constraint travel_journeys_snapshot_check check (jsonb_typeof(plan_snapshot) = 'object'),
  constraint travel_journeys_date_range_check check (planned_end_date >= planned_start_date),
  constraint travel_journeys_publication_check check ((visibility = 'private' and published_at is null) or (visibility = 'public' and published_at is not null)),
  constraint travel_journeys_completion_check check ((status <> 'completed' and completed_at is null) or (status = 'completed' and completed_at is not null)),
  constraint travel_journeys_revision_positive_check check (revision > 0),
  constraint travel_journeys_source_version_positive_check check (source_plan_version > 0)
);

create table public.travel_journey_stops (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.travel_journeys (id) on delete cascade,
  source_item_key text,
  day_number smallint not null,
  sort_order smallint not null,
  planned_date date not null,
  planned_time time without time zone,
  actual_arrived_at timestamptz,
  place_name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  planned_content jsonb not null default '{}'::jsonb,
  is_extra_stop boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_journey_stops_day_positive_check check (day_number > 0),
  constraint travel_journey_stops_sort_positive_check check (sort_order > 0),
  constraint travel_journey_stops_place_length_check check (char_length(btrim(place_name)) between 1 and 120),
  constraint travel_journey_stops_address_length_check check (address is null or char_length(address) <= 240),
  constraint travel_journey_stops_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint travel_journey_stops_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint travel_journey_stops_content_check check (jsonb_typeof(planned_content) = 'object'),
  constraint travel_journey_stops_journey_sort_key unique (journey_id, sort_order),
  constraint travel_journey_stops_id_journey_key unique (id, journey_id)
);

create table public.travel_journal_entries (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.travel_journeys (id) on delete cascade,
  stop_id uuid,
  author_id uuid not null references auth.users (id) on delete cascade,
  title text,
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  mood_key text,
  mood_text text,
  message text,
  happened_at timestamptz not null default now(),
  sort_order integer not null default 1,
  status text not null default 'draft',
  is_public boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_journal_entries_title_length_check check (title is null or char_length(title) <= 100),
  constraint travel_journal_entries_body_check check (jsonb_typeof(body) = 'object'),
  constraint travel_journal_entries_mood_check check (mood_key is null or mood_key in ('excited', 'happy', 'peaceful', 'tired', 'surprised', 'moved')),
  constraint travel_journal_entries_mood_text_check check (mood_text is null or char_length(mood_text) <= 160),
  constraint travel_journal_entries_message_check check (message is null or char_length(message) <= 500),
  constraint travel_journal_entries_sort_check check (sort_order > 0),
  constraint travel_journal_entries_status_check check (status in ('draft', 'ready')),
  constraint travel_journal_entries_revision_check check (revision > 0),
  constraint travel_journal_entries_id_journey_key unique (id, journey_id),
  constraint travel_journal_entries_stop_journey_fkey foreign key (stop_id, journey_id) references public.travel_journey_stops (id, journey_id) on delete set null (stop_id)
);

create table public.travel_journal_media (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.travel_journeys (id) on delete cascade,
  entry_id uuid,
  stop_id uuid,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  width integer,
  height integer,
  size_bytes bigint not null,
  caption text,
  alt_text text,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  constraint travel_journal_media_id_journey_key unique (id, journey_id),
  constraint travel_journal_media_path_check check (char_length(btrim(storage_path)) > 0),
  constraint travel_journal_media_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint travel_journal_media_dimensions_check check ((width is null and height is null) or (width > 0 and height > 0)),
  constraint travel_journal_media_size_check check (size_bytes between 1 and 10485760),
  constraint travel_journal_media_caption_check check (caption is null or char_length(caption) <= 300),
  constraint travel_journal_media_alt_check check (alt_text is null or char_length(alt_text) <= 200),
  constraint travel_journal_media_sort_check check (sort_order between 1 and 9),
  constraint travel_journal_media_entry_journey_fkey foreign key (entry_id, journey_id) references public.travel_journal_entries (id, journey_id) on delete cascade,
  constraint travel_journal_media_stop_journey_fkey foreign key (stop_id, journey_id) references public.travel_journey_stops (id, journey_id) on delete set null (stop_id)
);
alter table public.travel_journeys add constraint travel_journeys_cover_media_fkey foreign key (cover_media_id, id) references public.travel_journal_media (id, journey_id) on delete set null (cover_media_id);

create table public.travel_page_documents (
  journey_id uuid primary key references public.travel_journeys (id) on delete cascade,
  schema_version integer not null default 1,
  content jsonb not null,
  generation_prompt_version text,
  generated_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_page_documents_schema_check check (schema_version = 1),
  constraint travel_page_documents_content_check check (jsonb_typeof(content) = 'object'),
  constraint travel_page_documents_revision_check check (revision > 0)
);

create index travel_journeys_owner_updated_idx on public.travel_journeys (owner_id, updated_at desc, id);
create index travel_journeys_source_trip_idx on public.travel_journeys (source_trip_id);
create index travel_journeys_cover_media_idx on public.travel_journeys (cover_media_id) where cover_media_id is not null;
create index travel_journeys_public_published_idx on public.travel_journeys (published_at desc, id) where visibility = 'public' and published_at is not null;
create unique index travel_journeys_one_active_plan_idx on public.travel_journeys (owner_id, source_trip_id) where status in ('planned', 'in_progress');
create index travel_journey_stops_journey_day_idx on public.travel_journey_stops (journey_id, day_number, sort_order);
create index travel_journal_entries_journey_time_idx on public.travel_journal_entries (journey_id, happened_at desc, id);
create index travel_journal_entries_stop_idx on public.travel_journal_entries (stop_id) where stop_id is not null;
create index travel_journal_entries_author_idx on public.travel_journal_entries (author_id);
create index travel_journal_media_journey_entry_idx on public.travel_journal_media (journey_id, entry_id, sort_order);
create index travel_journal_media_entry_idx on public.travel_journal_media (entry_id) where entry_id is not null;
create index travel_journal_media_stop_idx on public.travel_journal_media (stop_id) where stop_id is not null;
create index travel_journal_media_owner_idx on public.travel_journal_media (owner_id);

create trigger travel_journeys_set_updated_at before update on public.travel_journeys for each row execute function private.set_updated_at();
create trigger travel_journey_stops_set_updated_at before update on public.travel_journey_stops for each row execute function private.set_updated_at();
create trigger travel_journal_entries_set_updated_at before update on public.travel_journal_entries for each row execute function private.set_updated_at();
create trigger travel_page_documents_set_updated_at before update on public.travel_page_documents for each row execute function private.set_updated_at();

alter table public.travel_journeys enable row level security;
alter table public.travel_journey_stops enable row level security;
alter table public.travel_journal_entries enable row level security;
alter table public.travel_journal_media enable row level security;
alter table public.travel_page_documents enable row level security;

create policy travel_journeys_select_owner on public.travel_journeys for select to authenticated using ((select auth.uid()) = owner_id);
create policy travel_journeys_select_public on public.travel_journeys for select to anon, authenticated using (visibility = 'public' and published_at is not null);
create policy travel_journeys_insert_owner on public.travel_journeys for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy travel_journeys_update_owner on public.travel_journeys for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy travel_journeys_delete_owner on public.travel_journeys for delete to authenticated using ((select auth.uid()) = owner_id);

create policy travel_journey_stops_select_owner on public.travel_journey_stops for select to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_journey_stops_select_public on public.travel_journey_stops for select to anon, authenticated using (is_public and exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.visibility = 'public' and j.published_at is not null
));
create policy travel_journey_stops_insert_owner on public.travel_journey_stops for insert to authenticated with check (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_journey_stops_update_owner on public.travel_journey_stops for update to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_journey_stops_delete_owner on public.travel_journey_stops for delete to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));

create policy travel_journal_entries_select_owner on public.travel_journal_entries for select to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_journal_entries_select_public on public.travel_journal_entries for select to anon, authenticated using (status = 'ready' and is_public and exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.visibility = 'public' and j.published_at is not null
));
create policy travel_journal_entries_insert_owner on public.travel_journal_entries for insert to authenticated with check (
  author_id = (select auth.uid()) and exists (select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid()))
);
create policy travel_journal_entries_update_owner on public.travel_journal_entries for update to authenticated using (
  author_id = (select auth.uid()) and exists (select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid()))
) with check (
  author_id = (select auth.uid()) and exists (select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid()))
);
create policy travel_journal_entries_delete_owner on public.travel_journal_entries for delete to authenticated using (
  author_id = (select auth.uid()) and exists (select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid()))
);

create policy travel_journal_media_select_owner on public.travel_journal_media for select to authenticated using (owner_id = (select auth.uid()));
create policy travel_journal_media_select_public on public.travel_journal_media for select to anon, authenticated using (exists (
  select 1 from public.travel_journeys j
  where j.id = journey_id and j.visibility = 'public' and j.published_at is not null
    and (
      j.cover_media_id = travel_journal_media.id
      or (entry_id is not null and exists (
        select 1 from public.travel_journal_entries e where e.id = entry_id and e.journey_id = travel_journal_media.journey_id and e.status = 'ready' and e.is_public
      ))
      or (entry_id is null and stop_id is not null and exists (
        select 1 from public.travel_journey_stops s where s.id = stop_id and s.journey_id = travel_journal_media.journey_id and s.is_public
      ))
    )
));
create policy travel_journal_media_insert_owner on public.travel_journal_media for insert to authenticated with check (
  owner_id = (select auth.uid()) and exists (select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid()))
);
create policy travel_journal_media_update_owner on public.travel_journal_media for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_journal_media_delete_owner on public.travel_journal_media for delete to authenticated using (owner_id = (select auth.uid()));

create policy travel_page_documents_select_owner on public.travel_page_documents for select to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_page_documents_select_public on public.travel_page_documents for select to anon, authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.visibility = 'public' and j.published_at is not null
));
create policy travel_page_documents_insert_owner on public.travel_page_documents for insert to authenticated with check (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_page_documents_update_owner on public.travel_page_documents for update to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));
create policy travel_page_documents_delete_owner on public.travel_page_documents for delete to authenticated using (exists (
  select 1 from public.travel_journeys j where j.id = journey_id and j.owner_id = (select auth.uid())
));

revoke all on table public.travel_journeys, public.travel_journey_stops, public.travel_journal_entries, public.travel_journal_media, public.travel_page_documents from public, anon, authenticated;
grant select on table public.travel_journeys, public.travel_journey_stops, public.travel_journal_entries, public.travel_journal_media, public.travel_page_documents to anon;
grant select, insert, update, delete on table public.travel_journeys, public.travel_journey_stops, public.travel_journal_entries, public.travel_journal_media, public.travel_page_documents to authenticated, service_role;

-- Transactional and idempotent Journey creation. SECURITY INVOKER preserves RLS.
create function public.start_travel_journey(p_source_trip_id bigint, p_slug text, p_theme_key text default 'cute')
returns public.travel_journeys
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip public.trips;
  v_itinerary jsonb;
  v_plan_content jsonb;
  v_spots jsonb;
  v_existing public.travel_journeys;
  v_journey public.travel_journeys;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_existing from public.travel_journeys
    where owner_id = v_user_id and source_trip_id = p_source_trip_id and status in ('planned', 'in_progress') limit 1;
  if found then return v_existing; end if;

  select * into v_trip from public.trips where id = p_source_trip_id and user_id = v_user_id for update;
  if not found then raise exception using errcode = '42501', message = 'Trip not found or not owned by the current user'; end if;
  select itinerary_result into v_itinerary from public.itinerary_versions
    where trip_id = p_source_trip_id and user_id = v_user_id and is_current;
  if v_itinerary is null then raise exception using errcode = '22023', message = 'The trip has no current itinerary'; end if;
  if v_trip.finalized_at is null or v_trip.final_content is null then
    raise exception using errcode = '22023', message = 'Finalize the trip before starting a journey';
  end if;
  v_plan_content := v_trip.final_content;
  select coalesce(jsonb_agg(jsonb_build_object('externalSpotId', external_spot_id, 'selectedOrder', selected_order, 'snapshot', spot_snapshot) order by selected_order), '[]'::jsonb)
    into v_spots from public.trip_spots where trip_id = p_source_trip_id and user_id = v_user_id;

  insert into public.travel_journeys (
    owner_id, source_trip_id, source_plan_version, plan_snapshot, title, status,
    visibility, theme_key, slug, planned_start_date, planned_end_date, started_at
  ) values (
    v_user_id, v_trip.id, v_trip.version,
    jsonb_build_object('trip', to_jsonb(v_trip), 'itinerary', coalesce(v_trip.final_content, v_itinerary), 'route', coalesce(v_trip.final_route, v_itinerary), 'spots', v_spots),
    v_trip.title, 'in_progress', 'private', p_theme_key, p_slug,
    v_trip.start_date, v_trip.end_date, now()
  ) returning * into v_journey;

  with flattened as (
    select day.ordinality::smallint as day_number, day.value ->> 'date' as planned_date,
      item.value as item, spot.spot_name, spot.longitude, spot.latitude, spot.spot_snapshot,
      row_number() over (order by day.ordinality, item.ordinality)::smallint as global_order
    from jsonb_array_elements(v_plan_content -> 'days') with ordinality as day(value, ordinality)
    cross join lateral jsonb_array_elements(day.value -> 'items') with ordinality as item(value, ordinality)
    left join public.trip_spots spot on spot.trip_id = p_source_trip_id and spot.user_id = v_user_id and spot.external_spot_id = item.value ->> 'spotId'
    where coalesce((item.value ->> 'selected')::boolean, true)
  )
  insert into public.travel_journey_stops (
    journey_id, source_item_key, day_number, sort_order, planned_date, planned_time,
    place_name, address, latitude, longitude, planned_content
  )
  select v_journey.id, item ->> 'spotId', day_number, global_order, planned_date::date,
    nullif(item ->> 'arrivalTime', '')::time, coalesce(spot_name, item ->> 'spotId'),
    nullif(spot_snapshot ->> 'address', ''), latitude, longitude,
    jsonb_build_object('itineraryItem', item, 'spot', coalesce(spot_snapshot, '{}'::jsonb))
  from flattened;

  insert into public.travel_page_documents (journey_id, content)
  values (v_journey.id, jsonb_build_object(
    'version', 1,
    'hero', jsonb_build_object('title', v_trip.title, 'subtitle', v_trip.destination, 'companionLabel', ''),
    'intro', jsonb_build_object('text', '一段正在发生的旅程。'),
    'blocks', '[]'::jsonb,
    'closing', jsonb_build_object('text', ''),
    'visibility', jsonb_build_object('showDates', true, 'showCompanions', true)
  ));
  return v_journey;
exception when unique_violation then
  select * into v_existing from public.travel_journeys
    where owner_id = v_user_id and source_trip_id = p_source_trip_id and status in ('planned', 'in_progress') limit 1;
  if found then return v_existing; end if;
  raise;
end;
$$;
revoke all on function public.start_travel_journey(bigint, text, text) from public, anon;
grant execute on function public.start_travel_journey(bigint, text, text) to authenticated, service_role;

alter table private.generation_runs drop constraint generation_runs_operation_check,
  add constraint generation_runs_operation_check check (operation in ('spot_summary', 'itinerary_generation', 'plan_finalization', 'journal_page_generation'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('travel-journal-media', 'travel-journal-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy travel_journal_storage_insert_owner on storage.objects for insert to authenticated with check (
  bucket_id = 'travel-journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.travel_journeys j where j.id::text = (storage.foldername(name))[2] and j.owner_id = (select auth.uid()))
);
create policy travel_journal_storage_select_owner on storage.objects for select to authenticated using (
  bucket_id = 'travel-journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy travel_journal_storage_select_public on storage.objects for select to anon, authenticated using (
  bucket_id = 'travel-journal-media' and exists (
    select 1
    from public.travel_journal_media m
    join public.travel_journeys j on j.id = m.journey_id
    where m.storage_path = name and j.id::text = (storage.foldername(name))[2]
      and j.visibility = 'public' and j.published_at is not null
      and (
        j.cover_media_id = m.id
        or (m.entry_id is not null and exists (
          select 1 from public.travel_journal_entries e where e.id = m.entry_id and e.journey_id = m.journey_id and e.status = 'ready' and e.is_public
        ))
        or (m.entry_id is null and m.stop_id is not null and exists (
          select 1 from public.travel_journey_stops s where s.id = m.stop_id and s.journey_id = m.journey_id and s.is_public
        ))
      )
  )
);
create policy travel_journal_storage_delete_owner on storage.objects for delete to authenticated using (
  bucket_id = 'travel-journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);
