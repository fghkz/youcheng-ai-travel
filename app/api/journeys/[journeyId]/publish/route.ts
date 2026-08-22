import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, requireUser } from "@/lib/api";
import { pageDocumentSchema } from "@/lib/journey-types";

export async function POST(_request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [journey, document, stops, entries] = await Promise.all([
    auth.supabase.from("travel_journeys").select("id,title,slug,revision").eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle(),
    auth.supabase.from("travel_page_documents").select("content").eq("journey_id", journeyId).maybeSingle(),
    auth.supabase.from("travel_journey_stops").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).eq("is_public", true),
    auth.supabase.from("travel_journal_entries").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).eq("status", "ready").eq("is_public", true),
  ]);
  if (!journey.data) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  if (!pageDocumentSchema.safeParse(document.data?.content).success) return apiError(409, "PAGE_NOT_READY", "请先生成并保存有效的旅行记录页");
  if ((stops.count ?? 0) + (entries.count ?? 0) < 1) return apiError(409, "NO_PUBLIC_CONTENT", "至少保留一个公开地点或已完成记录");
  const publishedAt = new Date().toISOString();
  const { data, error } = await auth.supabase.from("travel_journeys").update({
    visibility: "public", published_at: publishedAt, revision: journey.data.revision + 1,
  }).eq("id", journeyId).eq("owner_id", auth.userId).eq("revision", journey.data.revision)
    .select("slug,published_at,revision").maybeSingle();
  if (error) return apiError(500, "PUBLISH_FAILED", "发布失败，请稍后重试");
  if (!data) return apiError(409, "JOURNEY_CONFLICT", "旅行已在其他页面更新，请刷新后重试");
  revalidatePath(`/j/${data.slug}`);
  return NextResponse.json({ journey: data, publicPath: `/j/${data.slug}` });
}

