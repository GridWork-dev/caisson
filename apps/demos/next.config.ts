import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The monorepo root (two levels up from apps/demos) — pinned explicitly because Turbopack's
// auto-detected workspace root walks up to the FIRST ancestor carrying a lockfile, which
// silently picks the wrong root when this checkout lives nested inside another lockfile-bearing
// ancestor (a gtr/git worktree under a parent checkout) — same fix apps/site carries
// (vercel/next.js#92978).
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const config: NextConfig = {
  // Static export (ADR-0428 L11): every embed prerenders to apps/demos/out, which the site build
  // copies to apps/site/out/demos so one static Worker serves both. `basePath` prefixes the routes
  // AND the `_next/*` asset URLs with /demos, so the copied tree resolves unchanged under the site.
  // Response headers ship from apps/site/public/_headers (the /demos/* block carries this app's
  // CSP, pinned by lib/security-headers.test.ts) — a static export has no server to emit them.
  output: "export",
  basePath: "/demos",
  reactStrictMode: true,
  images: { unoptimized: true },
  // @caisson-sh/ui ships raw TS (its "./components" export points straight at src/) so Next has to
  // transpile it — same entry apps/site carries. Every other package a poke drives resolves
  // through its built `dist` entry, so nothing else belongs on this list.
  transpilePackages: ["@caisson-sh/ui"],
  turbopack: { root: monorepoRoot },
};

export default config;
