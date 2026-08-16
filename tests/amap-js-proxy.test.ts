import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/amap-js-proxy/[...path]/route";

const originalSecurityCode = process.env.AMAP_JS_SECURITY_CODE;

afterEach(() => {
  process.env.AMAP_JS_SECURITY_CODE = originalSecurityCode;
  vi.unstubAllGlobals();
});

describe("AMap JS API security proxy", () => {
  it("rejects requests while the server-side security code is missing", async () => {
    delete process.env.AMAP_JS_SECURITY_CODE;
    const response = await GET(new Request("http://localhost/_AMapService/v3/geocode/regeo?location=120,30"), {
      params: Promise.resolve({ path: ["v3", "geocode", "regeo"] }),
    });
    expect(response.status).toBe(503);
  });

  it("forwards allowed paths and injects the security code server-side", async () => {
    process.env.AMAP_JS_SECURITY_CODE = "server-secret";
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      expect(url).toContain("https://restapi.amap.com/v3/geocode/regeo");
      expect(url).toContain("jscode=server-secret");
      return new Response(JSON.stringify({ status: "1", info: "OK" }), { headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/_AMapService/v3/geocode/regeo?location=120,30"), {
      params: Promise.resolve({ path: ["v3", "geocode", "regeo"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
