import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ScenicSpot } from "@/lib/types";

type AmapPhoto = { url?: unknown };
type AmapPoi = { id?: unknown; name?: unknown; location?: unknown; type?: unknown; photos?: unknown };
type AmapSearchResponse = { status?: string; info?: string; pois?: unknown };
type ImageCacheValue = {
  images: string[];
  matchedPoiId: string | null;
  matchedPoiName: string | null;
  expiresAt: number;
};

const memoryCache = new Map<string, ImageCacheValue>();
const CACHE_VERSION = "amap-poi-v3";
const POSITIVE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_IMAGES = 3;
const MAX_CONCURRENCY = 4;
const AMAP_REQUEST_INTERVAL_MS = 260;
let amapRequestQueue = Promise.resolve();
let nextAmapRequestAt = 0;

function cacheKey(spot: ScenicSpot) {
  return `${CACHE_VERSION}:${spot.source}:${spot.id}`;
}

function validImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeScenicName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[·•\s()（）【】\[\]《》“”'"，,。.!！?？\-—_]/g, "")
    .replace(/(?:风景名胜区|旅游度假区|旅游景区|国家森林公园|森林公园|湿地公园|国家公园|景区|景点|公园)$/u, "")
    .replace(/(?:特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市|区|县)$/u, "")
    .trim();
}

function bigrams(value: string): Set<string> {
  const output = new Set<string>();
  if (value.length < 2) {
    if (value) output.add(value);
    return output;
  }
  for (let index = 0; index < value.length - 1; index += 1) output.add(value.slice(index, index + 2));
  return output;
}

function longestCommonSubstring(left: string, right: string): number {
  const lengths = new Array(right.length + 1).fill(0) as number[];
  let longest = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = right.length; rightIndex >= 1; rightIndex -= 1) {
      lengths[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1] ? lengths[rightIndex - 1] + 1 : 0;
      longest = Math.max(longest, lengths[rightIndex]);
    }
  }
  return longest;
}

function nameSimilarity(left: string, right: string, destination = ""): number {
  const normalizedDestination = normalizeScenicName(destination);
  const variants = (value: string) => {
    const normalized = normalizeScenicName(value);
    const withoutDestination = normalizedDestination && normalized.startsWith(normalizedDestination)
      ? normalized.slice(normalizedDestination.length)
      : normalized;
    return [...new Set([normalized, withoutDestination].filter(Boolean))];
  };
  let best = 0;
  for (const a of variants(left)) {
    for (const b of variants(right)) {
      if (a === b) return 1;
      if (a.includes(b) || b.includes(a)) best = Math.max(best, Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.35 + 0.6);
      const aPairs = bigrams(a);
      const bPairs = bigrams(b);
      const intersection = [...aPairs].filter((item) => bPairs.has(item)).length;
      const union = new Set([...aPairs, ...bPairs]).size;
      if (union) best = Math.max(best, intersection / union);
      const commonLength = longestCommonSubstring(a, b);
      if (commonLength >= 2) best = Math.max(best, commonLength / Math.min(a.length, b.length) * 0.8);
    }
  }
  return best;
}
function coordinates(value: unknown): [number, number] | null {
  if (typeof value !== "string") return null;
  const [rawLongitude, rawLatitude] = value.split(",");
  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

function distanceKm(left: [number, number], right: [number, number]): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right[1] - left[1]);
  const longitudeDelta = radians(right[0] - left[0]);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left[1])) * Math.cos(radians(right[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function poiPhotos(poi: AmapPoi): string[] {
  if (!Array.isArray(poi.photos)) return [];
  const urls = new Set<string>();
  for (const photo of poi.photos) {
    const url = validImageUrl((photo as AmapPhoto | null)?.url);
    if (url) urls.add(url);
  }
  return [...urls].slice(0, MAX_IMAGES);
}

export function selectBestAmapPoi(spot: ScenicSpot, candidates: unknown[], destination = ""): { id: string | null; name: string; images: string[] } | null {
  const origin: [number, number] = [spot.location.longitude, spot.location.latitude];
  const ranked = candidates.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const poi = value as AmapPoi;
    const name = typeof poi.name === "string" ? poi.name.trim() : "";
    const images = poiPhotos(poi);
    const location = coordinates(poi.location);
    const similarity = nameSimilarity(spot.name, name, destination);
    if (!name || !images.length || similarity < 0.48) return [];
    const distance = location ? distanceKm(origin, location) : 25;
    if (distance > 50) return [];
    const scenicBonus = typeof poi.type === "string" && poi.type.includes("风景名胜") ? 0.12 : 0;
    return [{
      id: typeof poi.id === "string" ? poi.id : null,
      name,
      images,
      score: similarity + scenicBonus - Math.min(distance, 30) * 0.008,
    }];
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  return best && best.score >= 0.55 ? { id: best.id, name: best.name, images: best.images } : null;
}

async function waitForAmapRequestSlot() {
  const turn = amapRequestQueue.then(async () => {
    const waitMs = Math.max(0, nextAmapRequestAt - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextAmapRequestAt = Date.now() + AMAP_REQUEST_INTERVAL_MS;
  });
  amapRequestQueue = turn.catch(() => undefined);
  await turn;
}
export async function fetchAmapScenicImages(spot: ScenicSpot, destination: string, apiKey: string) {
  const upstream = new URL("https://restapi.amap.com/v3/place/text");
  upstream.searchParams.set("key", apiKey);
  upstream.searchParams.set("keywords", spot.name);
  upstream.searchParams.set("city", destination);
  upstream.searchParams.set("citylimit", "true");
  upstream.searchParams.set("offset", "10");
  upstream.searchParams.set("page", "1");
  upstream.searchParams.set("extensions", "all");
  upstream.searchParams.set("output", "json");
  const search = async (types?: string) => {
    if (types) upstream.searchParams.set("types", types);
    else upstream.searchParams.delete("types");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await waitForAmapRequestSlot();
      const response = await fetch(upstream, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
      const data = await response.json() as AmapSearchResponse;
      if (response.ok && data.status === "1" && Array.isArray(data.pois)) return selectBestAmapPoi(spot, data.pois, destination);
      const rateLimited = typeof data.info === "string" && /QPS|LIMIT|TOO_FAST/i.test(data.info);
      if (!rateLimited) return null;
    }
    return null;
  };
  return await search("110000") ?? await search();
}
async function readPersistentCache(spots: ScenicSpot[]): Promise<Map<string, ImageCacheValue>> {
  const result = new Map<string, ImageCacheValue>();
  const supabase = createAdminClient();
  if (!supabase || !spots.length) return result;
  const ids = [...new Set(spots.map((spot) => spot.id))];
  const providers = [...new Set(spots.map((spot) => spot.source))];
  try {
    const { data, error } = await supabase.from("scenic_image_cache")
      .select("provider,external_spot_id,match_version,images,matched_poi_id,matched_poi_name,expires_at")
      .eq("match_version", CACHE_VERSION).in("provider", providers).in("external_spot_id", ids);
    if (error) return result;
    for (const row of data ?? []) {
      if (!Array.isArray(row.images)) continue;
      const images = row.images.map(validImageUrl).filter((value): value is string => Boolean(value));
      result.set(`${row.match_version}:${row.provider}:${row.external_spot_id}`, {
        images,
        matchedPoiId: row.matched_poi_id,
        matchedPoiName: row.matched_poi_name,
        expiresAt: new Date(row.expires_at).getTime(),
      });
    }
  } catch {
    // Persistent cache is optional; provider lookup still works without it.
  }
  return result;
}

async function writePersistentCache(rows: Array<{ spot: ScenicSpot; destination: string; value: ImageCacheValue }>) {
  const supabase = createAdminClient();
  if (!supabase || !rows.length) return;
  const now = new Date().toISOString();
  try {
    await supabase.from("scenic_image_cache").upsert(rows.map(({ spot, destination, value }) => ({
      provider: spot.source,
      external_spot_id: spot.id,
      match_version: CACHE_VERSION,
      spot_name: spot.name,
      destination,
      images: value.images,
      matched_poi_id: value.matchedPoiId,
      matched_poi_name: value.matchedPoiName,
      expires_at: new Date(value.expiresAt).toISOString(),
      updated_at: now,
    })), { onConflict: "provider,external_spot_id,match_version" });
  } catch {
    // Cache writes must never make scenic search fail.
  }
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function enrichScenicSpotImages(spots: ScenicSpot[], destination: string): Promise<ScenicSpot[]> {
  const apiKey = process.env.AMAP_API_KEY;
  const missing = spots.filter((spot) => spot.images.length === 0);
  if (!apiKey || !missing.length) return spots;

  const now = Date.now();
  const persistent = await readPersistentCache(missing);
  for (const spot of missing) {
    const key = cacheKey(spot);
    const stored = persistent.get(key);
    if (stored) memoryCache.set(key, stored);
  }

  const updates = new Map<string, string[]>();
  const uncached: ScenicSpot[] = [];
  for (const spot of missing) {
    const cached = memoryCache.get(cacheKey(spot));
    if (cached && cached.expiresAt > now) updates.set(spot.id, cached.images);
    else uncached.push(spot);
  }

  const writes = await mapWithConcurrency(uncached, async (spot) => {
    let match: Awaited<ReturnType<typeof fetchAmapScenicImages>> = null;
    try {
      match = await fetchAmapScenicImages(spot, destination, apiKey);
    } catch {
      match = null;
    }
    const images = match?.images ?? [];
    const value: ImageCacheValue = {
      images,
      matchedPoiId: match?.id ?? null,
      matchedPoiName: match?.name ?? null,
      expiresAt: now + (images.length ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    };
    memoryCache.set(cacheKey(spot), value);
    updates.set(spot.id, images);
    return { spot, destination, value };
  });
  await writePersistentCache(writes);

  return spots.map((spot) => spot.images.length || !updates.has(spot.id)
    ? spot
    : { ...spot, images: updates.get(spot.id) ?? [] });
}

export function clearScenicImageMemoryCacheForTests() {
  memoryCache.clear();
}



