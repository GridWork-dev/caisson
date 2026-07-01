import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The @caisson/* product packages are Node-side libraries (node:crypto/fs, PGlite WASM,
  // import.meta.url-relative migration reads). Keep them external so Next requires them from
  // node_modules at runtime instead of bundling — preserving their fs-relative paths and avoiding
  // a WASM bundle. The leg runs on the Node runtime only (the /api/leg route handler).
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@caisson/kernel",
    "@caisson/tenancy-rls",
    "@caisson/field-crypto",
    "@caisson/audit-worm",
    "@caisson/compliance",
  ],
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
