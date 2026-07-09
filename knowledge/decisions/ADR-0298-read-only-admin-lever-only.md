# ADR-0298 — Read-only mutation gate is an admin maintenance/incident lever only — no dunning freeze

**Status:** accepted · 2026-07-09 (Kickoff-H W3 commerce/license wave; direction locked in the
kickoff's fork rounds 1–2). **Tags:** `billing`, `security`.

## Context

`packages/kernel/src/read-only.ts` shipped `assertNotReadOnly(mode, action)` (the fail-closed
409 mutation gate, ADR-0229 row 54) as a tested primitive with no live mode source — its own
comment said "do not fabricate a caller." CAISSON-58 asked for the wiring and floated two mode
sources: an operator maintenance switch, and a dunning freeze on `subscription.past_due`.

Caisson's shipped billing posture deliberately does not handle `past_due`: only
`subscription.canceled` revokes, and Paddle's own recommendation for past-due subscriptions is
full-access grace while dunning retries run. A dunning freeze would be a new caisson-specific
policy contradicting both the shipped behavior and the provider's guidance.

## Decision

- **`assertNotReadOnly` is wired to a manual, admin-flipped system-mode source.** The persisted
  source is `admin_action_log` itself: the latest `system_mode` row's `payload_after.mode` is
  the current mode (`active` when no row exists). Reusing the log as the store makes the lever
  runtime-flippable (no redeploy), persisted across instances, and audit-trailed by
  construction — every flip is itself a dual-logged admin action.
- **Every admin mutation action** (grant, revoke, adjust, reissue, first-mint, resend-email,
  purchase-revoke, rotate) **consults the mode fail-closed before writing**: `read_only` →
  409, nothing lands. The lever itself is ungated — flipping back to `active` must work while
  read-only, or the freeze would be permanent.
- **The SOURCE read defaults to `active`** when unset or unreadable (fail-open-to-available):
  `read_only` is the exceptional state an operator explicitly arms; defaulting to it on a
  transient read error would brick every mutation including the un-arming lever. The gate
  stays fail-closed on an armed `read_only`.
- **Do NOT freeze writes on `subscription.past_due`.** The dunning-freeze half of CAISSON-58
  is **won't-fix**: past_due keeps full access (the Paddle-recommended grace posture caisson
  already ships); the mode is never derived from billing state.

## Consequences

- Closes the useful half of CAISSON-58; the dunning half is closed won't-fix.
- The lever doubles as the W2 incident-runbook tool: an operator can freeze the admin/license
  mutation surface during an incident or maintenance window with one `POST
/api/admin/system-mode` call and unfreeze the same way.
- `admin_write` gains SELECT on `admin_action_log` (it already INSERTs there); the DEPLOY
  provisioning script now also applies the action-enum CHECK widening so a live DB accepts the
  new `system_mode` action. Re-run `provision-admin-mutation-surface.ts` at the next admin
  DEPLOY.
- The kernel gate is unchanged in behavior; its "no live caller" comment is retired.
