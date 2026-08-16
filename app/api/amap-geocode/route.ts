import "server-only";

export const dynamic = "force-dynamic";

type AmapResponse = {
  status?: string;
  info?: string;
  geocodes?: Array<{ location?: string }>;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      province?: string;
      city?: string | string[];
      district?: string;
    };
  };
};

function errorResponse(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

function parseLocation(value: string): [number, number] | null {
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return [longitude, latitude];
}

export async function GET(request: Request) {
  const apiKey = process.env.AMAP_API_KEY;
  if (!apiKey) return errorResponse("高德 Web 服务 Key 未配置", 503);

  const incoming = new URL(request.url);
  const address = incoming.searchParams.get("address")?.trim() ?? "";
  const rawLocation = incoming.searchParams.get("location")?.trim() ?? "";
  if (Boolean(address) === Boolean(rawLocation)) {
    return errorResponse("请仅提供地址或坐标中的一项");
  }
  if (address.length > 200) return errorResponse("搜索内容过长");

  const upstream = new URL(address
    ? "https://restapi.amap.com/v3/geocode/geo"
    : "https://restapi.amap.com/v3/geocode/regeo");
  upstream.searchParams.set("key", apiKey);
  upstream.searchParams.set("output", "json");

  if (address) {
    upstream.searchParams.set("address", address);
  } else {
    const location = parseLocation(rawLocation);
    if (!location) return errorResponse("坐标格式不正确");
    upstream.searchParams.set("location", `${location[0].toFixed(6)},${location[1].toFixed(6)}`);
    upstream.searchParams.set("radius", "1000");
    upstream.searchParams.set("extensions", "base");
  }

  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json() as AmapResponse;
    if (!response.ok || data.status !== "1" || data.info !== "OK") {
      return errorResponse(`高德地理编码失败：${data.info || response.status}`, 502);
    }

    if (address) {
      const location = parseLocation(data.geocodes?.[0]?.location ?? "");
      if (!location) return errorResponse("没有找到这个城市或地点", 404);
      return Response.json({
        ok: true,
        location: { longitude: location[0], latitude: location[1] },
      });
    }

    const component = data.regeocode?.addressComponent;
    if (!component) return errorResponse("未能识别该位置所在城市", 404);
    return Response.json({
      ok: true,
      formattedAddress: data.regeocode?.formatted_address ?? "",
      addressComponent: {
        province: component.province ?? "",
        city: component.city ?? "",
        district: component.district ?? "",
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "高德地理编码请求超时"
      : "高德地理编码服务暂时不可用";
    return errorResponse(message, 502);
  }
}
