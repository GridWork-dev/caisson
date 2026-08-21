# apps/demos — the interactive demo surface (ADR-0400): the poke components and the packages that
# drive them, split out of apps/site so a package change stops rebuilding the revenue site. Bun
# multi-stage build trimmed from apps/site/Dockerfile: a build stage installs the WHOLE workspace
# and runs `next build` (output: 'standalone' traces the minimal node_modules subset into
# .next/standalone — the runtime stage needs ONLY that tree plus the static assets and public/).
#
# BUILD CONTEXT = the REPO ROOT, not apps/demos: bun.lock references every workspace member, so a
# partial copy fails --frozen-lockfile. On Railway set the service Root Directory = repo root (`/`)
# and Dockerfile Path = apps/demos/Dockerfile (same convention as apps/site/railway.toml).
#
# No NEXT_PUBLIC_* build ARGs: this app reads no environment at build time and calls no third
# party. Every poke runs entirely in the browser against in-page sample data — the CSP in
# next.config.ts pins that (`connect-src 'self'`), so there is nothing to configure per-service.
FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

RUN bunx turbo run build --filter=@caisson/demos --concurrency=50%

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS runtime
WORKDIR /app
# HOSTNAME is load-bearing: Next's standalone server.js binds to process.env.HOSTNAME, while Docker
# otherwise injects the container id. 0.0.0.0 is portable across Cloud Run and ordinary container
# runtimes and keeps the loopback healthcheck reachable.
ENV NODE_ENV=production \
    PORT=3040 \
    HOSTNAME=0.0.0.0

# output:'standalone' preserves the monorepo-relative path (server.js lands at apps/demos/server.js,
# NOT flattened to the image root), so the copies below mirror apps/site's exactly.
COPY --from=build /app/apps/demos/.next/standalone ./
COPY --from=build /app/apps/demos/.next/static ./apps/demos/.next/static
COPY --from=build /app/apps/demos/public ./apps/demos/public

# Non-root: the standalone server never writes to disk at runtime, so the root-owned,
# world-readable copies above need no chown. `bun` (uid/gid 1000) is the oven/bun base image's
# baked-in non-root user.
USER bun

EXPOSE 3040
# /demos/healthz, not /healthz: next.config.ts sets `basePath: "/demos"`, which prefixes every
# route in this app — see the basePath comment there.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3040)+'/demos/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/demos/server.js"]
