# {{projectName}} — Railway deploy image (ADR-0268 deploy-template family). Single-stage Bun
# build adapted from Caisson's own services/docs Dockerfile pattern, simplified for a
# NON-monorepo repo: this installs and builds only {{projectName}} itself.
#
# Railway injects `PORT` at runtime — bind your server to `process.env.PORT`, never a fixed port.
#
# If you generated with `--framework next` (or another framework), `bun run start` and the `start`
# script are already wired — deploy as-is. If you generated the bare library base, point CMD at your
# actual entrypoint (and add a `start` script to package.json) before deploying.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61
WORKDIR /app
ENV NODE_ENV=production

COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

USER bun
CMD ["bun", "run", "start"]
