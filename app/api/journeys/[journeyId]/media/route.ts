import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, readJson, requireUser } from "@/lib/api";
import { registerMediaRequestSchema } from "@/lib/journey-schemas";

export async function POST(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = registerMediaRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", parsed.error.issues[0]?.message ?? "图片信息无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: journey } = await auth.supabase.from("travel_journeys").select("id,slug,published_at")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!journey) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  const prefix = `${auth.userId}/${journeyId}/`;
  if (!parsed.data.path.startsWith(prefix)) return apiError(400, "INVALID_MEDIA_PATH", "图片路径无效");
  if (parsed.data.entryId) {
    const { data: entry } = await auth.supabase.from("travel_journal_entries").select("id")
      .eq("id", parsed.data.entryId).eq("journey_id", journeyId).maybeSingle();
    if (!entry) return apiError(400, "INVALID_ENTRY", "图片记录不属于该旅行");
    const { count } = await auth.supabase.from("travel_journal_media").select("id", { count: "exact", head: true }).eq("entry_id", entry.id);
    if ((count ?? 0) >= 9) return apiError(409, "MEDIA_LIMIT", "每条记录最多上传 9 张图片");
  }
  if (parsed.data.stopId) {
    const { data: stop } = await auth.supabase.from("travel_journey_stops").select("id")
      .eq("id", parsed.data.stopId).eq("journey_id", journeyId).maybeSingle();
    if (!stop) return apiError(400, "INVALID_STOP", "图片地点不属于该旅行");
  }
  const { data, error } = await auth.supabase.from("travel_journal_media").insert({
    journey_id: journeyId, owner_id: auth.userId, entry_id: parsed.data.entryId, stop_id: parsed.data.stopId,
    storage_path: parsed.data.path, mime_type: parsed.data.mimeType, size_bytes: parsed.data.sizeBytes,
    width: parsed.data.width, height: parsed.data.height, caption: parsed.data.caption,
    alt_text: parsed.data.altText, sort_order: parsed.data.sortOrder,
  }).select("*").single();
  if (error || !data) return apiError(500, "MEDIA_SAVE_FAILED", "保存图片信息失败，请稍后重试");
  if (journey.published_at) revalidatePath(`/j/${journey.slug}`);
  return NextResponse.json({ media: data }, { status: 201 });
}

