import { NextResponse } from "next/server";
import { saveTripRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function dayCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function apiError(status: number, code: string, message: string, retryable = false) {
  return NextResponse.json({ error: { code, message, retryable } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "请求内容不是有效的 JSON");
  }

  const parsed = saveTripRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_TRIP", parsed.error.issues[0]?.message ?? "行程数据不完整");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return apiError(401, "AUTH_REQUIRED", "请先登录后再保存行程");
  }

  const { preferences, spots, result } = parsed.data;
  const title = `${preferences.destination}${dayCount(preferences.startDate, preferences.endDate)}日游`;
  const tripInsert: TablesInsert<"trips"> = {
    user_id: userId,
    title,
    destination: preferences.destination,
    hotel: preferences.hotel,
    start_from_hotel: preferences.startFromHotel,
    start_date: preferences.startDate,
    end_date: preferences.endDate,
    daily_start_time: preferences.dailyStartTime,
    daily_end_time: preferences.dailyEndTime,
    transport_preference: preferences.transportPreference,
    pace: preferences.pace,
    status: "active",
  };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert(tripInsert)
    .select("id")
    .single();

  if (tripError || !trip) {
    return apiError(500, "TRIP_SAVE_FAILED", "保存旅行条件失败，请稍后重试", true);
  }

  try {
    const spotRows: TablesInsert<"trip_spots">[] = spots.map((spot, index) => ({
      trip_id: trip.id,
      user_id: userId,
      provider: spot.source,
      external_spot_id: spot.id,
      spot_name: spot.name,
      longitude: spot.location.longitude,
      latitude: spot.location.latitude,
      selected_order: index + 1,
      spot_snapshot: jsonValue({ ...spot, images: spot.images.slice(0, 2) }),
    }));

    const { error: spotsError } = await supabase.from("trip_spots").insert(spotRows);
    if (spotsError) throw spotsError;

    const { error: versionError } = await supabase.rpc("create_itinerary_version", {
      p_trip_id: trip.id,
      p_preferences_snapshot: jsonValue(preferences),
      p_itinerary_result: jsonValue(result.itinerary),
      p_source_meta: jsonValue({ ...result.dataSources, fallbackNotices: result.fallbackNotices }),
      p_model_provider: "deepseek",
      p_model_name: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });
    if (versionError) throw versionError;
  } catch {
    await supabase.from("trips").delete().eq("id", trip.id);
    return apiError(500, "TRIP_SAVE_FAILED", "保存景点或行程版本失败，已撤销本次保存", true);
  }

  return NextResponse.json({ trip: { id: trip.id, title } }, { status: 201 });
}
