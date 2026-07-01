# ADR-0132 — Buyer sign-in: magic-link primary + GitHub/Google OAuth, via better-auth

Status: accepted · 2026-06-30 (harvest + sign-in grill session, operator lock #4) · extends
ADR-0015 (better-auth, session/RLS seam — unchanged) · closes the buyer-sign-in-placeholder gap
recorded in `docs/build-state.md` ("the buyer sign-in flow is a placeholder"). Append-only;
supersede with a later ADR, never edit.

## Context

The unified Railway app's buyer dashboard (`ADR-0114`'s `/dashboard` route group) reads real tenant
data through the fail-closed RLS `withTenant` seam, but `docs/build-state.md`'s "genuinely next"
list flags the `/login` flow itself as a placeholder — no sign-in method was ever locked. This is
the last open piece of the buyer auth surface before the dashboard can carry a real user session.

## Decision

Buyer `/login` authenticates through **better-auth** (already the platform's sole auth seam,
ADR-0015 — no new auth infrastructure) using **both** of the following, not a single method:

1. **Email magic-link — primary.** No password. Resend is already wired (ADR-0018, reused per the
   ADR-0085 email seam), so this is a config addition (better-auth's magic-link plugin), not a new
   transport.
2. **OAuth — GitHub and Google, one-click.** Near-universal identity providers for the dev-kit buyer
   ICP (ADR-0080's dev-kit-noun register); better-auth's `socialProviders` config, no new infra.

## Why

- **Matches the ICP.** A developer buying a self-serve dev-kit expects GitHub OAuth by default and
  tolerates email magic-link; neither expects nor wants a password to manage.
- **Zero new credential class.** Magic-link removes password-reset support burden entirely; both
  methods route through better-auth's existing session/cookie shape into the unchanged `withTenant`
  RLS seam (ADR-0015) — no new session model.
- **Reuses wired transport.** Resend is already live for waitlist/product-update email (ADR-0085);
  magic-link is the same transport, a different template.
- **Enterprise SSO is a separate, later concern.** WorkOS/SAML-SCIM (adapter-expansion.md Tier 1C,
  proposed ADR-0121) is the enterprise-buyer expansion; this ADR is the base buyer-dashboard flow,
  not a substitute for it.

## Scope — build now vs. DEPLOY-class

**Build now (in-repo, no live creds needed to merge):** the better-auth magic-link plugin config +
GitHub/Google OAuth provider registration + the `/login` UI replacing the placeholder; session
wiring into the existing `withTenant` RLS entry (ADR-0015, unchanged).

**DEPLOY-class (operator-gated):** the actual GitHub and Google OAuth application credentials
(client id/secret) — live transport credentials follow the same operator-gated pattern as every
other live driver in `docs/state/adapter-expansion.md` (KMS, WorkOS, SES, etc.).

## Rejected

- **Password auth** — rejected; adds a credential class (hashing, reset flow, breach exposure) with
  no benefit over magic-link for a CLI/dev-kit purchase flow.
- **SSO-only (WorkOS)** — rejected for the base buyer flow; that is the Tier-1C enterprise expansion
  item (`docs/state/adapter-expansion.md`), a separate, later ADR, not a substitute for self-serve
  sign-in.
- **Magic-link only, no OAuth** — rejected; GitHub OAuth specifically is near-zero-friction for the
  exact ICP buying a dev-kit and was an explicit part of the operator's lock.

## Relations

Composes with ADR-0131 (a signed-in buyer's dashboard is where post-purchase entitlements/licenses
surface) and ADR-0114 (`/dashboard` route group, unchanged). Does not touch the better-auth/Drizzle
table-ownership boundary locked in ADR-0015.

## Binding

Buyer sign-in is better-auth email magic-link (primary) plus GitHub/Google OAuth (one-click
alternatives); no password auth. Enterprise SSO is out of scope here and tracked separately.
Changing the sign-in method set, or adding password auth, requires a superseding ADR.

Evidence: `harvest-doc-plan.md` operator lock #4; `docs/build-state.md` "genuinely next" (buyer
sign-in placeholder); `knowledge/decisions/ADR-0015`, `ADR-0018`, `ADR-0085`, `ADR-0114`;
`docs/state/adapter-expansion.md` §1C (SSO, out of scope here).
