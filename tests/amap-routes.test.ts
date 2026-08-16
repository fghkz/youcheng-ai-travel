import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLiveRouteMatrix, parseAmapRoute } from "@/lib/services/routes";
import { HOTEL_ORIGIN_ID, type ScenicSpot, type TripPreferences } from "@/lib/types";

const origin: ScenicSpot = {
  id: "origin",
  name: "起点",
  location: { longitude: 120.1234567, latitude: 30.1234567 },
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
  visual: "",
  source: "demo",
};

const destination: ScenicSpot = { ...origin, id: "destination", name: "终点" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AMap route adapter", () => {
  it("maps the documented driving response in seconds and meters", () => {
    const route = parseAmapRoute({
      status: "1",
      route: { paths: [{ duration: "601", distance: "4200", strategy: "速度优先", steps: [
        { polyline: "120.1,30.1;120.2,30.2" },
        { polyline: "120.2,30.2;120.3,30.3" },
      ] }] },
    }, origin, destination, "driving");

    expect(route).toMatchObject({
      durationMinutes: 11,
      distanceMeters: 4200,
      summary: "速度优先",
      reachable: true,
      source: "amap-api",
    });
    expect(route.polyline).toEqual([
      { longitude: 120.1, latitude: 30.1 },
      { longitude: 120.2, latitude: 30.2 },
      { longitude: 120.3, latitude: 30.3 },
    ]);
  });

  it("sums transit segment distances and extracts line names", () => {
    const route = parseAmapRoute({
      status: "1",
      route: {
        transits: [{
          duration: "1860",
          segments: [{
            walking: { distance: "320", steps: [{ polyline: "120.1,30.1;120.15,30.15" }] },
            bus: { buslines: [{ name: "地铁1号线(萧山国际机场-湘湖)", distance: "6500", polyline: "120.15,30.15;120.3,30.3" }] },
          }],
        }],
      },
    }, origin, destination, "transit");

    expect(route).toMatchObject({
      durationMinutes: 31,
      distanceMeters: 6820,
      summary: "地铁1号线(萧山国际机场-湘湖)",
      reachable: true,
    });
    expect(route.polyline).toHaveLength(3);
  });

  it("marks empty route results as unreachable without inventing facts", () => {
    const route = parseAmapRoute({ status: "1", route: { transits: [] } }, origin, destination, "transit");
    expect(route).toMatchObject({
      durationMinutes: null,
      distanceMeters: null,
      reachable: false,
    });
  });

  it("surfaces AMap service errors with the official info code", () => {
    expect(() => parseAmapRoute({ status: "0", info: "INVALID_USER_KEY", infocode: "10001" }, origin, destination, "driving"))
      .toThrow("INVALID_USER_KEY / 10001");
  });

  it("geocodes the hotel and requests a real hotel-to-spot route", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-amap-key");
    const preferences: TripPreferences = {
      destination: "杭州",
      hotel: "西湖大酒店",
      startFromHotel: true,
      startDate: "2026-10-02",
      endDate: "2026-10-03",
      dailyStartTime: "09:00",
      dailyEndTime: "18:00",
      transportPreference: "transit",
      pace: "comfortable",
    };
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/geocode/geo")) {
        expect(url).toContain("address=");
        return new Response(JSON.stringify({ status: "1", geocodes: [{ location: "120.10,30.10", formatted_address: "杭州市西湖大酒店" }] }));
      }
      expect(url).toContain("origin=120.1%2C30.1");
      return new Response(JSON.stringify({ status: "1", route: { transits: [{ duration: "600", segments: [{ walking: { distance: "800", steps: [{ polyline: "120.1,30.1;120.2,30.2" }] } }] }] } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const routes = await buildLiveRouteMatrix([destination], preferences);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ originSpotId: HOTEL_ORIGIN_ID, destinationSpotId: "destination", durationMinutes: 10, reachable: true });
    expect(routes[0].polyline).toHaveLength(2);
  });

  it("waits two seconds and retries when AMap returns account QPS error 10021", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AMAP_API_KEY", "test-amap-key");
    const preferences: TripPreferences = {
      destination: "杭州",
      hotel: "西湖大酒店",
      startFromHotel: true,
      startDate: "2026-10-02",
      endDate: "2026-10-03",
      dailyStartTime: "09:00",
      dailyEndTime: "18:00",
      transportPreference: "transit",
      pace: "comfortable",
    };
    let routeAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).includes("/geocode/geo")) {
        return new Response(JSON.stringify({ status: "1", geocodes: [{ location: "120.10,30.10" }] }));
      }
      routeAttempts += 1;
      if (routeAttempts === 1) {
        return new Response(JSON.stringify({ status: "0", info: "CUQPS_HAS_EXCEEDED_THE_LIMIT", infocode: "10021" }));
      }
      return new Response(JSON.stringify({ status: "1", route: { transits: [{ duration: "600", segments: [] }] } }));
    }));

    const pendingRoutes = buildLiveRouteMatrix([destination], preferences);
    await vi.advanceTimersByTimeAsync(2_000);
    const routes = await pendingRoutes;
    expect(routeAttempts).toBe(2);
    expect(routes[0]).toMatchObject({ originSpotId: HOTEL_ORIGIN_ID, reachable: true });
  });
});
