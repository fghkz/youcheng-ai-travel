import { NextResponse } from "next/server";
import { itineraryRequestSchema } from "@/lib/schemas";
import { createDeepSeekItinerary, createDemoItinerary } from "@/lib/services/planner";
import { buildDemoRouteMatrix, buildLiveRouteMatrix } from "@/lib/services/routes";
import type { ApiErrorResponse, ItineraryResponse, RouteOption, ServiceMode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { preferences, spots } = itineraryRequestSchema.parse(await request.json());
    const appMode = process.env.APP_DATA_MODE ?? "demo";
    const allowFallback = process.env.ALLOW_DEMO_FALLBACK === "true";
    const fallbackNotices: string[] = [];
    let routes: RouteOption[];
    let routeMode: ServiceMode;
    let plannerMode: ServiceMode;

    if (appMode === "demo") {
      routes = buildDemoRouteMatrix(spots, preferences.transportPreference);
      routeMode = "demo";
    } else {
      try {
        routes = await buildLiveRouteMatrix(spots, preferences);
        routeMode = "live";
      } catch (error) {
        if (!allowFallback) throw error;
        routes = buildDemoRouteMatrix(spots, preferences.transportPreference);
        routeMode = "fallback";
        fallbackNotices.push(`路线服务已回退为演示估算：${error instanceof Error ? error.message : "服务暂不可用"}`);
      }
    }

    let itinerary;
    if (appMode === "demo") {
      itinerary = createDemoItinerary(preferences, spots, routes);
      plannerMode = "demo";
    } else {
      try {
        itinerary = await createDeepSeekItinerary(preferences, spots, routes);
        plannerMode = "live";
      } catch (error) {
        if (!allowFallback) throw error;
        itinerary = createDemoItinerary(preferences, spots, routes);
        plannerMode = "fallback";
        fallbackNotices.push(`AI 规划已回退为本地演示排程：${error instanceof Error ? error.message : "服务暂不可用"}`);
      }
    }

    const body: ItineraryResponse = {
      itinerary,
      dataSources: { scenic: spots.every((spot) => spot.source === "demo") ? "demo" : "live", route: routeMode, planner: plannerMode },
      fallbackNotices: appMode === "demo" ? ["当前为演示模式，路线与行程仅用于体验产品流程。"] : fallbackNotices,
    };
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "行程生成失败，请稍后重试";
    const body: ApiErrorResponse = { error: { code: "ITINERARY_GENERATION_FAILED", message, retryable: true } };
    return NextResponse.json(body, { status: 502 });
  }
}
