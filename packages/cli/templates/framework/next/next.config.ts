import type { NextConfig } from "next";

const config: NextConfig = {
  // Default server output: `next start` serves it directly — the same command the shared
  // `--deploy <target>` Dockerfile's CMD runs, so the two templates compose with zero extra
  // wiring. (Swap to `output: "standalone"` + `node server.js` yourself for a slimmer image —
  // that pairs with a different Dockerfile CMD than the shared one this generator ships.)
  reactStrictMode: true,
  // The security-response floor: nosniff, deny framing, HSTS, a conservative referrer + permissions
  // policy. Extend/relax per route as your app grows (e.g. embedding needs its own X-Frame-Options).
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
