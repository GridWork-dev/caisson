import type { NextConfig } from "next";

const config: NextConfig = {
  // @caisson/ui ships raw TS (exports point at src/*.ts); Next transpiles it.
  transpilePackages: ["@caisson/ui"],
  reactStrictMode: true,
};

export default config;
