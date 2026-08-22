import "server-only";
import { getDemoSpots } from "@/lib/demo-data";
import { enrichScenicSpotImages } from "@/lib/services/scenic-images";
import type { ScenicSpot, ScenicSpotsResponse } from "@/lib/types";

class ProviderError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized || null;
}

export function truncateDescription(value: string | null, limit = 100): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const slice = normalized.slice(0, limit);
  const sentenceEnd = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("！"), slice.lastIndexOf("？"));
  return `${sentenceEnd >= Math.floor(limit * 0.6) ? slice.slice(0, sentenceEnd + 1) : slice}…`;
}

function isHttpsImageUrl(value: string, keyHint = ""): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    return /pic|image|img|url|src/i.test(keyHint) || /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url.href);
  } catch {
    return false;
  }
}

function collectImageUrls(value: unknown, output: Set<string>, keyHint = ""): void {
  if (typeof value === "string") {
    if (isHttpsImageUrl(value, keyHint)) output.add(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, output, keyHint);
    return;
  }
  const item = record(value);
  if (!item || Array.isArray(item.entityList)) return;
  for (const [key, child] of Object.entries(item)) collectImageUrls(child, output, key);
}

export function extractImageUrls(item: UnknownRecord): string[] {
  const urls = new Set<string>();
  collectImageUrls(item.priceList, urls, "priceList");
  collectImageUrls(item.picList, urls, "picList");
  return [...urls].slice(0, 2);
}

function activeTicketPrice(item: UnknownRecord, scenicName: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const containers = [item.priceList, item.picList];
  const candidates: Array<{ label: string; score: number }> = [];
  for (const container of containers) {
    if (!Array.isArray(container)) continue;
    for (const groupValue of container) {
      const group = record(groupValue);
      const entities = group && Array.isArray(group.entityList) ? group.entityList : [];
      for (const entityValue of entities) {
        const entity = record(entityValue);
        if (!entity) continue;
        const endDate = text(entity.EndDate);
        if (endDate && endDate < today) continue;
        const amount = text(entity.AmountAdvice) ?? text(entity.Amount);
        if (!amount) continue;
        const ticketName = text(entity.TicketName);
        if (ticketName && /酒店|住宿|客房|民宿|度假村.*房/.test(ticketName)) continue;
        const score = ticketName
          ? (ticketName.includes(scenicName) ? 10 : 0) + (/门票|成人票|儿童票|学生票|游船|索道|观光|演出/.test(ticketName) ? 5 : 0)
          : 1;
        if (score > 0) candidates.push({ label: ticketName ? `${ticketName} · ¥${amount}` : `参考票价 ¥${amount}`, score });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score)[0]?.label ?? null;
}

export function normalizeAliyunScenicResponse(payload: unknown): ScenicSpot[] {
  return normalizeAliyunScenicPage(payload).spots;
}

function normalizedPlace(value: string): string {
  return value.replace(/省|市|区|县|自治州|特别行政区|\s/g, "").toLowerCase();
}

function itemMatchesScope(item: UnknownRecord, destination: string, query: string): boolean {
  const name = text(item.name) ?? "";
  if (query && !normalizedPlace(name).includes(normalizedPlace(query))) return false;
  if (!query) return true;
  const scope = [item.cityName, item.areaName, item.proName, item.address]
    .map(text)
    .filter((value): value is string => Boolean(value))
    .map(normalizedPlace)
    .join(" ");
  const destinationKey = normalizedPlace(destination);
  return !destinationKey || scope.includes(destinationKey) || normalizedPlace(name).includes(destinationKey);
}

export function normalizeAliyunScenicPage(payload: unknown, destination = "", query = ""): ScenicSpotsResponse {
  const root = record(payload);
  const code = Number(root?.code);
  if (!root || code !== 200) {
    throw new ProviderError(text(root?.msg) ?? "阿里云景点服务返回失败", "ALIYUN_SCENIC_UPSTREAM_ERROR");
  }
  const data = record(root.data);
  const list = Array.isArray(data?.list) ? data.list : [];
  const spots: ScenicSpot[] = [];

  for (const value of list) {
    const item = record(value);
    const location = record(item?.location);
    const id = text(item?.id);
    const name = text(item?.name);
    const longitude = Number(location?.lon);
    const latitude = Number(location?.lat);
    if (!item || !id || !name || !Number.isFinite(longitude) || !Number.isFinite(latitude) || !itemMatchesScope(item, destination, query)) continue;
    const openingHours = text(item.opentime);
    const referencePrice = activeTicketPrice(item, name);
    const description = text(item.content) ?? text(item.summary);
    spots.push({
      id: `aliyun-${id}`,
      name,
      location: { longitude, latitude },
      description,
      shortDescription: truncateDescription(description),
      shortDescriptionSource: description ? "provider-truncated" : "missing",
      address: text(item.address),
      images: extractImageUrls(item),
      openingHours,
      openingHoursStatus: openingHours ? "available" : "missing",
      referencePrice,
      priceStatus: referencePrice ? "uncertain" : "missing",
      category: text(item.star) ? `${text(item.star)}景点` : "目的地景点",
      visual: name.slice(0, 1),
      source: "aliyun-scenic-api",
    });
  }
  const totalItems = Math.max(0, Number(data?.allNum) || spots.length);
  const pageSize = Math.max(1, Number(data?.maxResult) || 20);
  const currentPage = Math.max(1, Number(data?.currentPage) || 1);
  const totalPages = Math.max(1, Number(data?.allPages) || Math.ceil(totalItems / pageSize));
  return {
    spots,
    pagination: { currentPage, totalPages, totalItems, pageSize },
    dataSources: { scenic: "live" },
    fallbackNotices: [],
  };
}

async function fetchAliyunScenicPage(destination: string, query: string, page: number): Promise<ScenicSpotsResponse> {
  const appCode = process.env.ALIYUN_SCENIC_API_APPCODE;
  if (!appCode) throw new ProviderError("缺少 ALIYUN_SCENIC_API_APPCODE", "ALIYUN_SCENIC_APPCODE_MISSING");
  const host = (process.env.ALIYUN_SCENIC_API_HOST ?? "https://jmqgjdcx.market.alicloudapi.com").replace(/\/$/, "");
  const path = process.env.ALIYUN_SCENIC_API_PATH ?? "/area/scenic-spots";
  const requestPage = async (requestedPage: number) => {
    const body = new URLSearchParams({ keyword: (query || destination).trim(), page: String(requestedPage) });
    const response = await fetch(`${host}${path}`, {
      method: "POST",
      headers: {
        Authorization: `APPCODE ${appCode}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new ProviderError(`阿里云景点服务返回 HTTP ${response.status}`, "ALIYUN_SCENIC_HTTP_ERROR");
    return normalizeAliyunScenicPage(await response.json(), destination, query);
  };

  let result = await requestPage(page);
  if (!query || result.spots.length >= 8) return result;

  const spots = [...result.spots];
  let currentPage = result.pagination.currentPage;
  while (spots.length < 8 && currentPage < result.pagination.totalPages && currentPage < page + 2) {
    currentPage += 1;
    const next = await requestPage(currentPage);
    for (const spot of next.spots) if (!spots.some((item) => item.id === spot.id)) spots.push(spot);
    result = next;
  }
  return { ...result, spots, pagination: { ...result.pagination, currentPage } };
}

export async function searchScenicSpots(destination: string, query = "", page = 1): Promise<ScenicSpotsResponse> {
  const mode = process.env.APP_DATA_MODE ?? "demo";
  const allDemoSpots = getDemoSpots(destination).filter((spot) => !query || spot.name.includes(query));
  const demoSpots = allDemoSpots.slice((page - 1) * 20, page * 20);
  const demoPagination = {
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(allDemoSpots.length / 20)),
    totalItems: allDemoSpots.length,
    pageSize: 20,
  };

  if (mode === "demo") {
    return {
      spots: demoSpots,
      pagination: demoPagination,
      dataSources: { scenic: "demo" },
      fallbackNotices: ["当前为演示模式，景点信息仅用于体验页面流程。"],
    };
  }

  try {
    const result = await fetchAliyunScenicPage(destination, query, page);
    return { ...result, spots: await enrichScenicSpotImages(result.spots, destination) };
  } catch (error) {
    const allowFallback = process.env.ALLOW_DEMO_FALLBACK === "true";
    if (!allowFallback || demoSpots.length === 0) throw error;
    return {
      spots: demoSpots,
      pagination: demoPagination,
      dataSources: { scenic: "fallback" },
      fallbackNotices: [error instanceof Error ? `景点服务已回退为演示数据：${error.message}` : "景点服务已回退为演示数据。"],
    };
  }
}
