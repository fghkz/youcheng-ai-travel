import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, readJson, requireUser } from "@/lib/api";
import { createEntryRequestSchema } from "@/lib/journey-schemas";

export async function POST(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createEntryRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_ENTRY", parsed.error.issues[0]?.message ?? "旅行记录无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: journey } = await auth.supabase.from("travel_journeys").select("id,slug,published_at")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!journey) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  if (parsed.data.stopId) {
    const { data: stop } = await auth.supabase.from("travel_journey_stops").select("id")
      .eq("id", parsed.data.stopId).eq("journey_id", journeyId).maybeSingle();
    if (!stop) return apiError(400, "INVALID_STOP", "所选地点不属于该旅行");
  }
  const { data: latest } = await auth.supabase.from("travel_journal_entries").select("sort_order")
    .eq("journey_id", journeyId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await auth.supabase.from("travel_journal_entries").insert({
    journey_id: journeyId, stop_id: parsed.data.stopId, author_id: auth.userId,
    title: parsed.data.title, body: parsed.data.body, mood_key: parsed.data.moodKey,
    mood_text: parsed.data.moodText, message: parsed.data.message,
    happened_at: parsed.data.happenedAt ?? new Date().toISOString(),
    status: parsed.data.status, is_public: parsed.data.isPublic, sort_order: Number(latest?.sort_order ?? 0) + 1,
  }).select("*").single();
  if (error || !data) return apiError(500, "ENTRY_SAVE_FAILED", "保存旅行记录失败，请稍后重试");
  if (journey.published_at && data.status === "ready") revalidatePath(`/j/${journey.slug}`);
  return NextResponse.json({ entry: data }, { status: 201 });
}

