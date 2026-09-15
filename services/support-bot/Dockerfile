# services/support-bot — cloud-runner image (ADR-0105). Built from the REPO ROOT context (Railway
# uploads the project root; the Dockerfile is selected via RAILWAY_DOCKERFILE_PATH=services/support-bot/
# Dockerfile). All COPY paths are therefore repo-root-relative. The bot's gateway connection is
# outbound; the only inbound surface is /health for the runner's liveness probe (binds $PORT).
FROM python:3.14-slim@sha256:a7fb1e634c4a578f9e0bd6327f11a3cde11b7a9395f48e24360c0988bcc5c2bc AS base
# R333: patch fixable OS CVEs while retaining the audited base digest.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# uv for fast, locked installs. Pinned to the same version setup-uv uses in security-scan.yml and
# support-bot.yml so the lock format can't drift between the gate and the image.
COPY --from=ghcr.io/astral-sh/uv:0.12.2@sha256:069a51314a7bb6031777a9273205fe1b0b19e914ef418207d1338b268df641dd /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install deps first (cache layer) from the lockfile, then the project. `--frozen` unconditionally —
# uv.lock is committed (the source of truth), so a `--frozen` failure is a real drift we want to fail
# the build, not silently install an unlocked resolve.
COPY services/support-bot/pyproject.toml services/support-bot/uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen

COPY services/support-bot/ ./

# The serving-revision carrier, read at import by billing_grant.py to answer x-caisson-revision.
# This service's build context is the repo ROOT (see railway.toml), so the repo-root file is
# reachable even though every other COPY here is scoped to services/support-bot/. Committed holding
# `unknown`, so this COPY always has a source; railway-deploy.ts overwrites it in the staging tree
# with the deployed sha, which is the only way a sha reaches this image.
COPY .caisson-revision ./

RUN uv sync --no-dev --no-editable --frozen

# Non-root: the venv + app code are root-owned but world-readable (default COPY/uv perms); the
# runtime user only ever reads them. `--no-sync` on the CMD's `uv run` is load-bearing for this —
# without it, `uv run` re-verifies/reinstalls the local project into .venv on every container
# start and needs WRITE access; the venv was already fully synced by the two `uv sync` steps
# above, so skip the redundant runtime resync instead of granting write. HOME points at /tmp
# (world-writable) in case a dep probes for a cache/config dir.
RUN groupadd --gid 1001 appuser \
    && useradd --uid 1001 --gid appuser --no-create-home --shell /usr/sbin/nologin appuser
ENV HOME=/tmp
USER appuser

EXPOSE 8080
# Liveness: the health server binds $PORT; the gateway runs alongside it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/health').read()" || exit 1

CMD ["uv", "run", "--no-sync", "--no-dev", "python", "-m", "caisson_support_bot"]
