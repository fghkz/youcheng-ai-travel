import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, readJson, requireUser } from "@/lib/api";
import { updateEntryRequestSchema } from "@/lib/journey-schemas";

export async function PATCH(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = updateEntryRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_ENTRY", parsed.error.issues[0]?.message ?? "旅行记录无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: current } = await auth.supabase.from("travel_journal_entries").select("journey_id,author_id")
    .eq("id", entryId).eq("author_id", auth.userId).maybeSingle();
  if (!current) return apiError(404, "ENTRY_NOT_FOUND", "没有找到该旅行记录");
  const { revision, ...value } = parsed.data;
  if (value.stopId) {
    const { data: stop } = await auth.supabase.from("travel_journey_stops").select("id")
      .eq("id", value.stopId).eq("journey_id", current.journey_id).maybeSingle();
    if (!stop) return apiError(400, "INVALID_STOP", "所选地点不属于该旅行");
  }
  const update: Record<string, unknown> = { revision: revision + 1 };
  const mapping: Record<string, string> = { stopId: "stop_id", moodKey: "mood_key", moodText: "mood_text", happenedAt: "happened_at", isPublic: "is_public" };
  for (const [key, field] of Object.entries(value)) update[mapping[key] ?? key] = field;
  const { data, error } = await auth.supabase.from("travel_journal_entries").update(update)
    .eq("id", entryId).eq("author_id", auth.userId).eq("revision", revision).select("*").maybeSingle();
  if (error) return apiError(500, "ENTRY_SAVE_FAILED", "保存旅行记录失败，请稍后重试");
  if (!data) return apiError(409, "ENTRY_CONFLICT", "记录已在其他页面更新，请刷新后重试");
  const { data: journey } = await auth.supabase.from("travel_journeys").select("slug,published_at")
    .eq("id", current.journey_id).eq("owner_id", auth.userId).maybeSingle();
  if (journey?.published_at && data.status === "ready") revalidatePath(`/j/${journey.slug}`);
  return NextResponse.json({ entry: data });
}

