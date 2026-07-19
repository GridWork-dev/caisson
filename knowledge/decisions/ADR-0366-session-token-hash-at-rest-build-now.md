# ADR-0366 — Session-token hash-at-rest: BUILD NOW (Path B), dedicated key, hard cutover

- **Date:** 2026-07-19 (operator picker, wave follow-up sitting)
- **Status:** Accepted (operator-locked)
- **Supersedes:** ADR-0210 §3 (the "auth lift-sweep #9 DEFERRED" lock) in full; amends
  ADR-0015 ("better-auth as-is") narrowly — the adapter WRAP below is the sanctioned
  deviation, everything else about the provider posture stands.
- **SPEC:** `outputs/specs/deferred-respec/SPEC-auth-session-token-hashing.md` (its Task 0
  named this ADR as the build precondition; its triggers are overridden by this lock).

## Locks

1. **Fork 1 — BUILD NOW (Path B, operator override of the SPEC's hold recommendation).**
   Session tokens are stored as HMAC-SHA-256 lookup keys at rest; the raw token never
   lands in the database. better-auth 1.6.23 has no config seam, so the build wraps the
   provider's database adapter (the SPEC's Path B) — accepted provider-fighting cost.
2. **Fork 2 — dedicated `SESSION_TOKEN_HMAC_KEY`** (new env secret: `~/.gridwork/env` +
   the Railway site service env + the launch vault), mirroring the `BETTER_AUTH_SECRET`
   pattern; independently rotatable.
3. **Fork 3 — HARD CUTOVER** (operator override of the dual-read recommendation): at
   deploy, legacy raw-token rows are dropped/invalidated and every signed-in session ends.
   Accepted because pre-launch there are no real buyer sessions to preserve; the simpler
   wrap ships without a dual-read fallback or a removal follow-up.

## Consequences

- Tags at SHIP: `auth` + `security` + `secrets` (fable audit mandatory); `data-migration`
  applies in the destructive-cutover form (the migration drops/invalidates legacy rows —
  documented, not reversible, sanctioned by lock 3).
- The operator provisions `SESSION_TOKEN_HMAC_KEY` before the deploy that arms the wrap
  (fail-closed: absent key = auth refuses to start, never a silent raw-token fallback).
- A future better-auth native seam (the SPEC's Trigger T1) supersedes the wrap when it
  ships — revisit then, keep the key.
