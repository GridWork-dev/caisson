# SPEC — `@caisson/guardrails` (egress secret-gate + FTC-4Ps presentation guardrail)

**Status: EXECUTED — ADR-0215 (egress secret-gate + FTC-4Ps), harvest slice-2 wave,
2026-07-02 operator picker; hardens in place per ADR-0210 lock 1; shipped PR #47.**

- **Package:** `packages/guardrails` (`kind: primitive`, `tier: paid`,
  `LicenseRef-Caisson-Commercial`, AI Production Kit). No edition/license/tier change —
  resolves the flagged asymmetry by hardening the existing module (ADR-0210 lock 1).
- **Type:** HARDEN IN PLACE — a new `GuardCategory` in the existing `guard.ts` pipeline
  (gridwork-core clean-lift) + a new standalone evaluator (tm-watch lift-sweep rank #13,
  rebuild-clean, pattern only).
- **Tags:** `security` (new secret-shape block category at the gateway chokepoint).

## Goal (WHAT + WHY)

Two gaps in one package. (1) `guard.ts`'s cheap pre-screen only catches caller-authored
`cheapDeny` patterns — a raw credential in a prompt or a model response sails through to
the (possibly outaged) moderator, even though the detection primitive already exists,
golden-pinned, in `@caisson/local-store`. (2) No guardrail exists for FTC-4Ps dark-pattern
copy (false urgency, forced continuity, confirmshaming, drip pricing) — a real risk for
AI-Kit buyers LLM-generating marketing/UI copy, flagged at lift-sweep rank #13.

## Scope

**In:** a `"secret"` `GuardCategory` wired into `guard.ts`'s cheap tier; lifting
`scrubForEgress`/`looksLikeSecret` out of `local-store` into `kernel` (the shared home
both already depend on); a standalone `evaluateFtc4P` heuristic evaluator + Zod schema.

**Out:** wiring FTC-4Ps into the `guard.ts` pipeline (it scores static copy, not a
request/response leg — standalone export, optionally wrappable as a `Moderator`);
`agent-dev/emitter.ts`'s own secret-shape mirror (different package/scope — flagged as a
follow-up); new `GuardPolicy` fields (the secret check is unconditional, no opt-out).

## Design

**Shared home.** `local-store` (base, paid) and `guardrails` (primitive, paid) are both
commercial non-edition, so `guardrails → local-store` would be _legal_ under ADR-0003's
down-only rule — but wrong-weight: it drags sqlite-vec in for one predicate, the exact
reason `emitter.ts` gives for re-deriving instead of importing `local-store`. `kernel`
(base, oss, zero deps) is already a dependency of both, so `scrubForEgress`/
`looksLikeSecret` move to new `packages/kernel/src/secret-scrub.ts` (byte-identical
regex set), exported from `kernel/index.ts`; `local-store/src/egress-guard.ts`
re-exports them instead of defining them (tests + `__golden__/scrub.json` stay green —
only the defining file moves). `guardrails` imports `looksLikeSecret` from
`@caisson/kernel` — zero new `package.json` dependency.

**Secret gate.** `GuardCategory` (`moderator.ts`) gains `"secret"`, mirrored in lockstep
at `GuardrailError`'s category union (`kernel/errors.ts`) and
`guardrailBlockSchema.category` (`kernel/observability.ts`) — three sites, one PR. In
`guard.ts`'s `moderate()`, after `cheapDeny`, before the moderator call:
`if (looksLikeSecret(text)) block(stage, "secret", false, policy, rt);` — unconditional,
both legs, no policy field, no opt-out.

**FTC-4Ps evaluator.** New `packages/guardrails/src/ftc4p.ts`.
`FTC_4P_DIMENSIONS = ["prominence","presentation","placement","proximity"] as const`;
`ftc4pFindingSchema = strictObject({dimension, rule: z.string().min(1), severity:
z.enum(["info","warn","block"]), excerpt: z.string().max(200)})`; `ftc4pResultSchema =
strictObject({scores: strictObject({<one 0-1 number per P>}), findings:
z.array(ftc4pFindingSchema), flagged: z.boolean()})`. `evaluateFtc4P(copy: string):
Ftc4PResult` — pure, no LLM. Five heuristic rules over known FTC dark-pattern classes
(false urgency w/o a real deadline, forced continuity w/o a nearby cancel/price-after
disclosure, confirmshaming decline phrasing, opt-out-framed enrollment, drip pricing w/o
a fee qualifier): each trigger regex checks for a required disclosure regex within a
bounded char window; a miss appends a finding + score penalty on that dimension.
`flagged` when any score <0.5 or any finding is `severity: "block"`. Optional
`ftc4pModerator(threshold = 0.5): Moderator` wraps it via `customModerator` — a buyer
opts it into `guardOutput` with zero `guard.ts` change.

## Tasks

1. `kernel/src/secret-scrub.ts` (move the two functions + regex set from
   `local-store/src/egress-guard.ts`, unchanged) + export from `kernel/index.ts`;
   `egress-guard.ts` re-exports from `@caisson/kernel`; add `"secret"` to the 3 mirrored
   category sites (`moderator.ts`, `kernel/errors.ts`, `kernel/observability.ts`).
   Verify: `bun test packages/kernel/src/secret-scrub.test.ts
packages/local-store/src/egress-guard.test.ts packages/local-store/src/golden.test.ts`.
2. Wire the unconditional `looksLikeSecret` check into `moderate()`; new `guard.test.ts`
   cases: an AWS-key-shaped text blocks category `"secret"` before the moderator runs
   (spy, mirrors the existing `cheapDeny` test), a clean text passes, the event carries
   no matched span. Verify: `bun test packages/guardrails/src/guard.test.ts`.
3. `ftc4p.ts` — schemas + `evaluateFtc4P` + the 5-rule set + `ftc4pModerator`; export
   from `index.ts`. New `ftc4p.test.ts`: one scareware fixture per rule (correct
   dimension + rule id), one clean-copy fixture (`flagged: false`), one fixture with the
   disclosure correctly adjacent (no finding). Verify: `bun test
packages/guardrails/src/ftc4p.test.ts`.
4. Changesets: `@caisson/guardrails` (minor), `@caisson/kernel` (minor),
   `@caisson/local-store` (patch — internal only). Verify: `bun run check`.

## Verify (goal-backward)

- Any of the 5 secret shapes now blocks at `guard.ts`'s cheap tier as `"secret"` before
  the (possibly outaged) moderator runs — the named asymmetry is closed; `scrubForEgress`/
  `looksLikeSecret` have exactly one implementation (kernel), and `emitter.ts`'s mirror is
  a documented follow-up, not a new third re-derivation.
- `evaluateFtc4P` flags all 5 scareware fixtures on the right dimension and passes clean
  copy — a heuristic floor, no LLM in the hot path.
- `bun run check` green; no `manifest.ts` dependency/license/tier change on any of the
  three touched packages (`git diff --stat`).

## Effort: M (~1 day incl. tests). Value: MEDIUM — closes a named security asymmetry +

adds an FTC-enforcement guardrail, both inside existing paid surface, no new SKU.
