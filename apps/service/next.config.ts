import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Bundle the Drizzle migration files into the standalone output so migrate()
  // can find them at runtime (they are read from `<cwd>/drizzle` on boot).
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1tb",
    },
  },
};

export default nextConfig;
