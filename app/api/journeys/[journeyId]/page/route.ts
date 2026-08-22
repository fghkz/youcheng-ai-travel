import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, readJson, requireUser } from "@/lib/api";
import { savePageDocumentRequestSchema } from "@/lib/journey-schemas";

export async function PATCH(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = savePageDocumentRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_PAGE_DOCUMENT", parsed.error.issues[0]?.message ?? "页面内容无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: journey } = await auth.supabase.from("travel_journeys").select("slug,published_at")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!journey) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  const { data, error } = await auth.supabase.from("travel_page_documents").update({
    content: parsed.data.content, revision: parsed.data.revision + 1,
  }).eq("journey_id", journeyId).eq("revision", parsed.data.revision).select("content,revision,updated_at").maybeSingle();
  if (error) return apiError(500, "PAGE_SAVE_FAILED", "保存页面失败，请稍后重试");
  if (!data) return apiError(409, "PAGE_CONFLICT", "页面已在其他窗口更新，请刷新后重试");
  if (journey.published_at) revalidatePath(`/j/${journey.slug}`);
  return NextResponse.json({ document: data.content, revision: data.revision, updatedAt: data.updated_at });
}

