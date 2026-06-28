import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM Postgres + top-level await; keep it a runtime-external Node module rather
  // than bundling the WASM into the route. The @caisson/* workspace packages resolve to their built
  // dist (proper `default` export condition) — no transpile needed.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
