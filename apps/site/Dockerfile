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
#
# The BUILD stage runs on Bun 1.4.2, deliberately ahead of the 1.3.14 that the runtime stage, the
# fleet's other Dockerfiles and the `packageManager` pin still use — the same split, for the same
# measured reason, as apps/demos/Dockerfile. Bun 1.3.14 segfaults at the end of every `next build`
# on Next >= 16.3 (Turbopack): next-swc's process-global threads release a napi threadsafe
# function after the page-data worker that created it was torn down (oven-sh/bun#37031, #36866 —
# `panic: Segmentation fault at address 0x13CB0` in napi_release_threadsafe_function, exit 137,
# after "Finalizing page optimization"). Fixed by oven-sh/bun#34067, first shipped in 1.4.0; there
# is no 1.3.x backport. Measured 2026-09-11: this Dockerfile at 1.3.14 crashes after generating all
# 243 pages, and changing ONLY this FROM line builds green with the same frozen bun.lock. The
# runtime stage stays on 1.3.14 so the serving runtime is unchanged; moving the whole fleet to
# 1.4.x is a separate decision.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS build
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
# The footer's Discord link (G12) renders at build time on every statically prerendered page —
# without this ARG the Railway service var never reaches `next build` and every static footer
# bakes with the link missing (only request-time-rendered pages saw it). Empty default = the
# same env-gated no-op as the rest.
ARG NEXT_PUBLIC_DISCORD_INVITE_URL=""
# Same class as the Discord ARG above: these service vars were set on caisson-site but never
# declared as build ARGs, so the Turnstile widget and dashboard PostHog capture shipped disabled
# in every prod bundle. Their consumers all no-op on empty string (use-turnstile.ts,
# waitlist-form.tsx, posthog-init.tsx — which is why the HOST fallback there is `||`, not `??`).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN \
    NEXT_PUBLIC_DISCORD_INVITE_URL=$NEXT_PUBLIC_DISCORD_INVITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

RUN bunx turbo run build --filter=@caisson/site --concurrency=50%

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS runtime
WORKDIR /app
# HOSTNAME=0.0.0.0 is load-bearing: Next's standalone server.js binds to process.env.HOSTNAME, and
# Docker auto-sets HOSTNAME to the container id — so without this the server binds only to the
# container-hostname interface and Railway's edge gets a 502 (unlike docs/support-bot, which use
# Bun.serve and bind 0.0.0.0 by default). This is Next's own documented Docker requirement.
#
# CAISSON_REGISTRY_INDEX_PATH is load-bearing for the sandbox demo-run route (CAISSON-110): its
# generator (apps/site/lib/demo-run/run.ts `registryIndex()`) reads registry/index.json to build the
# in-process scaffold. EXACT precedent apps/admin/Dockerfile (comp-grant boundary): Next's standalone
# server.js runs `process.chdir(__dirname)` on boot, so at runtime cwd is /app/apps/site — the env var
# is honored FIRST, before the cwd-relative fallback would ENOENT on /app/apps/site/registry/index.json.
# Without it every /api/demo/run POST 500s in prod (fail-closed generation_failed).
#
# CAISSON_REVISION_PATH is load-bearing for the same reason, and for the same standalone quirk:
# server.js chdir's to /app/apps/site, so the kernel's cwd-relative lookup for `.caisson-revision`
# would miss the repo-root carrier that `x-caisson-revision` is read from. Absent ⇒ every response
# reports `unknown` — silently, which is the one failure mode this header exists to remove.
ENV NODE_ENV=production \
    PORT=3030 \
    HOSTNAME=0.0.0.0 \
    CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json \
    CAISSON_REVISION_PATH=/app/.caisson-revision

# output:'standalone' traces the minimal node_modules subset the server actually needs into
# .next/standalone, preserving the monorepo-relative path (server.js lands at apps/site/server.js,
# NOT flattened to the image root) — the runtime image copies ONLY that tree + the static assets +
# public/, never bun.lock or devDependencies or sibling workspace packages' source.
COPY --from=build /app/apps/site/.next/standalone ./
COPY --from=build /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=build /app/apps/site/public ./apps/site/public

# CAISSON-110: the demo-run generator reads the built registry index at runtime via a plain node:fs
# read of a repo-root-relative path (loadRegistryIndexFromFile, @caisson/registry-schema) — NOT a JS
# import, so Next's standalone output-file tracer never picks it up. Copied explicitly to the SAME
# path CAISSON_REGISTRY_INDEX_PATH points at above. EXACT precedent: apps/admin/Dockerfile copies the
# same index for its comp-grant boundary (ADR-0278 F1) for the identical tracer-miss reason.
COPY --from=build /app/registry/index.json ./registry/index.json

# The serving-revision carrier. Committed to the repo holding `unknown`, so this COPY always has a
# source and needs no glob; tooling/scripts/railway-deploy.ts overwrites it in the staging tree with
# the deployed sha, which is the only way a sha reaches this image — a Railway CLI upload carries no
# git ref, so it has to travel inside the uploaded bytes.
COPY --from=build /app/.caisson-revision ./.caisson-revision

# Non-root: the standalone server never writes to disk at runtime (no ISR/revalidate — see
# next.config.ts), so the root-owned, world-readable copies above need no chown. `bun` (uid/gid
# 1000) is the oven/bun base image's baked-in non-root user.
USER bun

EXPOSE 3030
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/site/server.js"]
