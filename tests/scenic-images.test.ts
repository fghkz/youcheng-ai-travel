import { afterEach, describe, expect, it, vi } from "vitest";
import { clearScenicImageMemoryCacheForTests, enrichScenicSpotImages, fetchAmapScenicImages, normalizeScenicName, selectBestAmapPoi } from "@/lib/services/scenic-images";
import type { ScenicSpot } from "@/lib/types";

const westLake: ScenicSpot = {
  id: "aliyun-west-lake",
  name: "杭州西湖",
  location: { longitude: 120.163663, latitude: 30.264904 },
  description: null,
  shortDescription: null,
  shortDescriptionSource: "missing",
  address: null,
  images: [],
  openingHours: null,
  openingHoursStatus: "missing",
  referencePrice: null,
  priceStatus: "missing",
  category: "目的地景点",
  visual: "杭",
  source: "aliyun-scenic-api",
};

const photo = (url: string) => ({ url });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  clearScenicImageMemoryCacheForTests();
});

describe("scenic image enrichment", () => {
  it("normalizes common scenic suffixes", () => {
    expect(normalizeScenicName("杭州西湖风景名胜区")).toBe("杭州西湖");
  });

  it("prefers a matching scenic POI over nearby hotels", () => {
    const result = selectBestAmapPoi(westLake, [
      { id: "hotel", name: "杭州西湖假日酒店", type: "住宿服务;宾馆酒店", location: "120.16,30.26", photos: [photo("https://img.example/hotel.jpg")] },
      { id: "scenic", name: "杭州西湖风景名胜区", type: "风景名胜;风景名胜;国家级景点", location: "120.121358,30.222692", photos: [photo("https://img.example/west-lake.jpg")] },
    ]);
    expect(result).toEqual({ id: "scenic", name: "杭州西湖风景名胜区", images: ["https://img.example/west-lake.jpg"] });
  });

  it("matches reordered destination names when coordinates remain nearby", () => {
    const result = selectBestAmapPoi({ ...westLake, name: "杭州大运河" }, [
      { id: "canal", name: "京杭大运河杭州景区", type: "风景名胜", location: "120.141908,30.302955", photos: [photo("https://img.example/canal.jpg")] },
    ], "杭州");
    expect(result?.id).toBe("canal");
  });
  it("rejects unrelated or unsafe image candidates", () => {
    const result = selectBestAmapPoi(westLake, [
      { id: "unrelated", name: "西溪国家湿地公园", type: "风景名胜", location: "120.06,30.25", photos: [photo("https://img.example/xixi.jpg")] },
      { id: "unsafe", name: "杭州西湖风景名胜区", type: "风景名胜", location: "120.12,30.22", photos: [photo("http://img.example/west-lake.jpg")] },
    ]);
    expect(result).toBeNull();
  });

  it("falls back to an untyped POI search for temples", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "1", info: "OK", pois: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "1", info: "OK", pois: [{ id: "temple", name: "杭州西湖风景名胜区-敕建净慈禅寺", type: "风景名胜;寺庙道观", location: "120.149165,30.228643", photos: [photo("https://img.example/temple.jpg")] }],
      }), { status: 200 }));

    const result = await fetchAmapScenicImages({ ...westLake, name: "杭州净慈寺" }, "杭州", "test-key");

    expect(result?.id).toBe("temple");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("types=");
  });
  it("fills only missing images and reuses the memory cache", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "1",
      info: "OK",
      pois: [{ id: "scenic", name: "杭州西湖风景名胜区", type: "风景名胜", location: "120.121358,30.222692", photos: [photo("https://img.example/west-lake.jpg")] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const first = await enrichScenicSpotImages([westLake], "杭州");
    const second = await enrichScenicSpotImages([westLake], "杭州");

    expect(first[0].images).toEqual(["https://img.example/west-lake.jpg"]);
    expect(second[0].images).toEqual(["https://img.example/west-lake.jpg"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("types=110000");
    expect(String(fetchMock.mock.calls[0][0])).toContain("citylimit=true");
  });
});
