import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export → Cloudflare Pages direct-upload (ADR-0045). No adapter; `out/` ships as-is.
  output: "export",
  reactStrictMode: true,
  // Required under `output: 'export'` the moment a next/image appears (OG image, etc.).
  images: { unoptimized: true },
  // @caisson/ui ships raw TS (exports point at src/*.ts); Next transpiles it (ADR-0042 token floor).
  transpilePackages: ["@caisson/ui"],
};

const withMDX = createMDX();

export default withMDX(config);
