import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeepSeekItinerary } from "@/lib/services/planner";
import { HOTEL_ORIGIN_ID, type RouteOption, type ScenicSpot, type TripPreferences } from "@/lib/types";

const preferences: TripPreferences = {
  destination: "杭州",
  hotel: "",
  startFromHotel: false,
  startDate: "2026-08-16",
  endDate: "2026-08-16",
  dailyStartTime: "09:00",
  dailyEndTime: "18:00",
  transportPreference: "transit",
  pace: "comfortable",
};

const spots: ScenicSpot[] = ["a", "b"].map((id) => ({
  id,
  name: id === "a" ? "景点 A" : "景点 B",
  location: { longitude: 120, latitude: 30 },
  description: null,
  shortDescription: null,
  shortDescriptionSource: "missing",
  address: null,
  images: [],
  openingHours: null,
  openingHoursStatus: "missing",
  referencePrice: null,
  priceStatus: "missing",
  category: "景点",
  visual: id,
  source: "demo",
}));

const route: RouteOption = {
  originSpotId: "a",
  destinationSpotId: "b",
  mode: "transit",
  durationMinutes: 30,
  distanceMeters: 5000,
  summary: "地铁示例路线",
  reachable: true,
  polyline: [],
  source: "amap-api",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DeepSeek planner adapter", () => {
  it("uses the documented JSON mode request and validates a feasible itinerary", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-only-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-flash");
    const resultJson = {
      days: [{
        date: "2026-08-16",
        theme: "城市漫游",
        items: [
          { spotId: "a", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "11:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: null },
          { spotId: "b", arrivalTime: "12:00", visitStartTime: "12:00", visitEndTime: "14:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: route },
        ],
      }],
      unscheduledSpots: [],
      warnings: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(resultJson) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const planned = await createDeepSeekItinerary(preferences, spots, [route]);
    expect(planned.days[0].items).toMatchObject([
      { arrivalTime: "09:00", visitEndTime: "11:00", suggestedVisitMinutes: 120 },
      { arrivalTime: "13:00", visitEndTime: "15:00", suggestedVisitMinutes: 120 },
    ]);
    expect(planned.days[0].mealBreak).toEqual({ label: "午餐与休息", startTime: "11:30", endTime: "12:30", durationMinutes: 60 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    });
    expect(body.messages[1].content).toContain("JSON 输出格式示例");
    expect(body.messages[1].content).toContain("用户选择的游玩节奏是“舒适”");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-only-key");
  });

  it("rejects an itinerary that omits travel time", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-only-key");
    const invalid = {
      days: [{
        date: "2026-08-16",
        theme: "错误示例",
        items: [
          { spotId: "a", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "11:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: null },
          { spotId: "b", arrivalTime: "11:30", visitStartTime: "11:30", visitEndTime: "14:00", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: route },
        ],
      }],
      unscheduledSpots: [],
      warnings: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(invalid) } }],
    }), { status: 200 })));

    await expect(createDeepSeekItinerary(preferences, spots, [route])).rejects.toThrow("交通耗时");
  });

  it("does not retry authentication failures", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "invalid-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createDeepSeekItinerary(preferences, spots, [route])).rejects.toThrow("HTTP 401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fills every date in the selected range when the model omits empty days", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-only-key");
    const multiDayPreferences = { ...preferences, endDate: "2026-08-18" };
    const resultJson = {
      days: [{
        date: "2026-08-16",
        theme: "城市漫游",
        items: [{ spotId: "a", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "11:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: null }],
      }],
      unscheduledSpots: [],
      warnings: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(resultJson) } }],
    }), { status: 200 })));

    const result = await createDeepSeekItinerary(multiDayPreferences, [spots[0]], [route]);
    expect(result.days.map((day) => day.date)).toEqual(["2026-08-16", "2026-08-17", "2026-08-18"]);
    expect(result.days.slice(1).every((day) => day.theme === "自由活动" && day.items.length === 0)).toBe(true);
    expect(result.warnings).toContain("AI 未安排其中 2 天，已保留为空闲日期，可继续添加景点。");
  });

  it("requires and preserves a real hotel-to-first-spot route for every day", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-only-key");
    const hotelPreferences = { ...preferences, hotel: "西湖大酒店", startFromHotel: true };
    const hotelRoute: RouteOption = { ...route, originSpotId: HOTEL_ORIGIN_ID, destinationSpotId: "a", durationMinutes: 20 };
    const resultJson = {
      days: [{
        date: preferences.startDate,
        theme: "酒店出发",
        items: [{ spotId: "a", arrivalTime: "09:20", visitStartTime: "09:20", visitEndTime: "11:50", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: hotelRoute }],
      }],
      unscheduledSpots: [],
      warnings: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(resultJson) } }],
    }), { status: 200 })));

    const result = await createDeepSeekItinerary(hotelPreferences, [spots[0]], [hotelRoute]);
    expect(result.days[0].items[0].routeFromPrevious?.originSpotId).toBe(HOTEL_ORIGIN_ID);
  });

  it("compacts short visits into the earliest day when travel time still fits", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-only-key");
    const twoDayPreferences = { ...preferences, endDate: "2026-08-17" };
    const spreadResult = {
      days: [
        {
          date: "2026-08-16",
          theme: "第一站",
          items: [{ spotId: "a", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "11:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: null }],
        },
        {
          date: "2026-08-17",
          theme: "第二站",
          items: [{ spotId: "b", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "11:30", suggestedVisitMinutes: 150, visitDurationSource: "ai-suggestion", routeFromPrevious: null }],
        },
      ],
      unscheduledSpots: [],
      warnings: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(spreadResult) } }],
    }), { status: 200 })));

    const result = await createDeepSeekItinerary(twoDayPreferences, spots, [route]);
    expect(result.days.map((day) => day.items.length)).toEqual([2, 0]);
    expect(result.days[0].items[1]).toMatchObject({ spotId: "b", arrivalTime: "13:00", visitEndTime: "15:00", suggestedVisitMinutes: 120 });
    expect(result.days[0].mealBreak).toEqual({ label: "午餐与休息", startTime: "11:30", endTime: "12:30", durationMinutes: 60 });
    expect(result.days[0].items[1].routeFromPrevious).toMatchObject({ originSpotId: "a", destinationSpotId: "b" });
    expect(result.warnings).toContain("已在计入交通耗时后优先合并到较早日期，减少不必要的跨日拆分。");
  });
});
