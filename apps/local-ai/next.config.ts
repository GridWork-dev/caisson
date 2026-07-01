import type { NextConfig } from "next";

// The edition packages run on bun:sqlite + the native sqlite-vec extension — Node.js/Bun built-ins the
// Next bundler must NOT try to bundle. `serverExternalPackages` keeps them external (required at
// runtime), so the bundler never traces into `bun:sqlite` / the native binding. The app imports the
// edition only through `@caisson/local-ai`; the rest are listed for transitive safety. ADR-0044 keeps
// the `@caisson/*` packages framework-free — this app is the only Next.js surface.
const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@caisson/local-ai",
    "@caisson/local-store",
    "@caisson/field-crypto",
    "@caisson/license-verify",
    "@caisson/kernel",
    "sqlite-vec",
  ],
  // Security-floor response headers (identity/security.md), same values as apps/site/next.config.ts —
  // this composition root is a served surface and carries no documented embedding feature.
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
