# ADR-0426 — Fail closed on commerce account resolution

- Date: 2026-09-16
- Status: Accepted — operator R371 / EST-ASK-329
- Scope: site cart checkout identity
- Supersedes: ADR-0424 reuse of dashboard getSession for money-path account resolution

## Decision

Checkout uses getCheckoutSession and resolveCheckoutAccount. The durable Better Auth
session supplies user identity; the same verified membership and personal-bootstrap
helpers resolve accounts. Membership errors propagate rather than becoming a personal
account. An explicit account preference must match a verified membership; stale/forged
preferences and empty memberships after bootstrap fail closed. With no preference,
normal verified account selection remains available.

The checkout handler catches session/provider, membership and entitlement failures
inside the same error boundary, returns a generic 503 and does not read entitlements
or contact Paddle after account-resolution failure. A missing session remains 401.
Dashboard getSession and its availability fallback are unchanged. No authorization
is inferred from the account preference cookie, and no account ID is accepted in the body.
All other ADR-0424 checkout boundaries and disclosed concurrency/SKU limits remain.

## Verification

The regression imports the actual production route and actual resolvers with isolated
session/provider, membership, entitlement and Paddle boundary doubles. A selected org
plus throwing membership lookup must reach neither entitlements nor transaction creation.
Companion cases preserve dashboard fallback and verify personal/org success, invalid
selection, missing session and session-provider errors. The fixture runs in a child
Bun test process to prevent global module mocks from affecting sibling suites. No live
DB, identity-provider or Paddle call is made. Mutations and restoration hashes are
recorded in RUN-NOTES.
