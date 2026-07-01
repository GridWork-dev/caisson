# apps/site — the unified Next 16 App Router app (ADR-0114): marketing + docs (static) + the
# authed /dashboard route group (dynamic, tenant-scoped via withTenant). Bun multi-stage build
# mirroring services/docs/Dockerfile: a build stage installs the WHOLE workspace + runs
# `next build` (output: 'standalone' traces the minimal node_modules subset into
# .next/standalone — the runtime stage needs ONLY that tree + the static assets + public/, never
# the full workspace install).
#
# BUILD CONTEXT = the REPO ROOT, not apps/site: bun.lock references every workspace member, so a
# partial copy fails --frozen-lockfile. On Railway set the service Root Directory = repo root (`/`)
# and Dockerfile Path = apps/site/Dockerfile (same convention as services/docs/railway.toml).
#
# VERIFIED this session: `bunx turbo run build --filter=@caisson/site` (which builds every
# workspace dependency first, turbo.json's `dependsOn: ["^build"]`) succeeds, and the resulting
# `.next/standalone/apps/site/server.js` serves 200s on `/`, `/pricing`, `/healthz` under plain
# `bun apps/site/server.js` — the exact CMD below.
FROM oven/bun:1.3.14-slim AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time by `next build` — runtime-only
# service vars never reach the already-inlined bundle. Railway forwards service variables of the
# same name to the Dockerfile builder as build ARGs, so declaring them here + promoting to ENV is
# what actually bakes the Paddle client token / env and the Plausible domain into the client.
# Empty defaults keep a bare `docker build` (no --build-arg) working — Paddle/Plausible just no-op.
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=""
ARG NEXT_PUBLIC_PADDLE_ENV="sandbox"
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN

RUN bunx turbo run build --filter=@caisson/site --concurrency=50%

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3030

# output:'standalone' traces the minimal node_modules subset the server actually needs into
# .next/standalone, preserving the monorepo-relative path (server.js lands at apps/site/server.js,
# NOT flattened to the image root) — the runtime image copies ONLY that tree + the static assets +
# public/, never bun.lock or devDependencies or sibling workspace packages' source.
COPY --from=build /app/apps/site/.next/standalone ./
COPY --from=build /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=build /app/apps/site/public ./apps/site/public

EXPOSE 3030
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/site/server.js"]
