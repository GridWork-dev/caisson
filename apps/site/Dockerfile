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
FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS build
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
# DEMOS_ORIGIN_URL is NOT a NEXT_PUBLIC_* var and is never read by the browser — it is a BUILD ARG
# for a different reason (ADR-0400). Next evaluates next.config.ts's `rewrites()` at BUILD time and
# bakes the result into .next/routes-manifest.json; the standalone server reads that manifest, not
# the config. So a DEMOS_ORIGIN_URL set only as a runtime service variable produces an image whose
# manifest carries NO /demos rewrite — the site would answer every embed URL with its own 404 and
# every module page would show the fallback text, with the variable sitting there looking armed.
# VERIFIED by inspecting routes-manifest.json from a build with and without it set.
# Empty default = the documented fail-safe: no rewrite, no /demos route, the pre-split site.
ARG DEMOS_ORIGIN_URL=""
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN \
    NEXT_PUBLIC_DISCORD_INVITE_URL=$NEXT_PUBLIC_DISCORD_INVITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    DEMOS_ORIGIN_URL=$DEMOS_ORIGIN_URL

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
ENV NODE_ENV=production \
    PORT=3030 \
    HOSTNAME=0.0.0.0 \
    CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json

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

# Non-root: the standalone server never writes to disk at runtime (no ISR/revalidate — see
# next.config.ts), so the root-owned, world-readable copies above need no chown. `bun` (uid/gid
# 1000) is the oven/bun base image's baked-in non-root user.
USER bun

EXPOSE 3030
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/site/server.js"]
