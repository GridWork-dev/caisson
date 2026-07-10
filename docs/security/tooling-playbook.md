# Caisson security tooling — playbook

The repo-local security stack: open-source / local tools that cover every layer, runnable on this
box, driven by Claude Code or the CLI. Supersedes the **Strix harness** (`tools/strix/`, removed
2026-07-10 — ADR-0314): Strix's agent-lifecycle protocol needed a compliant external engine we
don't run, and a black-box agent duplicated what the deterministic scanners + a CC-driven pentest
already do. This stack is caisson-local (`tools/security/`, this playbook) — **not** a gridwork-core
convention.

Adoption + rationale: **ADR-0314**. The deep Layer-4 (Claude-Code-driven) pentest runbook is
`docs/security/pentest-runbook.md`. Pentest findings history (kept): `strix-findings-*.md` in this dir.

## Operator setup (one-time)

The stack runs $0 out of the box; two operator actions arm it fully.

**1. Install the toolchain** on the box (needs `sudo pacman` for HexStrike's offensive binaries;
everything else lands in `~/.local/bin`, no sudo):

```bash
tools/security/install.sh
```

**2. Arm Semgrep Pro interfile — FREE.** The Pro cross-file engine is included on Semgrep's **free
tier** for ≤10 repos / ≤10 contributors, so **no paid plan is needed for this repo**. Sign in at
**https://semgrep.dev** (GitHub auth) → **Settings → Tokens** → create an **Agent** (API) token, then:

```bash
gh secret set SEMGREP_APP_TOKEN --repo caisson-sh/caisson    # arms the semgrep-pro CI job
# local use: export SEMGREP_APP_TOKEN=... ; semgrep ci -j 1
```

Until set, the `semgrep-pro` CI job cleanly no-ops. Setting it turns on interfile/cross-function
taint + the org policy. **New egress sink** (semgrep.dev) — active only while the token is set.

**Weighing a PAID security tool?** See `docs/security/paid-tooling-roi.md` — a ranked buy/skip memo.
Short version: the $0 stack already covers SAST/SCA/secrets/DAST/pentest; the only paid dollar worth
spending is revenue-enabling (a pentest letter, then SOC2 when a deal demands it), not a sixth scanner.

## The four layers

| #   | Layer                                      | Tools                                                                                                                                               | Driven by                                                      | Gate                                                  |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **SAST** (static)                          | Semgrep (custom floor rules + `p/security-audit`; **Pro** = interfile taint when `SEMGREP_APP_TOKEN` set) · ruff flake8-bandit (support-bot Python) | `scan.sh --layer ci`                                           | non-zero on finding                                   |
| 2   | **Supply-chain**                           | Trivy (vuln+secret+misconfig) · osv-scanner (lockfiles) · TruffleHog (verified-only secrets) · Dockerfile digest gate                               | `scan.sh --layer ci`                                           | non-zero (digest = advisory)                          |
| 3   | **DAST** (dynamic, needs a running target) | nuclei (templates) · OWASP ZAP (spider+active) · Schemathesis (schema fuzz, spec emitted from Zod)                                                  | `scan.sh --layer deep --target <url>` + `dast-schemathesis.sh` | nuclei JSONL / ZAP High alert / schemathesis findings |
| 4   | **AI-pentest** (agentic)                   | ptai (oracle-verified, PoC-validating) · HexStrike (150+ tool-belt)                                                                                 | **Claude Code** via `tools/security/mcp.json`                  | human-in-loop                                         |

Layers 1–2 are deterministic and CI-safe (no live target). Layer 3 needs a target URL. Layer 4 is
Claude-Code-driven on your subscription — free at the margin; it is **not** run by `scan.sh`.

## Install (once)

```bash
tools/security/install.sh        # uv tools + pinned binaries → ~/.local/bin (no sudo)
```

Installs: semgrep, schemathesis, ruff, ptai (uv tools); trivy (pinned), trufflehog (pinned),
osv-scanner, nuclei (binaries); pulls the ZAP docker image; clones + venvs HexStrike; best-effort
`pacman` for HexStrike's offensive binaries (nmap/nikto/sqlmap/…). Re-runnable; skips what's present.

> **io_uring:** semgrep-core can crash `Cannot allocate memory io_uring_queue_init` under
> parallelism on this box. Everything here sets `SEMGREP_JOBS=1` (`-j 1`) to dodge it; the CI Docker
> image is unaffected.

## Layer 1–2: deterministic scan (SAST + supply-chain)

```bash
bun run security:scan                       # = tools/security/scan.sh --layer ci
bun run security:test                       # semgrep test tools/security/semgrep-rules/ (rule unit tests)
SEMGREP_PACKS="" tools/security/scan.sh --layer ci     # offline: custom rules only, no registry pull
tools/security/scan.sh --layer ci --strict-digests     # promote the Dockerfile digest gate to blocking
```

SARIF/JSON output lands **out of tree** in `~/lab/caisson-security-runs/` (override
`SECURITY_OUT_DIR`). The custom floor rules (`tools/security/semgrep-rules/`) are preventive
hold-the-line gates — 0 findings on the repo today; each has a paired `.ts`/`.py` fixture proven by
`security:test`:

- `no-insecure-token-compare` / `py-no-insecure-token-compare` — `===`/`==` on a credential-suffixed
  identifier → use `crypto.timingSafeEqual` / `hmac.compare_digest`.
- `require-fetch-with-timeout` — bare `fetch()` → `fetchWithTimeout`.
- `require-zod-strict` — `z.object()` without `.strict()`/`.passthrough()` at an API boundary.
- `no-console-log`, `no-execsync-interpolation`.

## Layer 3: DAST (against a running target)

Local dev servers: site `:3030`, admin `:3020`, license `:8789`, docs `:8788`.

```bash
# nuclei + ZAP against a target (both self-skip if their tool/docker is absent):
tools/security/scan.sh --layer deep --target http://localhost:3030

# individually:
tools/security/dast-nuclei.sh http://localhost:3030
tools/security/dast-zap.sh    http://localhost:8789 LICENSE_ISSUE_TOKEN   # 2nd arg = caisson.env var holding a Bearer

# schema fuzzing — spec emitted fresh from the services' real Zod schemas (never a stale artifact):
tools/security/dast-schemathesis.sh http://localhost:8789 license         # /issue /eval/apply /eval/issue (Bearer)
tools/security/dast-schemathesis.sh http://localhost:8788 docs            # /query
```

- **nuclei** — gate is the JSONL export, never nuclei's exit code (it exits 0 even with findings).
- **ZAP** — Automation Framework plan `tools/security/zap/plan.yaml`; injects `Authorization: Bearer
${ZAP_AUTH_TOKEN}` via the replacer job; `exitStatus` job exits non-zero on any **High** alert.
  Reports land in `SECURITY_OUT_DIR`, never the repo tree.
- **Schemathesis** — `emit-openapi.ts` imports the exported `IssueBody`/`EvalApplyBody`/
  `EvalIssueBody`/`QuerySchema` and builds the OpenAPI spec, so fuzzing hits the exact shapes the
  handlers parse. Property assertion: never 500, always a structured 4xx on malformed input.

## Layer 3 for admin — the local auth harness

`apps/admin` is GitHub-OAuth-only (ADR-0283): prod can't be scripted (no email+password), and
screenshots/behaviour tests + the pentest need an authed surface. Run a **local, throwaway** authed
dev server instead — never prod.

```bash
tools/security/harness-admin.sh up      # throwaway loopback PG + mint a real signed session cookie
# → prints: storageState path (apps/admin/.harness/admin-session.json) + a curl Cookie header

# start the authed dev server (SAME env — the wrapper pins one env file both read):
source apps/admin/.harness/env.sh && bun --cwd apps/admin dev

# then: point a Playwright run at http://localhost:3020 with the storageState, OR pentest it:
tools/security/scan.sh --layer deep --target http://localhost:3020
tools/security/harness-admin.sh down    # tear down PG + remove .harness/
```

Mechanics: `seed-harness-session.ts` creates the user + github-account + session rows through
better-auth's own `internalAdapter`, reconstructs the signed session cookie, and **proves it** by
replaying it through `auth.api.getSession` before writing `storageState`. Sentinel GitHub id
`999999001` (on the harness allowlist). The secret is byte-identical between the minter and the dev
server because both `source` the one generated env file.

## Layer 4: AI-pentest (Claude-Code-driven)

> **Deep runbook: `docs/security/pentest-runbook.md`** — target/scope matrix (local vs prod, the
> CF-Access service-token path, the admin harness), the hunt list (money/license/auth seams), PoC
> discipline, and copy-paste drive prompts. The below is the wiring summary.

Runs on your Claude subscription (free at the margin). Opt-in MCP set — **not** a repo-root
`.mcp.json` (that would spawn these offensive engines in every caisson session):

```bash
# HexStrike needs its server up first (:8888):
~/lab/tools/hexstrike-ai/.venv/bin/python3 ~/lab/tools/hexstrike-ai/hexstrike_server.py &

# start a pentest session with the two engines wired in:
claude --mcp-config tools/security/mcp.json                    # + global roster
claude --mcp-config tools/security/mcp.json --strict-mcp-config # ONLY these two
```

- **ptai** (`ptai mcp`) — autonomous recon → login → chain → **PoC-validated** findings. No LLM key
  on the MCP path (Claude Code is the driver). Best for "prove this is exploitable".
- **HexStrike** (`hexstrike_mcp.py --server`) — the 150+ tool-belt (nmap, nuclei, sqlmap, ffuf, …)
  exposed as MCP tools. Best for "run the right tool against this surface".

Drive it in-session: _"pentest http://localhost:3030 read-only; validate every finding with a PoC;
report path:line + exploit + fix."_ Point it at local dev servers or the CF-Access-gated prod
origin (with the e2e service-token headers).

## CI

`.github/workflows/security-scan.yml` — **non-required** (branch protection only watches
`check`/`standards-gate`/`registry-index`/`oscal-conformance`), so it may go red to signal a finding
but never blocks a merge. Two jobs:

- `deterministic` — installs the scanners inline, runs `scan.sh --layer ci`, uploads the SARIF set as
  a downloadable artifact (no Security-tab upload — this private free-plan repo has no Advanced
  Security).
- `semgrep-pro` — dormant until the `SEMGREP_APP_TOKEN` repo secret is set; then runs `semgrep ci`
  (interfile/cross-function taint from the org policy).

## Credentials

Nothing is hardcoded; secrets are read at runtime and never printed.

| Secret                                 | Where                                                              | Used by                                                                           |
| -------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `SEMGREP_APP_TOKEN`                    | **GitHub repo secret** (Settings → Secrets)                        | the `semgrep-pro` CI job. Local: `export` it, then `semgrep ci`.                  |
| `LICENSE_ISSUE_TOKEN`                  | `~/.gridwork/caisson.env` (source-chains from `~/.gridwork/env`)   | ZAP/Schemathesis Bearer for the license `/issue` routes                           |
| `CAISSON_E2E_CF_CLIENT_ID` / `_SECRET` | `~/.gridwork/caisson.env`                                          | prod DAST/visual through the CF-Access gate (service token, never a human bypass) |
| admin harness secret                   | generated per-`up` into `apps/admin/.harness/env.sh` (git-ignored) | throwaway only                                                                    |

> **Egress:** Semgrep **Pro** (`semgrep ci` with `SEMGREP_APP_TOKEN`) sends findings metadata to
> **semgrep.dev** — a new external sink, active only when the token is set (CI job + any local
> `semgrep ci`). Free CE (`semgrep scan`, the default `scan.sh` path) is fully local, no egress. exa
> / OpenRouter / Refero remain the only other acknowledged sinks.

## Files

```
tools/security/
  install.sh              # idempotent toolchain install → ~/.local/bin
  scan.sh                 # driver: --layer ci|deep|all --target <url> [--strict-digests]
  _common.sh              # shared env/helpers; SARIF out of tree
  emit-openapi.ts         # Zod → OpenAPI spec (license/docs) for schema fuzzing
  dast-nuclei.sh · dast-zap.sh · dast-schemathesis.sh · check-docker-digests.sh
  harness-admin.sh        # throwaway authed admin dev server (up/down/env)
  mcp.json                # opt-in ptai + HexStrike MCP set (claude --mcp-config)
  zap/plan.yaml           # ZAP Automation Framework plan
  semgrep-rules/*.yaml    # custom floor rules (+ paired .ts/.py fixtures)
apps/admin/scripts/seed-harness-session.ts   # mints the signed admin session cookie
.github/workflows/security-scan.yml          # non-required CI (deterministic + opt-in Pro)
```
