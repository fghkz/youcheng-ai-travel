import { describe, expect, it } from "vitest";
import { saveTripRequestSchema, tripPreferencesSchema } from "@/lib/schemas";

const valid = {
  destination: "杭州", startDate: "2026-10-02", endDate: "2026-10-04",
  hotel: "", startFromHotel: false,
  dailyStartTime: "09:00", dailyEndTime: "18:00", transportPreference: "either" as const,
  pace: "comfortable" as const,
};

describe("tripPreferencesSchema", () => {
  it("accepts a valid trip", () => expect(tripPreferencesSchema.safeParse(valid).success).toBe(true));
  it("rejects reversed dates", () => expect(tripPreferencesSchema.safeParse({ ...valid, endDate: "2026-10-01" }).success).toBe(false));
  it("rejects invalid daily hours", () => expect(tripPreferencesSchema.safeParse({ ...valid, dailyEndTime: "08:30" }).success).toBe(false));
  it("requires a hotel when hotel departure is enabled", () => expect(tripPreferencesSchema.safeParse({ ...valid, startFromHotel: true }).success).toBe(false));
  it("accepts all supported travel paces", () => {
    expect(["leisurely", "comfortable", "compact"].every((pace) => tripPreferencesSchema.safeParse({ ...valid, pace }).success)).toBe(true);
    expect(tripPreferencesSchema.safeParse({ ...valid, pace: "rushed" }).success).toBe(false);
  });
});

const spot = {
  id: "west-lake",
  name: "杭州西湖",
  location: { longitude: 120.148, latitude: 30.243 },
  description: "西湖景区",
  shortDescription: "杭州代表性湖泊景区",
  shortDescriptionSource: "provider-truncated" as const,
  address: "杭州市西湖区",
  images: [],
  openingHours: null,
  openingHoursStatus: "missing" as const,
  referencePrice: null,
  priceStatus: "missing" as const,
  category: "自然风光",
  visual: "jade",
  source: "aliyun-scenic-api" as const,
};

const saveRequest = {
  preferences: valid,
  spots: [spot],
  result: {
    itinerary: { days: [], unscheduledSpots: [], warnings: [] },
    dataSources: { scenic: "live" as const, planner: "live" as const },
    fallbackNotices: [],
  },
};

describe("saveTripRequestSchema", () => {
  it("accepts a validated itinerary save payload", () => {
    expect(saveTripRequestSchema.safeParse(saveRequest).success).toBe(true);
  });

  it("rejects saving more than eight selected spots", () => {
    expect(saveTripRequestSchema.safeParse({ ...saveRequest, spots: Array.from({ length: 9 }, (_, index) => ({ ...spot, id: `spot-${index}` })) }).success).toBe(false);
  });
});
