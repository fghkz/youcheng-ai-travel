import "server-only";
import { HOTEL_ORIGIN_ID, type RouteMode, type RouteOption, type ScenicSpot, type TransportPreference, type TripPreferences } from "@/lib/types";

class AmapServiceError extends Error {
  constructor(message: string, readonly infocode: string | null = null) {
    super(message);
  }
}

const AMAP_REQUEST_INTERVAL_MS = 450;
const AMAP_RATE_LIMIT_BACKOFF_MS = [2_000, 4_000] as const;

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  return Array.isArray(value) ? asRecord(value[0]) : undefined;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function parsePolyline(value: unknown): Array<{ longitude: number; latitude: number }> {
  if (typeof value !== "string") return [];
  return value.split(";").flatMap((pair) => {
    const [longitude, latitude] = pair.split(",").map(Number);
    return Number.isFinite(longitude) && Number.isFinite(latitude)
      ? [{ longitude, latitude }]
      : [];
  });
}

function collectPolylines(value: unknown, output: Array<{ longitude: number; latitude: number }> = []) {
  const collect = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) collect(item);
      return;
    }
    const record = asRecord(candidate);
    if (!record) return;
    if (typeof record.polyline === "string") output.push(...parsePolyline(record.polyline));
    for (const [key, child] of Object.entries(record)) {
      if (key !== "polyline" && (Array.isArray(child) || asRecord(child))) collect(child);
    }
  };
  collect(value);
  return output.filter((coordinate, index, coordinates) => index === 0
    || coordinate.longitude !== coordinates[index - 1].longitude
    || coordinate.latitude !== coordinates[index - 1].latitude);
}

function distanceMeters(a: ScenicSpot, b: ScenicSpot): number {
  const radius = 6_371_000;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRadians(b.location.latitude - a.location.latitude);
  const dLon = toRadians(b.location.longitude - a.location.longitude);
  const lat1 = toRadians(a.location.latitude);
  const lat2 = toRadians(b.location.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(h)));
}

function requestedModes(preference: TransportPreference): RouteMode[] {
  if (preference === "either") return ["transit", "driving"];
  return [preference];
}

export function buildDemoRouteMatrix(spots: ScenicSpot[], preference: TransportPreference): RouteOption[] {
  const routes: RouteOption[] = [];
  for (const origin of spots) {
    for (const destination of spots) {
      if (origin.id === destination.id) continue;
      const distance = distanceMeters(origin, destination);
      for (const mode of requestedModes(preference)) {
        const speedKmH = mode === "driving" ? 25 : 15;
        const buffer = mode === "driving" ? 8 : 14;
        routes.push({
          originSpotId: origin.id,
          destinationSpotId: destination.id,
          mode,
          durationMinutes: Math.max(12, Math.round((distance / 1000 / speedKmH) * 60 + buffer)),
          distanceMeters: distance,
          summary: mode === "driving" ? "演示驾车路线" : "演示公交及步行路线",
          reachable: true,
          polyline: [],
          source: "demo",
        });
      }
    }
  }
  return routes;
}

async function fetchWithTimeout(url: URL, timeoutMs = 10_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!response.ok) throw new Error(`高德路线服务返回 HTTP ${response.status}`);
  return response.json();
}

function parseLocation(value: unknown): { longitude: number; latitude: number } | null {
  if (typeof value !== "string") return null;
  const [longitude, latitude] = value.split(",").map(Number);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? { longitude, latitude } : null;
}

async function resolveHotelSpot(preferences: TripPreferences): Promise<ScenicSpot> {
  const key = process.env.AMAP_API_KEY;
  if (!key) throw new Error("缺少 AMAP_API_KEY");
  const url = new URL("https://restapi.amap.com/v3/geocode/geo");
  url.searchParams.set("key", key);
  url.searchParams.set("address", `${preferences.destination} ${preferences.hotel}`);
  url.searchParams.set("city", preferences.destination);
  url.searchParams.set("output", "JSON");
  const payload = asRecord(await fetchWithTimeout(url));
  if (String(payload?.status) !== "1") {
    const detail = [payload?.info, payload?.infocode].filter(Boolean).map(String).join(" / ");
    throw new AmapServiceError(`高德无法识别入住酒店：${detail || "未知错误"}`);
  }
  const geocode = firstRecord(payload?.geocodes);
  const location = parseLocation(geocode?.location);
  if (!location) throw new AmapServiceError("高德没有找到该酒店，请输入酒店全称或详细地址");
  return {
    id: HOTEL_ORIGIN_ID,
    name: preferences.hotel,
    location,
    description: null,
    shortDescription: null,
    shortDescriptionSource: "missing",
    address: typeof geocode?.formatted_address === "string" ? geocode.formatted_address : preferences.hotel,
    images: [],
    openingHours: null,
    openingHoursStatus: "missing",
    referencePrice: null,
    priceStatus: "missing",
    category: "入住酒店",
    visual: "hotel",
    source: "demo",
  };
}

function transitDetails(transit: Record<string, unknown>): { distance: number | null; summary: string } {
  const lineNames: string[] = [];
  let totalDistance = 0;
  let hasDistance = false;
  const segments = Array.isArray(transit.segments) ? transit.segments : [];

  for (const rawSegment of segments) {
    const segment = asRecord(rawSegment);
    if (!segment) continue;

    const walkingDistance = finiteNumber(asRecord(segment.walking)?.distance);
    if (walkingDistance !== null) {
      totalDistance += walkingDistance;
      hasDistance = true;
    }

    const busLines = asRecord(segment.bus)?.buslines;
    if (Array.isArray(busLines)) {
      for (const rawLine of busLines) {
        const line = asRecord(rawLine);
        if (!line) continue;
        if (typeof line.name === "string" && line.name.trim()) lineNames.push(line.name.trim());
        const lineDistance = finiteNumber(line.distance);
        if (lineDistance !== null) {
          totalDistance += lineDistance;
          hasDistance = true;
        }
      }
    }

    for (const key of ["railway", "taxi"] as const) {
      const segmentDistance = finiteNumber(asRecord(segment[key])?.distance);
      if (segmentDistance !== null) {
        totalDistance += segmentDistance;
        hasDistance = true;
      }
    }
  }

  const uniqueLines = [...new Set(lineNames)].slice(0, 3);
  return {
    distance: hasDistance ? Math.round(totalDistance) : null,
    summary: uniqueLines.length > 0 ? uniqueLines.join(" → ") : "高德公共交通推荐路线",
  };
}

export function parseAmapRoute(payload: unknown, origin: ScenicSpot, destination: ScenicSpot, mode: RouteMode): RouteOption {
  const data = asRecord(payload) ?? {};
  if (String(data.status) !== "1") {
    const detail = [data.info, data.infocode].filter(Boolean).map(String).join(" / ");
    throw new AmapServiceError(`高德路线服务调用失败：${detail || "未知错误"}`, data.infocode ? String(data.infocode) : null);
  }
  const route = asRecord(data.route);
  let duration: number | null = null;
  let distance: number | null = null;
  let summary: string | null = null;
  let polyline: Array<{ longitude: number; latitude: number }> = [];

  if (mode === "driving") {
    const path = firstRecord(route?.paths);
    const durationSeconds = finiteNumber(path?.duration);
    duration = durationSeconds !== null ? Math.ceil(durationSeconds / 60) : null;
    distance = finiteNumber(path?.distance);
    polyline = collectPolylines(path?.steps);
    summary = typeof path?.strategy === "string" ? path.strategy : "高德驾车推荐路线";
  } else {
    const transit = firstRecord(route?.transits);
    const durationSeconds = finiteNumber(transit?.duration);
    duration = durationSeconds !== null ? Math.ceil(durationSeconds / 60) : null;
    if (transit) {
      ({ distance, summary } = transitDetails(transit));
      polyline = collectPolylines(transit.segments);
    }
    else summary = "高德未返回可用公共交通方案";
  }

  return {
    originSpotId: origin.id,
    destinationSpotId: destination.id,
    mode,
    durationMinutes: duration,
    distanceMeters: distance,
    summary,
    reachable: duration !== null,
    polyline,
    source: "amap-api",
  };
}

async function fetchAmapRoute(
  origin: ScenicSpot,
  destination: ScenicSpot,
  mode: RouteMode,
  preferences: TripPreferences,
): Promise<RouteOption> {
  const key = process.env.AMAP_API_KEY;
  if (!key) throw new Error("缺少 AMAP_API_KEY");
  const endpoint = mode === "driving"
    ? "https://restapi.amap.com/v3/direction/driving"
    : "https://restapi.amap.com/v3/direction/transit/integrated";
  const url = new URL(endpoint);
  url.searchParams.set("key", key);
  url.searchParams.set("origin", `${formatCoordinate(origin.location.longitude)},${formatCoordinate(origin.location.latitude)}`);
  url.searchParams.set("destination", `${formatCoordinate(destination.location.longitude)},${formatCoordinate(destination.location.latitude)}`);
  url.searchParams.set("output", "JSON");
  url.searchParams.set("extensions", "all");
  if (mode === "transit") {
    url.searchParams.set("city", preferences.destination);
    url.searchParams.set("date", preferences.startDate);
    url.searchParams.set("time", preferences.dailyStartTime);
  }
  const payload = await fetchWithTimeout(url);
  return parseAmapRoute(payload, origin, destination, mode);
}

async function mapRateLimited<T, R>(values: T[], worker: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) await delay(AMAP_REQUEST_INTERVAL_MS);
    results.push(await worker(values[index]));
  }
  return results;
}

async function fetchAmapRouteWithRetry(
  origin: ScenicSpot,
  destination: ScenicSpot,
  mode: RouteMode,
  preferences: TripPreferences,
): Promise<RouteOption> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= AMAP_RATE_LIMIT_BACKOFF_MS.length; attempt += 1) {
    try {
      return await fetchAmapRoute(origin, destination, mode, preferences);
    } catch (error) {
      lastError = error;
      const isRateLimited = error instanceof AmapServiceError && error.infocode === "10021";
      if (!isRateLimited || attempt >= AMAP_RATE_LIMIT_BACKOFF_MS.length) break;
      await delay(AMAP_RATE_LIMIT_BACKOFF_MS[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("高德路线请求失败");
}

export async function buildLiveRouteMatrix(spots: ScenicSpot[], preferences: TripPreferences): Promise<RouteOption[]> {
  if (!process.env.AMAP_API_KEY) throw new Error("缺少 AMAP_API_KEY");
  const tasks: Array<{ origin: ScenicSpot; destination: ScenicSpot; mode: RouteMode }> = [];
  for (const origin of spots) for (const destination of spots) {
    if (origin.id === destination.id) continue;
    for (const mode of requestedModes(preferences.transportPreference)) tasks.push({ origin, destination, mode });
  }
  if (preferences.startFromHotel) {
    const hotel = await resolveHotelSpot(preferences);
    for (const destination of spots) {
      for (const mode of requestedModes(preferences.transportPreference)) tasks.push({ origin: hotel, destination, mode });
    }
  }
  return mapRateLimited(tasks, async ({ origin, destination, mode }) => {
    try {
      return await fetchAmapRouteWithRetry(origin, destination, mode, preferences);
    } catch (error) {
      if (error instanceof AmapServiceError) throw error;
      return {
        originSpotId: origin.id,
        destinationSpotId: destination.id,
        mode,
        durationMinutes: null,
        distanceMeters: null,
        summary: mode === "driving" ? "高德未返回可用驾车方案" : "高德未返回可用公共交通方案",
        reachable: false,
        polyline: [],
        source: "amap-api",
      };
    }
  });
}

export function bestRoute(routes: RouteOption[], originId: string, destinationId: string): RouteOption | null {
  const candidates = routes.filter((route) => route.originSpotId === originId && route.destinationSpotId === destinationId && route.reachable && route.durationMinutes !== null);
  return candidates.sort((a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity))[0] ?? null;
}
