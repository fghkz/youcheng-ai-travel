create index trip_spots_trip_owner_idx
  on public.trip_spots (trip_id, user_id);

create index itinerary_versions_trip_owner_idx
  on public.itinerary_versions (trip_id, user_id);
