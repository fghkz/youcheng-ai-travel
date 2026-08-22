import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, requireUser } from "@/lib/api";

export async function POST(_request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: current } = await auth.supabase.from("travel_journeys").select("slug,revision")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!current) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  const { data, error } = await auth.supabase.from("travel_journeys").update({
    visibility: "private", published_at: null, revision: current.revision + 1,
  }).eq("id", journeyId).eq("owner_id", auth.userId).eq("revision", current.revision)
    .select("slug,revision").maybeSingle();
  if (error) return apiError(500, "UNPUBLISH_FAILED", "撤回发布失败，请稍后重试");
  if (!data) return apiError(409, "JOURNEY_CONFLICT", "旅行已在其他页面更新，请刷新后重试");
  revalidatePath(`/j/${current.slug}`);
  return NextResponse.json({ journey: data });
}

