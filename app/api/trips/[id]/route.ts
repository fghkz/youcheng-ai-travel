import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, retryable: status >= 500 } }, { status });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/trips/[id]">) {
  const { id: rawId } = await context.params;
  if (!/^\d+$/.test(rawId)) return apiError(400, "INVALID_TRIP_ID", "行程 ID 无效");
  const tripId = Number(rawId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) return apiError(400, "INVALID_TRIP_ID", "行程 ID 无效");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") return apiError(401, "AUTH_REQUIRED", "请先登录后再删除行程");

  const { data, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return apiError(500, "TRIP_DELETE_FAILED", "删除行程失败，请稍后重试");
  if (!data) return apiError(404, "TRIP_NOT_FOUND", "没有找到该行程，或你无权删除");
  return NextResponse.json({ success: true, tripId: data.id });
}
