# services/support-bot — cloud-runner image (ADR-0105). Target is operator-gated at DEPLOY
# (recommended: Railway; Fly.io is the cheaper edge alternative). The bot's gateway connection is
# outbound; the only inbound surface is /health for the runner's liveness probe.
FROM python:3.12-slim AS base

# uv for fast, locked installs. Pinned to the same version CI uses (setup-uv 0.11.18) so the lock
# format can't drift between the gate and the image.
COPY --from=ghcr.io/astral-sh/uv:0.11.18 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install deps first (cache layer) from the lockfile, then the project. `--frozen` unconditionally —
# uv.lock is committed (the source of truth), so a `--frozen` failure is a real drift we want to fail
# the build, not silently install an unlocked resolve.
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen

COPY . .
RUN uv sync --no-dev --no-editable --frozen

EXPOSE 8080
# Liveness: the health server binds $PORT; the gateway runs alongside it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/health').read()" || exit 1

CMD ["uv", "run", "--no-dev", "python", "-m", "caisson_support_bot"]
