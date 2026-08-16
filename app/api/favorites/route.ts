import { NextResponse } from "next/server";
import { z } from "zod";
import { scenicSpotSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

const deleteFavoriteSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  externalSpotId: z.string().trim().min(1).max(200),
});

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message, retryable: status >= 500 } }, { status });
}

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return { supabase, userId: error || typeof userId !== "string" ? null : userId };
}

export async function GET() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return apiError(401, "AUTH_REQUIRED", "请先登录后查看收藏");

  const { data, error } = await supabase
    .from("favorite_spots")
    .select("provider,external_spot_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return apiError(500, "FAVORITES_READ_FAILED", "暂时无法读取收藏，请稍后重试");
  return NextResponse.json({ favorites: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "请求内容不是有效的 JSON");
  }

  const parsed = z.object({ spot: scenicSpotSchema }).safeParse(body);
  if (!parsed.success) return apiError(400, "INVALID_SPOT", parsed.error.issues[0]?.message ?? "景点数据不完整");

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return apiError(401, "AUTH_REQUIRED", "请先登录后收藏景点");

  const spot = parsed.data.spot;
  const row: TablesInsert<"favorite_spots"> = {
    user_id: userId,
    provider: spot.source,
    external_spot_id: spot.id,
    spot_name: spot.name,
    spot_snapshot: jsonValue({ ...spot, images: spot.images.slice(0, 2) }),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("favorite_spots")
    .upsert(row, { onConflict: "user_id,provider,external_spot_id" });

  if (error) return apiError(500, "FAVORITE_SAVE_FAILED", "收藏失败，请稍后重试");
  return NextResponse.json({ favorite: { provider: spot.source, externalSpotId: spot.id } });
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "请求内容不是有效的 JSON");
  }

  const parsed = deleteFavoriteSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "INVALID_FAVORITE", "缺少要取消收藏的景点信息");

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return apiError(401, "AUTH_REQUIRED", "请先登录后管理收藏");

  const { error } = await supabase
    .from("favorite_spots")
    .delete()
    .eq("user_id", userId)
    .eq("provider", parsed.data.provider)
    .eq("external_spot_id", parsed.data.externalSpotId);

  if (error) return apiError(500, "FAVORITE_DELETE_FAILED", "取消收藏失败，请稍后重试");
  return NextResponse.json({ success: true });
}
