# ADR-0310 — Repo-local security tooling stack; Strix harness retired

**Status:** accepted · 2026-07-10 (Kickoff-K security round-2). **Tags:** `security`, `infra`,
`tooling`. Replaces the Strix agentic-pentest harness with a four-layer open-source stack wired
into `tools/security/`; records the semgrep.dev egress sink.

## Context

The Strix harness (`tools/strix/`) was an on-demand agentic black-box pentest driven by an external
engine (GLM-5.2 / a ChatGPT-subscription bridge). Round-2 (2026-07-10) established that the
available bridge engine (gpt-5.4) does not conform to Strix's agent-lifecycle protocol — a bounded
run produced 312 non-conforming turns and no usable findings. A black-box agent also duplicated
coverage the deterministic scanners + a Claude-Code-driven pentest already provide, for a worse
signal-to-cost ratio. The operator scratched the harness and asked for a configurable, every-layer,
open-source stack runnable on this box, driven by Claude Code or a CLI, and wired **for the caisson
repo** (not promoted to a gridwork-core convention).

## Decision

1. **Four-layer stack under `tools/security/`** (playbook: `docs/security/tooling-playbook.md`):
   - **SAST** — Semgrep (5 custom floor rules + `p/security-audit`; **Pro** interfile taint when
     `SEMGREP_APP_TOKEN` is set) + ruff flake8-bandit for the support-bot Python surface.
   - **Supply-chain** — Trivy (vuln+secret+misconfig) · osv-scanner · TruffleHog (verified-only) ·
     a first-party Dockerfile `@sha256` digest gate (advisory until Renovate pins land).
   - **DAST** — nuclei (JSONL-export gate, never nuclei's exit code) · OWASP ZAP (Automation
     Framework plan, replacer-injected Bearer, `exitStatus` on High) · Schemathesis fuzzing an
     OpenAPI spec **emitted true-to-code from the services' Zod schemas** (`emit-openapi.ts`).
   - **AI-pentest** — ptai (PoC-validated) + HexStrike (150+ tool-belt), Claude-Code-driven via an
     **opt-in** `tools/security/mcp.json` (`claude --mcp-config …`), never a repo-root `.mcp.json`.
2. **Admin coverage runs locally, never prod.** `apps/admin` is GitHub-OAuth-only (ADR-0283);
   `harness-admin.sh` + `seed-harness-session.ts` stand up a throwaway-Postgres authed dev server by
   minting a real better-auth session cookie (proven by replaying it through `auth.api.getSession`),
   so both the visual harness and the pentest reach the authed surface without OAuth.
3. **CI is non-required.** `security-scan.yml` runs the deterministic layer on push/PR (SARIF as an
   artifact — no Advanced Security on this private free-plan repo) and a Pro job dormant until the
   `SEMGREP_APP_TOKEN` secret exists. It may go red to signal a finding; it never blocks a merge.
4. **`tools/strix/` removed.** The dated findings (`docs/security/strix-*.md`) are kept as history.

## Consequences

- Every layer is open-source and runs on the box; the deterministic layers are CI-safe with no live
  target, and the AI-pentest layer runs on the Claude subscription (free at the margin).
- **New egress sink:** Semgrep **Pro** (`semgrep ci`) sends findings metadata to **semgrep.dev**,
  active only while `SEMGREP_APP_TOKEN` is set. Free CE (`semgrep scan`, the default path) is fully
  local. This is recorded caisson-locally here + in the playbook; the gridwork-core
  `security-surfaces.md` ledger is untouched (the stack is deliberately repo-local, not a gw-core
  convention) — promote a row there only if the box-wide floor should track it.
- The 5 custom Semgrep rules are preventive hold-the-line gates (0 findings today), each with a
  paired fixture proven by `bun run security:test`.
- Exporting four service request-body schemas (`IssueBody`/`EvalApplyBody`/`EvalIssueBody`/
  `QuerySchema`) is the only product-code touch — additive, keeps the fuzz spec true-to-code.
