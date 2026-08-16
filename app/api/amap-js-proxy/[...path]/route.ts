import "server-only";

const ALLOWED_PATH = /^(?:v3|v4|v5)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/u;

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const securityCode = process.env.AMAP_JS_SECURITY_CODE;
  const webServiceKey = process.env.AMAP_API_KEY;
  if (!securityCode || !webServiceKey) {
    return Response.json({ status: "0", info: "高德地图服务端凭证未配置完整" }, { status: 503 });
  }

  const { path } = await context.params;
  const joinedPath = path.join("/");
  if (!ALLOWED_PATH.test(joinedPath)) return Response.json({ status: "0", info: "不允许的高德代理路径" }, { status: 400 });

  const incoming = new URL(request.url);
  const upstream = new URL(`https://restapi.amap.com/${joinedPath}`);
  incoming.searchParams.forEach((value, key) => {
    if (!new Set(["key", "jscode", "platform", "s"]).has(key)) {
      upstream.searchParams.append(key, value);
    }
  });
  upstream.searchParams.set("key", webServiceKey);
  upstream.searchParams.set("jscode", securityCode);

  try {
    const response = await fetch(upstream, {
      headers: { Accept: request.headers.get("accept") ?? "application/json,text/plain,*/*" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ status: "0", info: "高德地图代理请求失败" }, { status: 502 });
  }
}
