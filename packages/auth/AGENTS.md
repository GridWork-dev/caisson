# @caisson-sh/auth — agent usage note

Provides the EdDSA-JWT account-token contract, the session interface backed by better-auth,
and multi-user account-membership resolution (owner/seat roles) over Postgres RLS.

## Key surface

- `requireSession(ctx)` — guard for protected surfaces; throws 401 when there is no session.
  `SessionContext`/`SessionProvider` are the provider-agnostic session types; better-auth is
  the reference implementation.
- `generateAccountKeyPair()` / `signAccountJwt(claims, privateKey, opts?)` /
  `verifyAccountJwt(token, publicKey, opts?)` — Ed25519 account-token issue and verify. Tokens
  are short-lived; the `sub` claim carries the tenant-scoped user ID that feeds Postgres RLS
  (passes into `withTenant` from `@caisson-sh/tenancy-rls`).
- `resolveUserAccounts(db, userId)` / `ensurePersonalAccount(db, userId)` /
  `selectActiveAccount(memberships, requestedAccountId?)` / `listAccountMembers(db, accountId)` /
  `addAccountMember(db, actorRole, accountId, userId, role?)` / `assertCanManageMembers(role)` —
  account-membership resolution and management for multi-user (owner/seat) accounts.
  `ACCOUNT_MEMBER_SCHEMA_SQL` is the owning table DDL.
- `createWorkosSsoProvider(config)` — a WorkOS SSO transport seam (sign-in only, not org
  provisioning/SCIM): builds the authorization URL and exchanges the callback code for a
  verified user id + email. Config (client id, API key, redirect URI) is injected — never
  hardcode provider URLs or client secrets in code.
- Never compare token strings with `===`; use `safeEqualFixed`/`safeEqualVariable` from
  `@caisson-sh/kernel`.

## Scope

Auth boundary only. Billing, credit gating, and AI-provider keys are out of scope for this package.
