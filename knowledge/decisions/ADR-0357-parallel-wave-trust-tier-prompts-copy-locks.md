# ADR-0357 — Parallel-wave locks: trust-tiered scripts gate, prompts set, copy pass, R2 parity guards

- **Date:** 2026-07-17
- **Status:** Locked (operator, triage picker + wave-lock picker, 2026-07-17 PM)
- **Extends:** ADR-0354 (Agent Skills directory model) · ADR-0355 (MCP resources slice A) · ADR-0328 (wave convention) · ADR-0264 (no-silent-degrade)
- **PRs:** #257 (R2 parity guards) · #258 (skills bundled files) · #259 (MCP prompts) · #260 (site copy)

## Context

The 2026-07-17 PM triage picker locked "parallel work isolated workflows": four ride-along
lanes built as an ADR-0328 wave (one worktree + one PR each), SHIP-audited in-session
(4 code reviews + 3 security audits, all-clean verdicts after one P1 fix). This ADR records
the operator locks the wave shipped under and the accepted residual the audit named.

## Decisions

### D1 — Skills bundled files ship behind a TRUST-TIERED scripts gate (operator override)

`SkillArtifact` gains three optional bundled-file maps — `references` + `assets` (inert) and
`scripts` (executable). The executable-content gate is **trust-tiered**, not opt-in-everywhere
(the operator overrode the opt-in-default recommendation):

- The curated `CAISSON_DEFAULT_ARTIFACTS` set is trusted **at composition time** — trust is the
  absence of a caller-supplied `artifacts` option, never a field on the artifact (spoof-proof by
  construction; audit-verified). Curated scripts always emit.
- Any caller-supplied artifact set is untrusted: scripts emit only under an explicit
  `allowScripts: true`. Withheld scripts push exactly one no-silent-degrade warning per skill.
- Path floor is two-layer: parse-time `bundledPath` regex + write-time assembled-path assertion
  with root containment.

**Accepted residual (audit sec-258, operator design):** `references`/`assets` always emit —
an untrusted skill can place inert, non-executable text under those directories (path-safe,
secret-scanned, never chmod +x). Buyer tooling must never treat references/assets as runnable;
the trust tier guards the `scripts/` auto-run convention, not text content generally.

### D2 — The full prompts set ships on the buyer MCP (all three)

`integrate_module` (base) · `setup_ai_config` (ai-kit, via the coach seam) ·
`compliance_evidence_walkthrough` (compliance, own module, zero `@caisson/compliance` dep).
The prompt registry mirrors tools/resources exactly: invisible-404 before rate-limit,
constant-time entitlement, strict per-prompt args (bounded ≤512), ADR-0161 transport
duplication preserved.

**Binding rule (from the audit P1):** a prompt recipe must pin CONCRETE versions resolved from
the live registry index (`entry.latest`) — never the literal `"latest"` pointer, which
`assertKnownVersion` rejects. Edition-membership prompts fail closed when a hard-coded member
is missing from the index.

### D3 — Site copy pass: four changes, three explicit no-changes

Per the Cookiy positioning synthesis: F1c hero-door segment-neutral reword · F2 compliance
proof-scope block (names the real OSCAL conformance gate + precise claim scope, self-run
schema-only, no third-party assessment implied) · F3 support-scope statement grounded ONLY in
shipped facts · F4 build-vs-buy DIY objection named directly. F5 SkuMatrix reorder, F6 hero
one-liner, F7 composable-story hoist — deliberately untouched. Audit verified every claim
code-grounded; V1-live posture holds.

### D4 — R2 parity recurrence guards, advisory-only probe

The advertised-vs-R2 divergence class (bit twice on 2026-07-17) gets two additive guards:
a fail-closed `r2-parity-probe` (daily cron + post-publish + manual; **advisory-only by
operator lock**, not a required check; reuses the release-environment R2 secrets read-only)
and a sibling-churn re-pack check in `refreshVersionCandidateTarballs` that surfaces the
pack-embeds-devDep-versions class at version-PR time instead of the publish byte gate.

### D5 — W3 caisson-oss flip stays HELD on business optics (operator lock)

All ADR-0318 technical preconditions verified green 2026-07-17 (including the first fresh-export
entitlement-token scan-gate run); the flip waits on the Mercury/Paddle business milestones
before any public GTM motion. The 7-step operator checklist is filed in
`outputs/research/w3-flipgate-verification-2026-07-17.md`.

## Consequences

- Buyer-facing skills can now ship helper files; the trust tier is the model future executable
  surfaces extend (no per-surface bespoke gates).
- The MCP surface is tools + resources + prompts — feature-complete against the MCP spec's
  three primitives for the slices shipped so far.
- The registry release flow has both halves of the parity net: pre-merge (sibling churn) and
  post-publish (live probe).
