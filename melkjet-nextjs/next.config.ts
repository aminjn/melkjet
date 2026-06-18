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
        // API routes (auth/session/data) — NEVER cache or store at the edge.
        // `no-cache` alone lets some CDNs (Arvan) treat the response as
        // cacheable-with-revalidation and STRIP Set-Cookie, which silently
        // breaks login (the cookie never reaches the browser → user is logged
        // out again on refresh). `no-store, private` tells every cache to keep
        // its hands off, so Set-Cookie survives and session checks aren't stale.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private" }],
      },
      {
        // everything else (HTML pages, etc.) — always revalidate so a new
        // deploy is picked up immediately instead of serving stale markup
        source: "/((?!_next/static|api/).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
