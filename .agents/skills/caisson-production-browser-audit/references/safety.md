# Production safety

## Preflight

- Ring 2: check only whether `CAISSON_E2E_ACCOUNT_EMAIL`, `CAISSON_E2E_ACCOUNT_PASSWORD`, `CAISSON_E2E_CF_CLIENT_ID`, and `CAISSON_E2E_CF_CLIENT_SECRET` exist.
- Ring 3: from the selected dedicated admin profile's own cookie jar, issue a read-only `GET https://admin.caisson.sh/api/auth/get-session` with credentials included. Pass only when the response is 2xx JSON with non-empty `session` and `user` objects. Feed that boolean into `runPreflight` as `adminSessionLive`; an operator attestation is not a substitute.
- Record only the Ring-3 liveness boolean. Never copy/extract the cookie or record response identity fields. A false/invalid/redirected response blocks Ring 3 until the operator re-authenticates the profile interactively.
- Never output values, lengths, prefixes, screenshots, DOM values, or copied secrets.
- Require a dedicated buyer profile and a distinct admin operator profile. Reject default, personal, shared, guest, identical, stale, or unknown profiles.
- Reject any authenticated mutation when a prior journal is unresolved.
- Never accept secrets pasted into chat. Use the established harness environment/session boundary.

## Mutation allow contract

Require exact fixture owner, before snapshot, action, expected transition, compensator, cleanup assertion, and stop condition. For Ring 3 also require the operator-approved synthetic-fixture allowlist entry.

## Absolute denylist

- real purchase or financial commitment
- irreversible subscription cancellation or external provider handoff
- account deletion
- identity, email, password, MFA, or recovery change
- role, permission, or authorization change
- message/notification to a real recipient
- file upload
- mutation of a non-probe account or non-synthetic admin fixture

Unexpected navigation, identity, provider handoff, authorization, or state divergence stops mutation and preserves evidence for operator review.
