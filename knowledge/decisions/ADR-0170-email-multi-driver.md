# ADR-0170 — Email adapter: SMTP-generic + AWS SES + Postmark behind the `Emailer` port

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0018 (jobs/email ports)
/ ADR-0085 (Resend seam) · realizes `docs/state/adapter-expansion.md` §1A (the advisory "ADR-0119" placeholder
retires — real number taken from Stream D's reserved range 0170–0179 per the kickoff). Append-only; supersede
with a later ADR, never edit.

## Context

`packages/email` ships the one-method `Emailer` port (`email.ts:8-17`) with two drivers: `createResendEmailer`
(prod) and `createCaptureEmailer` (test). Driver selection is env-gated **at the call site**
(`apps/site/lib/auth-server.ts` `resolveEmailer()` presence-checks `RESEND_API_KEY`), never inside the
package. Resend-only blocks any buyer with an existing mail stack or a data-residency rule — the market-cap
this expansion widens (`adapter-expansion.md` §1A).

## Decision

Add three sibling drivers in `packages/email/src/` — `smtp.ts` (generic, universal catch-all), `ses.ts` (AWS
SES, cheap enterprise scale), `postmark.ts` (transactional reliability) — each exporting a
`create<X>Emailer(config): Emailer` factory that takes **injected config** (never reads `process.env`
internally, matching Resend). Selection stays at the call site via the existing env-gated `resolveEmailer()`
(extended with an `EMAIL_DRIVER` selector or presence-order). `fetchWithTimeout` on every outbound call; Zod
`.strict()` on each config; `InternalError` without echoing provider response bodies (matching Resend).

Ship **one shared port-conformance test** (`email.conformance.test.ts`) that loops every driver against a
mocked transport and asserts each satisfies `Emailer.send` — the harness does not exist yet; ~15 lines, built
once here and reused by ADR-0173/0174/0175's ports too.

## Scope — build-now vs DEPLOY-class

**Build now (merge-safe, runtime-inert):** the three driver files + the conformance test + the selector
extension. **DEPLOY-class (operator-gated):** the SMTP/SES/Postmark credentials — every driver is dormant
until its env is set (identical to Resend today), so merging changes no runtime behavior.

## Rejected

- **Reading the secret inside the package** — breaks the established call-site-env-gate boundary; the package
  stays pure/injected.
- **A driver per config permutation** — one factory per provider, config-injected, covers it.

## Binding

Email is a multi-driver port (Resend · Capture · SMTP · SES · Postmark) selected by injected/env-gated factory;
new drivers are sibling files taking injected config; every driver satisfies the shared conformance test.
Adding a driver requires no new ADR (this authorizes the set); a new port-shape change would.

Evidence: `packages/email/src/email.ts:8-17,28-38,53-75`; `apps/site/lib/auth-server.ts:38-46`;
`docs/state/adapter-expansion.md:35,53-59`; recon `wf_fa542371-7e6` (D5:commerce-comms).
