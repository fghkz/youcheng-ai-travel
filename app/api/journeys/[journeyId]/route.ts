import { NextResponse } from "next/server";
import { apiError, readJson, requireUser } from "@/lib/api";
import { updateJourneyRequestSchema } from "@/lib/journey-schemas";

export async function PATCH(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(journeyId)) return apiError(400, "INVALID_JOURNEY_ID", "旅行 ID 无效");
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = updateJourneyRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_JOURNEY", parsed.error.issues[0]?.message ?? "旅行数据无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { revision, ...value } = parsed.data;
  const update: Record<string, unknown> = { revision: revision + 1 };
  if (value.title !== undefined) update.title = value.title;
  if (value.summary !== undefined) update.summary = value.summary;
  if (value.companionLabel !== undefined) update.companion_label = value.companionLabel;
  if (value.closingMessage !== undefined) update.closing_message = value.closingMessage;
  if (value.themeKey !== undefined) update.theme_key = value.themeKey;
  if (value.coverMediaId !== undefined) {
    if (value.coverMediaId) {
      const { data: cover } = await auth.supabase.from("travel_journal_media").select("id").eq("id", value.coverMediaId).eq("journey_id", journeyId).maybeSingle();
      if (!cover) return apiError(400, "INVALID_COVER", "封面照片不属于该旅行");
    }
    update.cover_media_id = value.coverMediaId;
  }
  if (value.status !== undefined) { update.status = value.status; update.completed_at = value.status === "completed" ? new Date().toISOString() : null; }
  const { data, error } = await auth.supabase.from("travel_journeys").update(update)
    .eq("id", journeyId).eq("owner_id", auth.userId).eq("revision", revision)
    .select("id,title,summary,companion_label,closing_message,status,theme_key,visibility,slug,cover_media_id,published_at,revision").maybeSingle();
  if (error) return apiError(500, "JOURNEY_SAVE_FAILED", "保存旅行失败，请稍后重试");
  if (!data) return apiError(409, "JOURNEY_CONFLICT", "内容已在其他页面更新，请刷新后重试");
  return NextResponse.json({ journey: data });
}

