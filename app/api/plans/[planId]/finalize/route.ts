import { NextResponse } from "next/server";
import { apiError, parsePositiveId, readJson, requireUser } from "@/lib/api";
import { finalizePlanRequestSchema } from "@/lib/journey-schemas";
import { finalPlanSchema } from "@/lib/journey-types";
import { buildBaseFinalPlan, generateFinalPlan } from "@/lib/services/journal";

export async function POST(request: Request, context: { params: Promise<{ planId: string }> }) {
  const { planId: rawId } = await context.params;
  const planId = parsePositiveId(rawId);
  if (!planId) return apiError(400, "INVALID_PLAN_ID", "规划 ID 无效");
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = finalizePlanRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_FINAL_PLAN", parsed.error.issues[0]?.message ?? "最终规划内容无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [tripResult, itineraryResult, spotsResult] = await Promise.all([
    auth.supabase.from("trips").select("id,user_id,version").eq("id", planId).eq("user_id", auth.userId).maybeSingle(),
    auth.supabase.from("itinerary_versions").select("itinerary_result").eq("trip_id", planId).eq("user_id", auth.userId).eq("is_current", true).maybeSingle(),
    auth.supabase.from("trip_spots").select("external_spot_id,spot_snapshot").eq("trip_id", planId).eq("user_id", auth.userId).order("selected_order"),
  ]);
  if (!tripResult.data) return apiError(404, "PLAN_NOT_FOUND", "没有找到该规划");
  if (!itineraryResult.data) return apiError(409, "PLAN_HAS_NO_ITINERARY", "该规划没有可定稿的行程版本");
  try {
    const base = parsed.data.content ?? buildBaseFinalPlan(itineraryResult.data.itinerary_result, spotsResult.data ?? [], parsed.data.userRequest);
    const result = await generateFinalPlan(finalPlanSchema.parse(base), parsed.data.userRequest, parsed.data.selectedSpotIds);
    const nextVersion = Number(tripResult.data.version ?? 1) + 1;
    const { data: trip, error } = await auth.supabase.from("trips").update({
      final_content: result.content, final_route: result.content, finalized_at: new Date().toISOString(),
      status: "finalized", version: nextVersion,
    }).eq("id", planId).eq("user_id", auth.userId).eq("version", tripResult.data.version ?? 1)
      .select("id,version,finalized_at").maybeSingle();
    if (error) return apiError(500, "FINALIZE_FAILED", "保存最终规划失败，请稍后重试");
    if (!trip) return apiError(409, "PLAN_CONFLICT", "规划已在其他页面更新，请刷新后重试");
    return NextResponse.json({ plan: trip, content: result.content, source: result.source });
  } catch (error) {
    return apiError(422, "FINAL_PLAN_GENERATION_FAILED", error instanceof Error ? error.message : "最终规划生成失败", true);
  }
}

