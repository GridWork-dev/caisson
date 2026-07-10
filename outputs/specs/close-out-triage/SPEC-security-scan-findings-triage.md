# SPEC — Deterministic security-scan findings triage (first hardening output of ADR-0314)

**Status: LOCKED (ADR-0315, 2026-07-10) — armed for execution. F1 locked: shared `jsonLdScript()` helper refactor (suppressions rejected). F2 locked: wire Renovate for digest pins; `--strict-digests` flips at the first pin-wave merge (app install operator-owed, tracker §1).** The ADR-0314
stack's `deterministic` CI job is red-as-signal BY DESIGN (non-required check). This spec turns its
first real output — captured from run `29075504581` on PR #200 — into a bounded fix wave so the job
can go green and stay green, making future reds meaningful.

- **Surface:** `apps/site` (JSON-LD emitters), `.github/workflows/security-scan.yml`,
  `tools/security/`, the 8 fleet Dockerfiles, `bun.lock` + `services/support-bot/uv.lock`.
- **Tags:** `security` (fires the security audit at SHIP).
- **Type:** post-lock execution once the picker locks the two forks below.

## Findings inventory (run 29075504581, 2026-07-10)

1. **semgrep: 8 blocking findings** — the JSON-LD `dangerouslySetInnerHTML` sites in `apps/site`
   (schema.org structured data per ADR-0079). Server-controlled content, almost certainly safe,
   but they gate the job forever until dispositioned.
2. **trivy + osv-scanner: dependency CVEs** — SARIF written in-job but NOT preserved (finding 3),
   so the exact CVE list is unknown outside the job log. 1567 bun packages + 51 uv packages scanned.
3. **SARIF artifact upload defect** — `upload-artifact` reports "No files were found with the
   provided path: /home/runner/_work/_temp/.security-out" while the scan log shows SARIF written
   to that path. Findings evaporate with the run log. Likely a path/workdir mismatch between the
   scan step and the upload step.
4. **Docker digest pins ADVISORY** — 8 unpinned `FROM` lines (`oven/bun:1.3.14-slim` ×7,
   `python:3.12-slim` ×1). The scan passes `--strict-digests` only "once Renovate pins merge" —
   no Renovate is configured, so the advisory never converts to enforcement.

## Operator forks (picker)

- **F1 — JSON-LD posture:** (a) inline semgrep suppressions with per-site justification comments
  (fast, keeps the sites as-is; recommended — content is server-controlled schema.org data), or
  (b) refactor to a shared `jsonLdScript()` helper that serializes + escapes once, un-flagging all
  8 sites structurally.
- **F2 — digest-pin mechanism:** (a) one-shot manual pin of the 8 FROM lines to current digests +
  flip `--strict-digests` (no new vendor; digests go stale until a bump wave; recommended), or
  (b) wire Renovate (new app on the org) for continuous digest bumps.

## Tasks (once locked)

1. Fix the SARIF upload path so every run preserves its findings bundle (30-day retention).
2. Re-run the scan; pull the trivy/osv SARIF; triage each CVE: fixable-by-bump → bump + changeset;
   no-fix-available → documented accept with the CVE id in `docs/security/tooling-playbook.md`.
3. Execute F1 as locked (suppress-with-justification or helper refactor); `security:test` stays 6/6.
4. Execute F2 as locked; flip `--strict-digests` in the same PR so the gate enforces from then on.
5. Green proof: a `deterministic` run with 0 blocking findings attached as the PR's evidence.

## Verify

`gh run` on the PR head shows `deterministic` green; the SARIF artifact downloads non-empty;
`bun run check` + standards-gate unchanged.

## Effort / value

S-M (half a day once forks locked). Value: the stack stops being decorative — a red `deterministic`
run becomes an actionable signal instead of known noise.
