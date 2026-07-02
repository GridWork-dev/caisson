import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM Postgres + top-level await; keep it a runtime-external Node module rather
  // than bundling the WASM into the route. The @caisson/* workspace packages resolve to their built
  // dist (proper `default` export condition) — no transpile needed.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Security-floor response headers (identity/security.md), same values as apps/site/next.config.ts —
  // this composition root is a served surface and carries no documented embedding feature.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ];
  },
};

export default config;
