# services/docs — cloud-runner image (ADR-0096, P6). The image build produces a versioned,
# checksummed bun:sqlite FTS5 artifact from the authoritative docs, then upgrades it to an ephemeral
# sqlite-vec index when a runtime embedder is armed. Inbound: GET /health · /llms.txt · /llms-full.txt
# (public) + POST /query (Bearer
# DOCS_SERVICE_TOKEN, fail-closed). Target: Railway (ADR-0105), operator-gated at DEPLOY.
#
# BUILD CONTEXT = the REPO ROOT, not services/docs: buildCorpus() reads apps/site/content/docs/**.mdx
# + packages/*/README.md and resolves the monorepo root via the root package.json `workspaces`. On
# Railway set the service Root Directory = repo root (`/`) and Dockerfile Path = services/docs/Dockerfile.
#
# NOT YET BUILD-VALIDATED in this session (no docker build run) — first `railway up` is the validation.
FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS base
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8788

# Whole-workspace install: bun.lock references every workspace member, so a partial copy fails
# `--frozen-lockfile`. .dockerignore (repo root) keeps node_modules/.git/.turbo out of the context.
# bun resolves @caisson/* workspace deps to their src via each package's `bun` export condition (no
# prebuild step) — services/docs `start` runs TS directly.
COPY . .
RUN bun install --frozen-lockfile
RUN bun services/docs/src/build-artifact.ts

# The artifact is image-local and immutable; runtime needs no writable volume or root handoff.
USER bun

# DOCS_SERVICE_TOKEN is injected by the platform secret store at run time (server.ts refuses to start
# without it). OPENROUTER_API_KEY is optional at runtime: when present, the verified artifact's chunk
# set is rebuilt at the live embedder's dimension; the image build stays deterministic and secret-free.
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8788)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# cwd = /app → findRepoRoot resolves /app immediately (root package.json has `workspaces`).
CMD ["bun", "services/docs/src/server.ts"]
