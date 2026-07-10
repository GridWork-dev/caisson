# Kickoff N — admin cockpit buildout + security-scan triage + affiliate flip

**Status: STAGED (operator split 2026-07-10, S1 size-balanced / S4 stage-now-build-next-sittings).**
Branch `kickoff/n-platform-cockpit` · worktree `~/lab/worktrees/caisson/n-platform-cockpit` ·
**merges FIRST** (S3: Kickoff M's version cut waits on this track landing).

**Owns:** the ADR-0316 admin buildout
(`outputs/specs/close-out-triage/SPEC-admin-dashboard-buildout.md`) · security-scan findings
triage (`outputs/specs/close-out-triage/SPEC-security-scan-findings-triage.md` — **fixes the one
red CI leg**, the `deterministic` job) · affiliate production flip
(`outputs/specs/close-out-triage/SPEC-affiliate-production-flip.md`).

## Scope (ordered)

1. **Security-scan triage** — the 8 semgrep JSON-LD findings via the ADR-0315 shared
   `jsonLdScript()` helper refactor, trivy/osv dep CVEs (bump or documented-accept), the SARIF
   artifact-upload defect, Docker digest pins (Renovate app is installed — land the pin config
   per ADR-0315). Exit: `deterministic` green on the branch.
2. **Admin cockpit six waves** (ADR-0316) — W-LOGS + W-COMMERCE first (locked rec), then
   W-PRODUCT (PostHog federation with honest empty states), W-FLEET, W-SUPPORT,
   W-INTEL-TRIAGE (reviewed/dismissed migration + two dual-logged POST routes).
3. **ADR-0316 riders** — `@caisson/platform-reads` adoption in `business-reads.ts`; support-bot
   OTLP log export in the Python telemetry module (closes the Loki gap); `EmptyState` on every
   new view.
4. **Affiliate production flip** — `discount_id` capture in `parsePaddleEvent`→`order_record`,
   per-affiliate code minting, commission/clawback report (money seam — fable on review).

## Tree boundary (vs Kickoff M — binding)

N owns: `apps/admin`, `packages/observability`, `packages/platform-reads`,
`services/support-bot` telemetry module, `services/license`, `packages/billing`,
`.github/workflows/security-scan.yml`, service Dockerfiles, dependency bumps, and the
`apps/site` JSON-LD helper + its call sites. N must NOT touch: `scripts/`,
`.github/workflows/{mirror-sync,publish}.yml`, `.changeset/` consume, `services/docs`
retrieval/eval suites, `apps/site` perf surfaces (`next.config`, middleware/cookie) — all
Kickoff-M ground. New changesets for N's own packages are fine (M's cut folds them in).

## Binding rules

- Admin reads stay read-only server-side (Loki/PostHog/Railway/CF GraphQL); the only new
  mutations are the two intel-triage routes, dual-logged per convention.
- Money paths: integer units, `timingSafeEqual`, never `.strict()` a provider webhook envelope.
- Every dispatch sets `model` explicitly; fable on the affiliate/billing seams only.
- Deploy of the built cockpit/services stays a separate operator DEPLOY act.

## Exit criteria

`deterministic` job green · six cockpit waves + riders built with empty-state safety ·
support-bot lands in Loki (proven post-deploy or via local OTLP check) · affiliate flip proven
against a sandbox sim end-to-end · gates green · sot green · merged to main FIRST.
