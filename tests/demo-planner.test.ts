import { describe, expect, it } from "vitest";
import { getDemoSpots } from "@/lib/demo-data";
import { createDemoItinerary } from "@/lib/services/planner";
import { buildDemoRouteMatrix } from "@/lib/services/routes";
import type { TripPreferences } from "@/lib/types";

const preferences: TripPreferences = {
  destination: "杭州", startDate: "2026-10-02", endDate: "2026-10-04",
  hotel: "", startFromHotel: false,
  dailyStartTime: "09:00", dailyEndTime: "18:00", transportPreference: "either",
  pace: "comfortable",
};

describe("demo itinerary", () => {
  it("builds both route modes for either preference", () => {
    const spots = getDemoSpots("杭州").slice(0, 2);
    const routes = buildDemoRouteMatrix(spots, "either");
    expect(routes).toHaveLength(4);
    expect(new Set(routes.map((route) => route.mode))).toEqual(new Set(["transit", "driving"]));
  });

  it("never duplicates spots or exceeds daily time", () => {
    const spots = getDemoSpots("杭州");
    const result = createDemoItinerary(preferences, spots, buildDemoRouteMatrix(spots, "either"));
    const items = result.days.flatMap((day) => day.items);
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(new Set(items.map((item) => item.spotId)).size).toBe(items.length);
    expect(items.every((item) => item.visitStartTime >= "09:00" && item.visitEndTime <= "18:00")).toBe(true);
    expect(result.days.filter((day) => day.items.length > 0).every((day) => day.mealBreak?.durationMinutes === 60)).toBe(true);
    expect(result.days.flatMap((day) => day.items.map((item) => ({ day, item }))).every(({ day, item }) =>
      !day.mealBreak || item.visitEndTime <= day.mealBreak.startTime || item.visitStartTime >= day.mealBreak.endTime,
    )).toBe(true);
    expect(items.length + result.unscheduledSpots.length).toBe(spots.length);
  });

  it("uses visibly different fallback durations and meal time for each pace", () => {
    const spots = getDemoSpots("杭州").slice(0, 4);
    const routes = buildDemoRouteMatrix(spots, "either");
    const leisurely = createDemoItinerary({ ...preferences, pace: "leisurely" }, spots, routes);
    const compact = createDemoItinerary({ ...preferences, pace: "compact" }, spots, routes);

    expect(leisurely.days.flatMap((day) => day.items).every((item) => item.suggestedVisitMinutes >= 180)).toBe(true);
    expect(leisurely.days.filter((day) => day.items.length > 0).every((day) => day.mealBreak?.durationMinutes === 90)).toBe(true);
    expect(compact.days.flatMap((day) => day.items).every((item) => item.suggestedVisitMinutes <= 90)).toBe(true);
    expect(compact.days.filter((day) => day.items.length > 0).every((day) => day.mealBreak?.durationMinutes === 60)).toBe(true);
  });
});
