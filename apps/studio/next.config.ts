import type { NextConfig } from "next";

const config: NextConfig = {
  // @stack/ui ships raw TS (exports point at src/*.ts); Next transpiles it.
  transpilePackages: ["@stack/ui"],
  reactStrictMode: true,
};

export default config;
