# apps/admin — the operator control-plane (admin.caisson.sh, ADR-0138): ops/observability +
# business-admin reads + the absorbed design studio + a live architecture diagram + the SOT board.
# Bun multi-stage build mirroring apps/site/Dockerfile: a build stage installs the WHOLE workspace
# + runs `next build` (output: 'standalone' traces the minimal node_modules subset into
# .next/standalone — the runtime stage needs ONLY that tree + the static assets).
#
# BUILD CONTEXT = the REPO ROOT, not apps/admin: bun.lock references every workspace member, so a
# partial copy fails --frozen-lockfile. On Railway set the service Root Directory = repo root (`/`)
# and Dockerfile Path = apps/admin/Dockerfile (same convention as apps/site/railway.toml).
FROM oven/bun:1.3.14-slim AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bunx turbo run build --filter=@caisson/admin --concurrency=50%

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3020

# output:'standalone' traces the minimal node_modules subset the server needs into .next/standalone,
# preserving the monorepo-relative path (server.js lands at apps/admin/server.js, NOT flattened to
# the image root) — the runtime image copies ONLY that tree + the static assets. admin ships no
# public/ dir (the theme-init is the kit's inline script, not a public asset), so no public COPY.
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static

# ADR-0278 F1: the comp-grant boundary reads the built registry index at runtime
# (loadRegistryIndexFromFile, apps/admin/src/lib/admin-mutations-runtime.ts) via a plain
# node:fs read of a repo-root-relative path — NOT a JS import, so Next's standalone output-file
# tracer never picks it up. Copied explicitly (same file services/license/Dockerfile's
# whole-repo-context build already bakes in for /issue's own pre-sign validation).
COPY --from=build /app/registry/index.json ./registry/index.json

# Non-root: the standalone server never writes to disk at runtime (no ISR/revalidate — see
# next.config.ts), so the root-owned, world-readable copies above need no chown. `bun` (uid/gid
# 1000) is the oven/bun base image's baked-in non-root user.
USER bun

EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3020)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/admin/server.js"]
