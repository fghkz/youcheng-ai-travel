import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, readJson, requireUser } from "@/lib/api";
import { generatePageRequestSchema } from "@/lib/journey-schemas";
import { pageDocumentSchema } from "@/lib/journey-types";
import { generateJournalPage } from "@/lib/services/journal";

export async function POST(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = generatePageRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_GENERATION", parsed.error.issues[0]?.message ?? "生成参数无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: journey } = await auth.supabase.from("travel_journeys").select("*")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!journey) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  const [trip, stops, entries, media, current] = await Promise.all([
    auth.supabase.from("trips").select("destination").eq("id", journey.source_trip_id).maybeSingle(),
    auth.supabase.from("travel_journey_stops").select("id,place_name,planned_date,day_number").eq("journey_id", journeyId).order("sort_order"),
    auth.supabase.from("travel_journal_entries").select("id,stop_id,title,mood_key,mood_text,message,body").eq("journey_id", journeyId).eq("status", "ready").order("happened_at"),
    auth.supabase.from("travel_journal_media").select("id,entry_id,stop_id,caption").eq("journey_id", journeyId).order("sort_order"),
    auth.supabase.from("travel_page_documents").select("content,revision").eq("journey_id", journeyId).maybeSingle(),
  ]);
  const currentParsed = pageDocumentSchema.safeParse(current.data?.content);
  try {
    const result = await generateJournalPage({
      title: journey.title, destination: trip.data?.destination ?? "", dates: `${journey.planned_start_date} 至 ${journey.planned_end_date}`,
      companionLabel: journey.companion_label, closingMessage: journey.closing_message,
      themeKey: journey.theme_key, tone: parsed.data.tone, stops: stops.data ?? [], entries: entries.data ?? [],
      media: media.data ?? [], current: currentParsed.success ? currentParsed.data : null, preserveLocked: parsed.data.preserveLocked,
    });
    const revision = Number(current.data?.revision ?? 1);
    const { data, error } = await auth.supabase.from("travel_page_documents").update({
      content: result.document, generated_at: new Date().toISOString(), generation_prompt_version: "journal-v1", revision: revision + 1,
    }).eq("journey_id", journeyId).eq("revision", revision).select("content,revision").maybeSingle();
    if (error) return apiError(500, "PAGE_GENERATION_FAILED", "保存 AI 页面失败", true);
    if (!data) return apiError(409, "PAGE_CONFLICT", "页面已被修改，本次 AI 结果未覆盖新内容");
    if (journey.published_at) revalidatePath(`/j/${journey.slug}`);
    return NextResponse.json({ document: data.content, revision: data.revision, source: result.source });
  } catch (error) {
    return apiError(422, "PAGE_GENERATION_FAILED", error instanceof Error ? error.message : "AI 页面生成失败", true);
  }
}

