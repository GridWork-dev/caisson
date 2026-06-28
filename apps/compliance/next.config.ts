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
};

export default config;
