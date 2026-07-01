# services/license — cloud-runner image (ADR-0110/0113/0139, Stage-2). Bun service: the Ed25519
# offline-license ISSUER + Paddle Merchant-of-Record billing webhook. Boots deps ONCE, serves the
# router over Bun.serve, FAILS CLOSED before binding (missing LICENSE_ISSUE_TOKEN / signing key /
# DATABASE_URL). Inbound: GET /health (public) + POST /issue (Bearer LICENSE_ISSUE_TOKEN) + POST
# /webhook (Paddle-Signature HMAC). Target: Railway, operator-gated at DEPLOY.
#
# BUILD CONTEXT = the REPO ROOT, not services/license: server.ts loads registry/index.json via
# ../../../registry/index.json and bun.lock references every workspace member, so a partial copy
# fails --frozen-lockfile AND the registry load. On Railway set the service Root Directory = repo
# root (`/`) and Dockerfile Path = services/license/Dockerfile (same convention as services/docs).
#
# NOT YET BUILD-VALIDATED in this session (no docker build run) — first `railway up` is the validation.
FROM oven/bun:1.3.14-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8789

# Whole-workspace install: bun.lock references every workspace member, so a partial copy fails
# `--frozen-lockfile`. .dockerignore (repo root) keeps node_modules/.git/.turbo out of the context.
# bun resolves @caisson/* workspace deps to their src via each package's `bun` export condition (no
# prebuild step) — the deploy entrypoint runs TS directly. The full install is also what lets the
# railway.toml preDeployCommand run the site's migrate orchestrator (it needs pg + better-auth +
# @caisson/migrate, all present here but absent from the site's traced standalone image).
COPY . .
RUN bun install --frozen-lockfile

# DATABASE_URL, CAISSON_LICENSE_SIGNING_KEY, LICENSE_ISSUE_TOKEN, PADDLE_WEBHOOK_SECRET are injected
# by the platform secret store at run time (deploy.ts / server.ts refuse to start without them).
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8789)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# NOT src/server.ts — its import.meta.main throws by design. deploy.ts injects the Postgres Transactor.
# cwd = /app → defaultIndexPath resolves /app/registry/index.json (present in the repo-root context).
CMD ["bun", "services/license/src/deploy.ts"]
