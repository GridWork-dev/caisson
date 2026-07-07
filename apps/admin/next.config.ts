import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The monorepo root (two levels up from apps/admin) — pinned explicitly because Turbopack's
// auto-detected workspace root walks up to the FIRST ancestor carrying a lockfile, which
// silently picks the wrong root when this checkout lives nested inside another lockfile-bearing
// ancestor (a gtr/git worktree under a parent checkout) — same fix apps/site carries
// (vercel/next.js#92978).
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const config: NextConfig = {
  // Node standalone server on Railway (ADR-0114/0138) — admin.caisson.sh is its own service.
  output: "standalone",
  reactStrictMode: true,
  images: { unoptimized: true },
  // @caisson/ui ships raw TS (exports point at src/*.ts); Next transpiles it (ADR-0042 token floor).
  // The catalog page (apps/admin/src/app/catalog/components) renders live demos from the shared
  // demo registry, which in turn imports ui-pro + every per-package `./ui` surface it demos —
  // those ship raw TSX too and need the same transpile treatment to reach the client bundle.
  transpilePackages: [
    "@caisson/ui",
    "@caisson/brand",
    "@caisson/ui-pro",
    "@caisson/demo-registry",
    "@caisson/audit-worm",
    "@caisson/license-issue",
    "@caisson/local-store",
    "@caisson/prompt-registry",
    "@caisson/ai-meter",
    "@caisson/audit-harness",
  ],
  turbopack: { root: monorepoRoot },
  // Security-floor response headers (identity/security.md), same values as apps/site/next.config.ts —
  // admin.caisson.sh is a LIVE served surface and carries no documented embedding feature.
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
