import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "1tb",
    },
  },
};

export default nextConfig;
