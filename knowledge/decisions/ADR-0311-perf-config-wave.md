# ADR-0311 — Perf config wave: everything-measured scope

- **Status:** locked (operator pick, 2026-07-10 perf/mobile picker)
- **Context:** the site-wide perf sweep (`outputs/research/perf-mobile-research-2026-07-10.md`
  §2) produced seven evidence-verified config/route-level opportunities, independent of the
  component-level hydration work (ADR-0310). Fonts, PostHog scoping, and the three.js gating
  were verified already-optimal — no action.

## Decision

Ship the full measured set:

1. **`compress: false`** in `apps/site/next.config.ts` — the standalone origin stops
   pre-gzipping static assets so Cloudflare brotli-compresses them at the edge (HTML already
   serves `br`; ~1.7MB of cacheable JS+CSS currently pinned to gzip, ~15-18% transfer win).
   Post-deploy verify: a `/_next/static` asset returns `content-encoding: br` on a cache HIT.
2. **Inline `public/theme-init.js`** (727B) into the root layout `<head>` and delete the file —
   its render-blocking external request bought nothing (CSP still carries `unsafe-inline`).
3. **Delete the redundant `/_next/static` Cache-Control** entry from `headers()` — Next 16
   sets `public, max-age=31536000, immutable` natively (live-verified); silences the build
   warning.
4. **`prefetch={false}`** on the footer link clusters (~20 below-fold links per page firing
   `_rsc` prefetches on viewport entry; hover/click still prefetches).
5. **NFT trace fix (M):** pin `outputFileTracingRoot` + add `outputFileTracingExcludes` so the
   `next.config.ts → services/license/dist` dynamic-require bail stops tracing the whole
   monorepo into the 181MB standalone; re-measure the standalone size in the build log.
6. **`experimental.optimizePackageImports`** for `@caisson/ui` + `@caisson/demo-registry` —
   MEASURE-FIRST: record the homepage + `/ui` first-load JS before/after; keep only if the
   delta is real.

**Parked as a design-track row:** the 94KB shared design-system CSS audit (L effort,
`packages/ui` owned) — a named row in `docs/state/outstanding-work.md`, not this wave.

## Consequences

Wire-transfer and FCP wins on all routes plus a smaller Railway image; none of it moves the
homepage TBT (that is ADR-0310/0313). Every item verifies against the live origin or the
build log after the next deploy.
