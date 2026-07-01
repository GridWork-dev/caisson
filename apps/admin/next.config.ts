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
  transpilePackages: ["@caisson/ui"],
  turbopack: { root: monorepoRoot },
};

export default config;
