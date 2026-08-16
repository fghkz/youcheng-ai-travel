import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/_AMapService/:path*", destination: "/api/amap-js-proxy/:path*" }];
  },
};

export default nextConfig;
