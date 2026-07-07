# services/intel — the standing operator intelligence daemon (ADR-0286). Bun service: an internal
# scheduler runs each watcher leg (compliance, SOC 2, competitor, GitHub, analytics, error triage)
# on its own cadence, pushing durable findings to a dedicated Postgres schema. No inbound API
# beyond a loopback health check — everything else it does is outbound.
#
# BUILD CONTEXT = the REPO ROOT, not services/intel: bun resolves @caisson/* workspace deps via
# each package's `bun` export condition, which needs the whole workspace installed. On the deploy
# host set the container build context / Root Directory = repo root and the Dockerfile path =
# services/intel/Dockerfile (the same convention services/docs and services/license use).
#
# NOT YET BUILD-VALIDATED against a live INTEL_DATABASE_URL in this session — the migration path
# and every watcher's live fetch are exercised by fixture tests + self-skipping `live/` tests only.
FROM oven/bun:1.3.14-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    INTEL_HEALTHZ_PORT=8791

# Whole-workspace install: bun.lock references every workspace member, so a partial copy fails
# --frozen-lockfile. .dockerignore (repo root) keeps node_modules/.git/.turbo and every .env out
# of the build context.
COPY . .
RUN bun install --frozen-lockfile

# Non-root: the daemon never writes to disk beyond its own process memory — every persisted byte
# goes to INTEL_DATABASE_URL over the network. `bun` (uid/gid 1000) is the oven/bun base image's
# baked-in non-root user.
USER bun

# INTEL_DATABASE_URL is required (server.ts refuses to start without it) — injected by the host's
# secret store at run time, never baked into the image. See README.md for the full env list.
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.INTEL_HEALTHZ_PORT||8791)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# cwd = /app → the workspace root package.json (`workspaces`) resolves immediately.
CMD ["bun", "services/intel/src/server.ts"]
