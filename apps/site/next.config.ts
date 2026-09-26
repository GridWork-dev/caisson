import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

// The monorepo root (two levels up from apps/site) — pinned explicitly because Turbopack's
// auto-detected workspace root walks up to the FIRST ancestor directory carrying a lockfile,
// which silently picks the wrong root when this checkout itself lives nested inside another
// lockfile-bearing ancestor (e.g. a gtr/git worktree under a parent checkout's tree) — observed
// as "Module not found" for workspace packages whose symlinks live only under apps/site/
// node_modules, never hoisted to the misdetected root's node_modules (vercel/next.js#92978).
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const config: NextConfig = {
  // Keep static generation below the build host's memory ceiling. Next otherwise derives this
  // from host CPUs and can fan out dozens of workers for this documentation-heavy app.
  experimental: { cpus: 2 },
  // Static export (ADR-0428 L3): every route prerenders to apps/site/out, served as static assets
  // by one Cloudflare Worker. Redirects and response headers can't live here (a static export has
  // no server to run them): they ship as public/_redirects and public/_headers, which the Worker's
  // asset handler applies. lib/security-headers.test.ts pins _headers to the CSP builder.
  output: "export",
  reactStrictMode: true,
  // next/image's optimizer needs a server; a static export serves the source images as-is.
  images: { unoptimized: true },
  // @caisson-sh/ui ships raw TS (exports point at src/*.ts); Next transpiles it (ADR-0042 token floor).
  // @caisson-sh/ui-pro is the same raw-.tsx-plus-co-located-.css delivery — the /ui showcase renders it.
  // @caisson-sh/demo-registry (CAISSON-35, the /ui showcase's data source) is the same raw-source
  // delivery, and its module-scope CATALOG_ENTRIES unconditionally combines all three entry files
  // — including the five per-package `./ui` surfaces — so every package below needs to resolve
  // through this list too.
  transpilePackages: [
    "@caisson-sh/ui",
    "@caisson-sh/brand",
    "@caisson-sh/ui-pro",
    "@caisson-sh/demo-registry",
    "@caisson-sh/audit-worm",
    "@caisson-sh/local-store",
    "@caisson-sh/prompt-registry",
    "@caisson-sh/ai-meter",
    "@caisson-sh/audit-harness",
  ],
  turbopack: { root: monorepoRoot },
};

const withMDX = createMDX();

export default withMDX(config);
