import { NextResponse } from "next/server";
import { apiError, readJson, requireUser } from "@/lib/api";
import { startJourneyRequestSchema } from "@/lib/journey-schemas";
import { generateJournalPage } from "@/lib/services/journal";
import { pageDocumentSchema } from "@/lib/journey-types";

function slugFor(title: string) {
  const readable = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${readable || "journey"}-${suffix}`;
}

export async function POST(request: Request) {
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = startJourneyRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_JOURNEY", parsed.error.issues[0]?.message ?? "旅行数据无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: trip } = await auth.supabase.from("trips").select("id,title,destination,start_date,end_date,status,final_content,finalized_at")
    .eq("id", parsed.data.sourceTripId).eq("user_id", auth.userId).maybeSingle();
  if (!trip) return apiError(404, "PLAN_NOT_FOUND", "没有找到该规划");
  if (trip.status !== "finalized" || !trip.final_content || !trip.finalized_at) return apiError(409, "PLAN_NOT_FINALIZED", "请先生成最终版本，再开始旅行");
  const { data: journey, error } = await auth.supabase.rpc("start_travel_journey", {
    p_source_trip_id: trip.id, p_slug: slugFor(trip.title), p_theme_key: parsed.data.themeKey,
  });
  if (error || !journey) return apiError(500, "JOURNEY_START_FAILED", error?.message ?? "开始旅行失败", true);
  const [stops, document] = await Promise.all([
    auth.supabase.from("travel_journey_stops").select("id,place_name,planned_date,day_number").eq("journey_id", journey.id).order("sort_order"),
    auth.supabase.from("travel_page_documents").select("content,revision").eq("journey_id", journey.id).maybeSingle(),
  ]);
  try {
    const current = pageDocumentSchema.safeParse(document.data?.content);
    const generated = await generateJournalPage({
      title: journey.title, destination: trip.destination, dates: `${trip.start_date} 至 ${trip.end_date}`,
      companionLabel: journey.companion_label, closingMessage: journey.closing_message,
      themeKey: journey.theme_key, tone: "daily", stops: stops.data ?? [], entries: [], media: [],
      current: current.success ? current.data : null, preserveLocked: true,
    });
    await auth.supabase.from("travel_page_documents").update({
      content: generated.document, generated_at: new Date().toISOString(),
      generation_prompt_version: "journal-v1", revision: Number(document.data?.revision ?? 1) + 1,
    }).eq("journey_id", journey.id);
  } catch { /* the starter already created a valid deterministic document */ }
  return NextResponse.json({ journey }, { status: 201 });
}

