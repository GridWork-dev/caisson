# ADR-0172 — SSO adapter: WorkOS (SAML/SCIM) behind the `SessionProvider` port, sign-in scope only

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0015 (better-auth,
`withTenant` sole RLS entry) · composes with ADR-0176 (org account model — role/provisioning lives there, not
here) · realizes `docs/state/adapter-expansion.md` §1C (advisory "ADR-0121" retires → 0172). Append-only.

## Context

`packages/auth` defines `SessionProvider.resolveSession(req): Promise<SessionContext|null>`
(`session.ts:9-19`). The one conforming implementation is `apps/site/lib/auth.ts` `getSession()`, wrapping a
better-auth instance built in `auth-server.ts` `createAuth()` — `plugins: [magicLink(...)]` +
`socialProviders`. There is **no SAML/SCIM plugin**. Enterprise/compliance buyers _require_ SSO — the sale
this unblocks (`adapter-expansion.md` §1C).

## Decision

Add a **WorkOS** SSO driver as a new better-auth plugin wired into `auth-server.ts`'s existing `plugins[]`
array (sibling to `magicLink`), or a WorkOS custom SSO provider registered alongside `socialProviders` —
whichever the better-auth WorkOS integration cleanest supports at build time. better-auth stays the default OSS
driver; WorkOS is the commercial/enterprise lane. Both `packages/auth` and `apps/site` are in Stream D's tree,
so the driver + its wiring land in-stream with no cross-boundary edit.

**Scoped to sign-in only.** SCIM directory-sync / org provisioning / real role resolution is **not** in this
ADR — `getSession()` currently hardcodes `role:"owner"`, `accountId=user.id`, which the **org account model
(ADR-0176)** replaces. This ADR authorizes the auth _transport_; ADR-0176 owns account/role semantics. Keeping
them separate prevents this from silently becoming a materially bigger build.

## Scope — build-now vs DEPLOY-class

**Build now:** the WorkOS plugin/provider registration + config plumbing + a driver-shape test. **DEPLOY-class:**
the WorkOS client id/secret + the buyer's IdP connection — dormant until env is set (matching every other
driver).

## Rejected

- **Clerk / Auth0 / Okta as the lead** — WorkOS leads (SAML+SCIM, on-brand with compliance); others on demand.
- **SSO-only for the base buyer flow** — rejected; base sign-in stays magic-link + OAuth (ADR-0132). SSO is the
  enterprise lane, not a replacement.
- **Folding org/role provisioning in here** — that is ADR-0176.

## Binding

`SessionProvider` gains a WorkOS SSO driver, sign-in scope only; better-auth stays the default; account/role
semantics are owned by ADR-0176. Adding another SSO vendor needs no new ADR; extending this to SCIM
provisioning does (and must reconcile with ADR-0176).

Evidence: `packages/auth/src/session.ts:9-19`; `apps/site/lib/auth.ts:23-41`; `apps/site/lib/auth-server.ts:60-84`;
`docs/state/adapter-expansion.md:37,70-74`; recon `wf_fa542371-7e6` (D5:crypto-identity).
