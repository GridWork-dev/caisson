# Caisson security tooling — playbook

The repo-local security stack: open-source / local tools that cover every layer, runnable on this
box, driven by Claude Code or the CLI. Supersedes the **Strix harness** (`tools/strix/`, removed
2026-07-10 — ADR-0314): Strix's agent-lifecycle protocol needed a compliant external engine we
don't run, and a black-box agent duplicated what the deterministic scanners + a CC-driven pentest
already do. This stack is caisson-local (`tools/security/`, this playbook) — **not** a gridwork-core
convention.

Adoption + rationale: **ADR-0314**. The deep Layer-4 (Claude-Code-driven) pentest runbook is
`docs/security/pentest-runbook.md`. Pentest findings history (archived): `docs/archive/strix-findings-*.md`.

## Operator setup (one-time)

The stack runs $0 out of the box; two operator actions arm it fully.

**Status: both steps DONE 2026-07-10/11** — `install.sh` run, `SEMGREP_APP_TOKEN` set, Semgrep
flipped to Team tier, `semgrep-pro` CI leg green on main. Kept below for re-provisioning a new box
or rotating the token.

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

`.github/workflows/security-scan.yml` — the `deterministic` job is a REQUIRED check since the
2026-07-11 ADR-0327 scan-gate flip (required set: check/standards-gate/registry-index/
oscal-conformance/deterministic — discipline-enforced on this free-plan repo, not a GitHub
branch-protection gate). `semgrep-pro` stays advisory/non-required (dormant until
`SEMGREP_APP_TOKEN` is set). Two jobs:

- `deterministic` — installs the scanners inline, runs `scan.sh --layer ci`, uploads the SARIF set as
  a downloadable artifact (no Security-tab upload — this private free-plan repo has no Advanced
  Security).
- `semgrep-pro` — dormant until the `SEMGREP_APP_TOKEN` repo secret is set; then runs `semgrep ci`
  (interfile/cross-function taint from the org policy).

## Accepted findings (suppression policy)

Suppressions live in three auto-loaded config files so `scan.sh --layer ci` goes green without a
scan.sh change; each entry carries a reasoned statement (an accept, never a blanket mute):

- **`osv-scanner.toml`** (repo root) — CVE accepts for the root `bun.lock`.
- **`services/support-bot/osv-scanner.toml`** — CVE accepts for `services/support-bot/uv.lock`
  (osv-scanner config does **not** propagate into child dirs, so a nested file is required).
- **`.trivyignore.yaml`** (path-scoped secret + misconfig accepts) loaded via **`trivy.yaml`**
  (`ignorefile: .trivyignore.yaml`). Needed because trivy v0.72's default ignore file is
  `.trivyignore` (line format) — it does **not** auto-discover `.trivyignore.yaml`, and scan.sh
  passes no `--ignorefile`; `trivy.yaml` is trivy's own default-loaded config, so no scan.sh change.

**Fixed by bump (NOT accepted)** — root `package.json` `overrides`, so both scanners simply stop
reporting them: `systeminformation` 5.23.8 → `^5.31.6` (CVE-2025-68154 / -2026-26280 / -2026-26318 /
-2026-44724) and `ws` 8.17.1+8.18.0 → `^8.21.0` (CVE-2026-45736 / -2026-48779). Also (2026-07-22):
`sharp` 0.34.5 → `^0.35.0` (GHSA-f88m-g3jw-g9cj, via next's optional peer dep); `@hono/node-server`
1.19.14 → `^2.0.10` (GHSA-frvp-7c67-39w9 + GHSA-9mqv-5hh9-4cgg, via `@modelcontextprotocol/sdk` —
major bump, verified safe: only the stable `getRequestListener()` export is used, `upgradeWebSocket`
is never called so the DoS advisory isn't even reachable, and upstream's v2 release notes confirm
the public API is unchanged); `engine.io` 6.5.5 → `^6.6.9` (GHSA-r635-g3xr-vw7x, deduped onto the
same version already used by the `socket.io@4.8.3` path, displacing the stale `socket.io@4.7.4` pin
nested under `@trigger.dev/core`); `fast-uri` 3.1.3 → `^3.1.4` (GHSA-v2hh-gcrm-f6hx, via `ajv`, which
already allows the fix). `@hono/node-server@2.0.10` and `fast-uri@3.1.4` are both inside the 7-day
`minimumReleaseAge` window as of 2026-07-22 — dated excludes in `bunfig.toml`, removed once aged.

**Accepted (SPEC-security-scan-findings-triage, ADR-0315):**

| Finding                        | Where (scanner)                                                               | Why accepted                                                                                                                                                                                                                             | Date       |
| ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CVE-2024-47764                 | `cookie` <0.7.0, `bun.lock` (osv)                                             | Transitive under trigger.dev's engine.io; sid-cookie attrs come from static config, never user input. Global override would break engine.io (~0.4.1) / msw (^1.1.1).                                                                     | 2026-07-10 |
| CVE-2026-41305                 | `postcss` <8.5.10, `bun.lock` (osv)                                           | XSS only when stringifying attacker-submitted CSS; the build processes first-party authored CSS only. Fix 8.5.10 → Renovate.                                                                                                             | 2026-07-10 |
| CVE-2026-8769                  | `@ai-sdk/provider-utils` 3.0.27/28, `bun.lock` (osv)                          | No fixed version published. Re-evaluate when a fix ships.                                                                                                                                                                                | 2026-07-10 |
| CVE-2026-54285                 | `@opentelemetry/core` 2.0.1, `bun.lock` (osv)                                 | trigger.dev-nested; main OTel suite already on fixed 2.8.0. Header over-allocation bounded by Node's 16KB header cap; forcing 2.8.0 risks trigger.dev telemetry.                                                                         | 2026-07-10 |
| CVE-2026-45772, CVE-2026-45773 | `turbo` 2.5.8, `bun.lock` (osv)                                               | ACE only when running turbo in an UNTRUSTED repo with malicious `.yarnrc.yml`; our CI runs the trusted first-party repo only. Fix 2.9.14 → Renovate.                                                                                     | 2026-07-10 |
| CVE-2025-71176                 | `pytest` 8.4.2, `services/support-bot/uv.lock` (osv)                          | Dev-only test dep, local tmpdir DoS. Only fix is pytest 9 (major), outside the pinned `<9` range + coupled pytest-asyncio bump.                                                                                                          | 2026-07-10 |
| AVD-DS-0002                    | `services/docs/Dockerfile` (trivy misconfig)                                  | Container must enter as root to chown the root-owned Railway volume mount, then drops to uid 1000 `bun` via setpriv (entrypoint + healthcheck). Effective runtime user is non-root; `USER bun` would break the chown + the setpriv drop. | 2026-07-10 |
| github-pat, private-key        | `packages/local-store/src/golden.ts` + `__golden__/scrub.json` (trivy secret) | Golden scrub fixtures: deliberately-unsafe fake credentials that are the INPUT to the secret-scrubber's golden-file regression. Security-floor carve-out for test files exercising deliberately unsafe input.                            | 2026-07-10 |

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
.github/workflows/security-scan.yml          # required deterministic job + advisory opt-in Pro leg
trivy.yaml                                   # loads .trivyignore.yaml (trivy won't auto-discover it)
.trivyignore.yaml                            # path-scoped trivy secret + misconfig accepts
osv-scanner.toml                             # osv CVE accepts for the root bun.lock
services/support-bot/osv-scanner.toml        # osv CVE accept for the nested uv.lock
```
