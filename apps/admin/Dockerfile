# apps/admin — the operator control-plane (admin.caisson.sh, ADR-0138): ops/observability +
# business-admin reads + the absorbed design studio + a live architecture diagram + the SOT board.
# Bun multi-stage build mirroring apps/site/Dockerfile: a build stage installs the WHOLE workspace
# + runs `next build` (output: 'standalone' traces the minimal node_modules subset into
# .next/standalone — the runtime stage needs ONLY that tree + the static assets).
#
# BUILD CONTEXT = the REPO ROOT, not apps/admin: bun.lock references every workspace member, so a
# partial copy fails --frozen-lockfile. On Railway set the service Root Directory = repo root (`/`)
# and Dockerfile Path = apps/admin/Dockerfile (same convention as apps/site/railway.toml).
FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bunx turbo run build --filter=@caisson/admin --concurrency=50%

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS runtime
WORKDIR /app
# HOSTNAME=0.0.0.0 is load-bearing: Next's standalone server.js binds to process.env.HOSTNAME, and
# Docker auto-sets HOSTNAME to the container id — so without this the server binds only to the
# container-hostname interface and Railway's edge gets a 502 (unlike docs/support-bot, which use
# Bun.serve and bind 0.0.0.0 by default). This is Next's own documented Docker requirement (mirrors
# apps/site/Dockerfile) — this exact gap took admin down in prod; the Railway env var has been
# restored live, but the image must carry it durably so a fresh deploy can't drop it again.
#
# CAISSON_REGISTRY_INDEX_PATH is likewise load-bearing, for a DIFFERENT reason (CR-01): Next's
# generated standalone server.js calls `process.chdir(__dirname)` on boot, so at runtime cwd is
# /app/apps/admin, NOT the /app WORKDIR set below. `registryIndex()`
# (apps/admin/src/lib/admin-mutations-runtime.ts) honors this env var FIRST, before falling back to
# a cwd-relative join — without it every comp-grant call would ENOENT on
# /app/apps/admin/registry/index.json (which does not exist) instead of finding the file this
# Dockerfile actually copies to /app/registry/index.json below.
ENV NODE_ENV=production \
    PORT=3020 \
    HOSTNAME=0.0.0.0 \
    CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json

# output:'standalone' traces the minimal node_modules subset the server needs into .next/standalone,
# preserving the monorepo-relative path (server.js lands at apps/admin/server.js, NOT flattened to
# the image root) — the runtime image copies ONLY that tree + the static assets. admin ships no
# public/ dir (the theme-init is the kit's inline script, not a public asset), so no public COPY.
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static

# ADR-0278 F1: the comp-grant boundary reads the built registry index at runtime
# (loadRegistryIndexFromFile, apps/admin/src/lib/admin-mutations-runtime.ts) via a plain
# node:fs read of a repo-root-relative path — NOT a JS import, so Next's standalone output-file
# tracer never picks it up. Copied explicitly to the SAME path CAISSON_REGISTRY_INDEX_PATH points
# at above. NOT the same mechanism services/license/Dockerfile relies on for /issue's own pre-sign
# validation — that service resolves the index via `import.meta.dir`-relative path math inside
# unbundled source (services/license/src/server.ts), which is cwd-independent by construction; this
# Next standalone server has no such module-relative anchor available at runtime, hence the explicit
# env var above rather than a computed path.
COPY --from=build /app/registry/index.json ./registry/index.json

# Non-root: the standalone server never writes to disk at runtime (no ISR/revalidate — see
# next.config.ts), so the root-owned, world-readable copies above need no chown. `bun` (uid/gid
# 1000) is the oven/bun base image's baked-in non-root user.
USER bun

EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3020)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/admin/server.js"]
