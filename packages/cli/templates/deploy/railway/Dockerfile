# {{projectName}} — Railway deploy image (ADR-0268 deploy-template family). Single-stage Bun
# build adapted from Caisson's own services/docs Dockerfile pattern, simplified for a
# NON-monorepo repo: this installs and builds only {{projectName}} itself.
#
# Railway injects `PORT` at runtime — bind your server to `process.env.PORT`, never a fixed port.
#
# STARTER SCAFFOLD: the generated repo ships a library harness, not a server — point CMD at your
# actual entrypoint (and add a `start` script to package.json) before deploying.
FROM oven/bun:1.3.14-slim
WORKDIR /app
ENV NODE_ENV=production

COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

USER bun
CMD ["bun", "run", "start"]
