# ADR-0061 — AI-Kit versioned prompt registry

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Names + versions the prompts the
AI-Kit gateway routes.)

The AI Production Kit gateway (ADR-0059) routes model calls, but the prompts those calls carry must
evolve without losing reproducibility or forcing a redeploy to swap them. A prompt is a versioned
artifact, not a string literal baked into code.

## Decision

A **versioned prompt registry on an append-only storage substrate** — the same append-only-version
discipline as ADR-0053, composed with ADR-0006's `supersedes`-chain versioning semantics.

- **Append-only history.** Prompt rows are immutable; a new version supersedes the prior via the
  `supersedes_id` chain, with a derived "current" predicate. Nothing is destroyed or edited in place.
- **Addressed by name + version.** A prompt is fetched as `name@version`; every render resolves to an
  exact, replayable version. This is the ADR-0006 versioning contract applied to prompts.
- **Mutable production pointer.** A named alias (`prod`, `canary`, …) maps `alias → version` and is the
  live selector. Swapping the live prompt mutates only the pointer, never history — **no redeploy** to
  promote, roll back, or A/B a version.
- **Typed templating + render-injection safety.** Templates declare typed variables; values are
  injected through an escaping/structured boundary. **No unescaped interpolation of untrusted values**
  into the prompt body — a render input can never break out of its slot into instruction text.
- **Render traceability.** Each render records `prompt name@version → usage → eval run`, so any
  production output is traceable back to the exact prompt version and its eval evidence (ties into the
  ADR-0059 gateway's call ledger + the eval substrate).
- Ships behind the **ADR-0059 gateway** as part of the premium AI-Kit edition; **fully commercial**
  under ADR-0023 (and note ADR-0050 makes the Local-first AI edition commercial too — no free flank
  here either).

## Rejected

- **Mutating prompt rows in place** — loses the audit trail and reproducibility; a past production
  output can no longer be replayed against the exact prompt that produced it.
- **No production pointer** (hard-pin a version in code) — every prompt swap becomes a redeploy,
  coupling prompt iteration to deploy cadence and removing instant rollback.
- **Untyped string interpolation** — render-injection risk: untrusted values concatenated into the
  body can inject instructions or escape the intended template slot.

## Binding

Prompt versions are immutable and append-only (`supersedes`-chained, ADR-0006/0053); a prompt is
always addressed as `name@version`; the live prompt is selected by a mutable `alias → version` pointer
that never rewrites history; template values cross a typed, escaped injection boundary with no raw
interpolation of untrusted input into the prompt body; and every render links `version → usage → eval
run`. The registry lives behind the ADR-0059 gateway and is commercial-licensed (ADR-0023). Evidence:
ADR-0006 (append-only versioning + `supersedes_id` chain), ADR-0053 (append-only-version discipline),
ADR-0059 (AI-Kit gateway), ADR-0023 (fully-commercial licensing) + ADR-0050 (local-ai commercial);
fork research `outputs/research/wave1-forks.md`.
