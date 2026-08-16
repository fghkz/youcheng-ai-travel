import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/amap-js-proxy/[...path]/route";

const originalSecurityCode = process.env.AMAP_JS_SECURITY_CODE;
const originalWebServiceKey = process.env.AMAP_API_KEY;

afterEach(() => {
  process.env.AMAP_JS_SECURITY_CODE = originalSecurityCode;
  process.env.AMAP_API_KEY = originalWebServiceKey;
  vi.unstubAllGlobals();
});

describe("AMap JS API security proxy", () => {
  it("rejects requests while the server-side security code is missing", async () => {
    delete process.env.AMAP_JS_SECURITY_CODE;
    process.env.AMAP_API_KEY = "web-service-key";
    const response = await GET(new Request("http://localhost/_AMapService/v3/geocode/regeo?location=120,30"), {
      params: Promise.resolve({ path: ["v3", "geocode", "regeo"] }),
    });
    expect(response.status).toBe(503);
  });

  it("rejects requests while the server-side Web service key is missing", async () => {
    process.env.AMAP_JS_SECURITY_CODE = "server-secret";
    delete process.env.AMAP_API_KEY;
    const response = await GET(new Request("http://localhost/_AMapService/v3/geocode/regeo?location=120,30"), {
      params: Promise.resolve({ path: ["v3", "geocode", "regeo"] }),
    });
    expect(response.status).toBe(503);
  });

  it("forwards allowed paths and replaces browser credentials with server-side credentials", async () => {
    process.env.AMAP_JS_SECURITY_CODE = "server-secret";
    process.env.AMAP_API_KEY = "web-service-key";
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe("https://restapi.amap.com/v3/geocode/regeo");
      expect(url.searchParams.get("location")).toBe("120,30");
      expect(url.searchParams.get("key")).toBe("web-service-key");
      expect(url.searchParams.get("jscode")).toBe("server-secret");
      expect(url.search).not.toContain("browser-key");
      expect(url.search).not.toContain("browser-security-code");
      return new Response(JSON.stringify({ status: "1", info: "OK" }), { headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/_AMapService/v3/geocode/regeo?location=120,30&key=browser-key&jscode=browser-security-code"), {
      params: Promise.resolve({ path: ["v3", "geocode", "regeo"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
