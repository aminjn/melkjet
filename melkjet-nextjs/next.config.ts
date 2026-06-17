import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache headers to stop the CDN serving stale HTML after a new build (which
  // breaks all styling because it points at old, deleted CSS/JS chunks).
  async headers() {
    return [
      {
        // hashed, content-addressed assets — safe to cache forever
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // everything else (HTML pages, etc.) — always revalidate so a new
        // deploy is picked up immediately instead of serving stale markup
        source: "/((?!_next/static).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
