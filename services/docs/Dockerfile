# services/docs — cloud-runner image (ADR-0096, P6). Bun service: builds a chunked corpus + a
# bun:sqlite (FTS5 + sqlite-vec) index ONCE at boot from the repo's authoritative docs, then serves
# retrieval. Inbound: GET /health · /llms.txt · /llms-full.txt (public) + POST /query (Bearer
# DOCS_SERVICE_TOKEN, fail-closed). Target: Railway (ADR-0105), operator-gated at DEPLOY.
#
# BUILD CONTEXT = the REPO ROOT, not services/docs: buildCorpus() reads apps/site/content/docs/**.mdx
# + packages/*/README.md and resolves the monorepo root via the root package.json `workspaces`. On
# Railway set the service Root Directory = repo root (`/`) and Dockerfile Path = services/docs/Dockerfile.
#
# NOT YET BUILD-VALIDATED in this session (no docker build run) — first `railway up` is the validation.
FROM oven/bun:1.3.14-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8788

# Whole-workspace install: bun.lock references every workspace member, so a partial copy fails
# `--frozen-lockfile`. .dockerignore (repo root) keeps node_modules/.git/.turbo out of the context.
# bun resolves @caisson/* workspace deps to their src via each package's `bun` export condition (no
# prebuild step) — services/docs `start` runs TS directly.
COPY . .
RUN bun install --frozen-lockfile

# Non-root runtime via the entrypoint: the process runs as `bun` (uid/gid 1000, the oven/bun
# base image's baked-in non-root user), but the entrypoint starts as root exactly long enough
# to chown the Railway volume mount (attached ROOT-owned) so the embed cache
# (src/embed-cache.ts) can persist there, then drops privileges with setpriv. The index itself
# stays :memory: (LocalStore.open({ dim }) — no path); the volume holds only the embed cache.
RUN chmod +x services/docs/entrypoint.sh
ENTRYPOINT ["/app/services/docs/entrypoint.sh"]

# DOCS_SERVICE_TOKEN is injected by the platform secret store at run time (server.ts refuses to start
# without it). The real OpenRouter embedder (qwen3-embedding-8b) is a CODE-TRACK wire at
# services/docs/src/server.ts (DocsIndex.build 2nd arg); until it lands this serves the FTS5 floor.
EXPOSE 8788
# The healthcheck exec spawns as the image's default user (root now that the entrypoint owns the
# privilege drop) — drop it to bun the same way, so no periodic root-context process exists.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s \
  CMD setpriv --reuid=bun --regid=bun --init-groups bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# cwd = /app → findRepoRoot resolves /app immediately (root package.json has `workspaces`).
CMD ["bun", "services/docs/src/server.ts"]
