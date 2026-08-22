import "server-only";

import { cache } from "react";
import { pageDocumentSchema } from "@/lib/journey-types";
import { createClient } from "@/lib/supabase/server";

export interface JourneyBundle {
  journey: {
    id: string; owner_id: string; source_trip_id: number; title: string; summary: string;
    companion_label: string; closing_message: string; status: string; visibility: string;
    theme_key: string; slug: string; cover_media_id: string | null; planned_start_date: string; planned_end_date: string;
    published_at: string | null; revision: number; updated_at: string;
  };
  stops: Array<Record<string, unknown> & { id: string; place_name: string; day_number: number; sort_order: number; planned_date: string }>;
  entries: Array<Record<string, unknown> & { id: string; stop_id: string | null; body: unknown; status: string }>;
  media: Array<Record<string, unknown> & { id: string; storage_path: string; signedUrl?: string }>;
  document: ReturnType<typeof pageDocumentSchema.parse>;
  documentRevision: number;
}

async function loadBundle(column: "id" | "slug", value: string): Promise<JourneyBundle | null> {
  const supabase = await createClient();
  const { data: journey, error } = await supabase.from("travel_journeys")
    .select("id,owner_id,source_trip_id,title,summary,companion_label,closing_message,status,visibility,theme_key,slug,cover_media_id,planned_start_date,planned_end_date,published_at,revision,updated_at")
    .eq(column, value).maybeSingle();
  if (error || !journey) return null;

  const [stopsResult, entriesResult, mediaResult, documentResult] = await Promise.all([
    supabase.from("travel_journey_stops").select("*").eq("journey_id", journey.id).order("sort_order"),
    supabase.from("travel_journal_entries").select("*").eq("journey_id", journey.id).order("happened_at"),
    supabase.from("travel_journal_media").select("*").eq("journey_id", journey.id).order("sort_order"),
    supabase.from("travel_page_documents").select("content,revision").eq("journey_id", journey.id).maybeSingle(),
  ]);
  const parsed = pageDocumentSchema.safeParse(documentResult.data?.content);
  if (!parsed.success) return null;
  const media = (mediaResult.data ?? []) as JourneyBundle["media"];
  if (media.length) {
    const { data: signed } = await supabase.storage.from("travel-journal-media")
      .createSignedUrls(media.map((item) => item.storage_path), 3600);
    const urls = new Map((signed ?? []).filter((item) => item.path && item.signedUrl).map((item) => [item.path!, item.signedUrl!] as const));
    for (const item of media) item.signedUrl = urls.get(item.storage_path);
  }
  return {
    journey,
    stops: (stopsResult.data ?? []) as JourneyBundle["stops"],
    entries: (entriesResult.data ?? []) as JourneyBundle["entries"],
    media,
    document: parsed.data,
    documentRevision: documentResult.data?.revision ?? 1,
  };
}

export const getJourneyBundleById = cache((id: string) => loadBundle("id", id));
export const getPublishedJourneyBySlug = cache(async (slug: string) => {
  const bundle = await loadBundle("slug", slug);
  return bundle?.journey.visibility === "public" && bundle.journey.published_at ? bundle : null;
});
