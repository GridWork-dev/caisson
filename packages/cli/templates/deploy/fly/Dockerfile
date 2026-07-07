# {{projectName}} — Fly.io deploy image (ADR-0268 deploy-template family). Single-stage Bun
# build adapted from Caisson's own services/docs Dockerfile pattern, simplified for a
# NON-monorepo repo: this installs and builds only {{projectName}} itself.
#
# The port your server listens on inside the container must match `internal_port` in the
# sibling `fly.toml` — update both together.
#
# If you generated with `--framework next` (or another framework), `bun run start` and the `start`
# script are already wired — deploy as-is. If you generated the bare library base, point CMD at your
# actual entrypoint (and add a `start` script to package.json) before deploying.
FROM oven/bun:1.3.14-slim
WORKDIR /app
ENV NODE_ENV=production

COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

USER bun
EXPOSE 8080
CMD ["bun", "run", "start"]
