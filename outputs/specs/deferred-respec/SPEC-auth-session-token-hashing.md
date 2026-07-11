# SPEC — `apps/site` session token hash-at-rest (harvest lift-sweep #9, future-trigger)

**Status: DRAFT — operator lock required; this SPEC does NOT authorize building.** Unlike the
harvest slice-2 SPEC set (`SPEC-*.md`, all `LOCKED` / build-now), this is a **pre-lock,
future-trigger** SPEC: it defines the build for _when a trigger fires_, tables three operator forks
without pre-deciding them, and is blocked behind a superseding ADR. The two sections that have **no
analog in the post-lock reference set** — `## Trigger (build only when one fires)` and `## Operator
forks` — are intrinsic to a deferred, fork-laden item; they are called out here in the doc rather
than dropped to fit the ready-to-build skeleton. Every other section conforms to the reference order
(Goal → Scope → Design → Tasks → Verify → Effort/Value).

- **Package/app:** `apps/site` (buyer dashboard, `LicenseRef-Caisson-Commercial`) + a new pure-crypto
  helper in `packages/auth` (base, Apache-2.0). No edition/license/tier change.
- **Slice:** harvest lift-sweep item #9, **sub-claim (c) only** — "raw token never stored at rest."
  Sub-claims (a) O(1) indexed lookup and (b) no full-table scan already hold for free (see Design), so
  the delivered value here is narrow and gated.
- **Type:** FUTURE-TRIGGER build (do **not** build proactively). Two mutually-exclusive paths,
  selected by which trigger fires — implement one, never both.
- **Tags:** `auth`, `security`, `secrets`, `data-migration` (the full set fires the security audit at
  SHIP).
- **Sources (rebuild-clean, patterns only):** the `telesis` two-derived-value session pattern is
  replicated as a _pattern only_, never as copied code (CLAUDE.md pro-private firewall).
- **Precondition (binding):** executing this SPEC requires first opening a new ADR that **supersedes
  ADR-0210 §3** (the hash-at-rest defer) and **amends ADR-0015's** "better-auth as-is" framing. Per
  the Caisson one-operator-rule this is an operator-locked fork, never an auto-decision inside a build
  session. As of 2026-07-02 no trigger has fired — the deferral still holds.

## Goal (WHAT + WHY)

Store the buyer session bearer token **hashed at rest** so a Postgres dump alone is not a usable
credential — closing sub-claim (c) of harvest lift-sweep item #9. Today `apps/site` stores the raw
session token against a unique-indexed column (better-auth default); a DB leak hands an attacker a
live cookie value. This SPEC defines the build for **when the trigger fires** — not now. Two of the
item's three sub-claims are already satisfied for free: better-auth defines `session.token` as a
**unique-indexed** column and `findSession` queries it as an exact-match indexed
`findOne({ model:"session", where:[{ field:"token", value:token }] })` — so (a) O(1) indexed lookup
and (b) no full-table scan hold today. Only **(c)** raw-token-never-stored is missing, so the
delivered value here is narrow (the raw-at-rest property only) and gated behind an explicit trigger.

## Trigger (build only when one fires)

Do **not** build proactively. Build only when ONE of ADR-0210 §3's two named triggers fires:

- **Trigger T1 — upstream seam.** better-auth ships a documented session-token hashing / lookup-key
  config option (the shape it already shipped for the _verification_ table: `defaultKeyHasher`
  SHA-256 hashing of the verification identifier, PR #7209, in 1.6.20+). This is the exact pattern
  ADR-0210 §3 names. When it lands for `session.token`, take **Path A** (a config flip, no provider
  fork, ADR-0015 stays intact).
- **Trigger T2 — compliance demand.** A named in-scope framework (SOC 2 / HIPAA / FedRAMP — the
  Compliance edition's targets) files a hash-at-rest-sessions **audit finding**. If T2 fires before
  T1, take **Path B** (the adapter wrap — a genuine provider-fighting change).

Neither has fired: no open better-auth issue/PR proposes session-token hashing (CHANGELOG through
1.6.x / 1.7.0-beta.6, issue search — 2026-07-02), and no compliance finding demanding it exists in
`docs/state/decisions-and-forks.md` or the ADR catalog today.

## Scope

**In:** the raw-at-rest property (sub-claim c) for `apps/site` buyer sessions, delivered through
whichever path the fired trigger selects (Path A config flip, or the Path B adapter wrap with a
dual-read migration). A superseding ADR + operator lock is a hard precondition (Task 0).

**Out:**

- **Building now.** No trigger has fired; this is a future-trigger SPEC only.
- **The EdDSA account JWT path** (`packages/auth/src/jwt.ts`) — the cross-service execution-plane
  seam, already asymmetric-verified; hashing the same-process session cookie does not touch it.
- **`secondaryStorage` (Redis/KV) adoption** — a where-sessions-live toggle, not a hashing seam; a
  bigger footprint change than the ask and heavily sync-bug-tracked upstream. Caisson runs plain
  Postgres sessions and stays there.
- **The magic-link / verification one-time token** — better-auth already hashes it at rest
  (`verification-token-storage` `defaultKeyHasher`); nothing to add.
- **Re-validating (a)/(b)** — the indexed O(1) lookup and no-scan properties already hold; this SPEC
  only preserves them, it does not re-derive them.
- **Lifting the `telesis` reference implementation verbatim** — pro-private source; the
  two-derived-value pattern below is replicated as a _pattern only_, never as copied code.

## Design

Two mutually exclusive build paths, selected by which trigger fired. **Do not implement both.**

**Current wiring (real files — the one attach point).**

- **Pin:** `apps/site/package.json:33` → `"better-auth": "^1.6.23"` (lockfile resolves to exactly
  `1.6.23`; the version ADR-0210 §3 cites).
- **The single construction site:** `apps/site/lib/auth-server.ts` `createAuth()` calls
  `betterAuth({ database, secret, plugins:[magicLink(...)], socialProviders, advanced:{ cookiePrefix,
cookies:{ session_token } } })`. There is **no** `secondaryStorage`, **no** `cookieCache`, **no**
  `databaseHooks` — plain Postgres-backed sessions via the `pg` `Pool` adapter. This is the only place
  better-auth is instantiated, and therefore the only place a wrap can attach (a from-scratch adapter
  wrap either way — no existing hook to lean on).
- **The read path:** `apps/site/lib/auth.ts` `getSession()` → `auth.api.getSession()` →
  `resolveActiveAccount(userId)` (account resolution, ADR-0176). Same-process read; the token WHERE
  clause is entirely inside better-auth's internal adapter, never surfaced here.
- **The contract (ADR-0015):** `packages/auth/src/session.ts` defines `SessionProvider.resolveSession`
  — base code depends only on this interface, never on better-auth directly. Any wrap that imports
  better-auth internals must stay in the `apps/site/lib/*` runtime layer to keep this boundary.
- **Schema ownership:** `packages/auth/src/schema.ts` defines only `account_member` (Caisson-owned).
  The `session` / `user` / `account` / `verification` tables are owned + migrated by better-auth
  itself — Caisson has no schema file to patch for the session table.

### Path A — upstream seam (Trigger T1). Effort: XS.

A pure config change in `apps/site/lib/auth-server.ts` `createAuth()`: adopt whatever
`session.tokenStorage` / hasher option better-auth exposes (modeled on the existing
`verification-token-storage` `defaultKeyHasher`). Zero adapter forking, zero ADR-0015 conflict. If
this path is available, the SPEC collapses to Task A below and the security-audit tags still apply.
**Prefer this path** — it is the reason the item was deferred rather than built.

### Path B — adapter wrap (Trigger T2, no upstream seam yet). Effort: L. The provider-fighting build.

better-auth 1.6.23 has **no** read-side hook: `findSession` runs a direct
`where:[{ field:"token", value:<raw incoming cookie> }]` with no transform before the WHERE clause.
So `databaseHooks.session.create.before` hashing the token on write is a **trap** — a no-op-to-negative:
the hashed column would never match the raw request token on read, breaking every lookup (or, if the
hashed value is also what lands in `Set-Cookie`, delivering zero security benefit since DB and cookie
converge on the same value). **Closing (c) requires owning BOTH the write and the read path.**

Replicate the two-derived-value pattern (pattern only — see Scope/Out):

- **`tokenLookupKey`** = `HMAC-SHA256(rawToken, serverSecret)`, base64url — the **indexed WHERE-clause
  key**. A DB dump exposes this but it cannot be reversed to a forgeable cookie because the HMAC key
  never touches the DB.
- **`tokenHash`** = `SHA-256(rawToken)` — used only for a **constant-time verify-equality**
  (`crypto.timingSafeEqual`) after the indexed fetch, defence-in-depth against lookup-key collision.

Attach at the one construction site by **wrapping the adapter object** passed as `database` in
`createAuth()` — decorate the `session` model's `create` / `update` / `findOne` / `delete` so that:
writes substitute `tokenLookupKey` for the stored token value and persist `tokenHash` alongside;
reads transform the incoming `where` token value to its lookup key before the query, then
`timingSafeEqual(deriveTokenHash(raw), row.tokenHash)` before returning. The pure derivation helpers
(`deriveTokenLookupKey` / `deriveTokenHash` / `verifyTokenHash`) live in a new
`packages/auth/src/session-token.ts` (crypto only, **no better-auth import** — keeps the ADR-0015 base
boundary); the adapter decorator that knows better-auth's query shape lives in `apps/site/lib/*`.

**Ceiling / brittleness (state it plainly):** the decorator couples to better-auth's internal query
shape (`where:[{ field:"token", value }]`). A better-auth minor bump can change that shape and break
session lookup **silently** — this is precisely the coupling ADR-0015 locked "use as-is" to avoid.
The wrap needs a conformance test that fails loudly on any better-auth upgrade that moves the query.

**Column addition.** Declare `token_lookup_key` + `token_hash` via better-auth's
`session.additionalFields` config (its public surface for extending the session table) so its own
migration generator creates them. If that surface cannot carry them, fall back to a Caisson numbered
migration (`@caisson/migrate` / ADR-0014) issuing an `ALTER TABLE session ADD COLUMN ...` against the
better-auth-owned table — a cross-ownership ALTER; flag it in the migration and in the superseding ADR.

**Migration for existing sessions (no forced logout).** A naive cutover logs out **every** signed-in
buyer at deploy (all rows carry raw tokens; the wrap would look up by hashed key and find nothing).
Instead the wrapped `findSession` runs a **dual read** for the drain window: try the `tokenLookupKey`
match first, then fall back to a raw-`token` exact match for pre-migration rows. New sessions write in
the hashed shape immediately; old rows drain naturally as they expire. better-auth's default
`session.expiresIn` is 7 days, so a **7-day dual-read window** fully drains legacy rows, after which
the raw-token fallback (and the raw `token` column) is removed in a follow-up. The dual read is **not
optional** — it is the only thing between the cutover and a silent mass logout.

**New standing secret.** `SESSION_TOKEN_HMAC_KEY` is a new long-lived server secret (`secrets` tag);
rotation invalidates all lookup keys and must drain via the same dual-read window — see Operator
fork 2.

**ADR touchpoints.** ADR-0210 §3 (the defer) **requires superseding** before code lands; ADR-0015
(better-auth as-is) is **amended** by Path B (the internal coupling + its conformance-test guard) and
left **intact** by Path A; ADR-0176 (`account_member`) is **unaffected** — account resolution runs
after session resolution and does not touch the token; ADR-0005 (fail-closed RLS) is **reinforced** by
the construction-time throw on a missing HMAC key; ADR-0014 (numbered migrations) is **realized** by
the column addition; ADR-0133 (harvest program) is **realized** — this flips lift-sweep #9 from
DEFERRED to built (`docs/archive/harvest-program.md:219`).

## Tasks

Path B (the substantive build). Path A collapses tasks 1–5 into **Task A**.

0. **(Precondition, operator-gated — not code.)** Open the ADR superseding ADR-0210 §3 + amending
   ADR-0015's framing; record the operator lock in `docs/state/decisions-and-forks.md`. The ADR must
   also **fix the lift-sweep report pointer**: the source report lives at
   `/home/gw/lab/caisson-lift-sweep-REPORT.md` — one directory above the repo root, not at
   `outputs/research/caisson-lift-sweep-REPORT.md` as `outputs/kickoffs/lift-harvest-buildout.md`'s
   prose implies; copy it into `outputs/research/` or correct the pointer. Verify:
   `test -f knowledge/decisions/ADR-02*-session-token-hashing.md && grep -q "supersedes ADR-0210" knowledge/decisions/ADR-02*-session-token-hashing.md`.
1. `packages/auth/src/session-token.ts` (new) — `deriveTokenLookupKey(raw, hmacKey)` (HMAC-SHA256,
   base64url), `deriveTokenHash(raw)` (SHA-256), `verifyTokenHash(raw, stored)` (`timingSafeEqual`,
   length-guarded). No better-auth import. Export from `packages/auth/src/index.ts`. Verify:
   `bun test packages/auth/src/session-token.test.ts`.
2. `apps/site/lib/session-adapter.ts` (new) — the adapter decorator: rewrite `session` model
   `create`/`update` to store `tokenLookupKey` + `tokenHash`; transform `findOne`/`delete` WHERE token
   → lookup key with a raw-token dual-read fallback; `timingSafeEqual` gate on `tokenHash`. Include the
   conformance assertion that fails on a changed better-auth query shape. Verify:
   `bun test apps/site/lib/session-adapter.test.ts`.
3. `apps/site/lib/auth-server.ts` — wrap `database` with the decorator in `createAuth()`; source the
   HMAC key from env (`SESSION_TOKEN_HMAC_KEY`), **fail-closed** (throw at construction) when the
   feature is enabled and the key is absent — never silently store raw. Declare the two
   `session.additionalFields`. Verify: `bun test apps/site/lib/auth-server.test.ts` (round-trip: a
   created session resolves on the next request AND the raw token value is absent from the stored row).
4. Migration — the `token_lookup_key` / `token_hash` columns via `session.additionalFields`
   generation, or the ADR-0014 fallback ALTER; document the 7-day dual-read drain + the follow-up that
   drops the raw-token fallback. Verify: `bun test apps/site/lib/session-migration.test.ts` (a seeded
   pre-migration raw-token row still resolves during the window; a new row resolves via lookup key; a
   row past `expiresIn` no longer matches the raw fallback).
5. Wire the new env var into the Railway `caisson.sh` service + `~/.gridwork/env`; changeset naming
   `@caisson/auth` (minor). Verify: `bunx changeset status --since=origin/main` and `bun run check`
   green across `packages/auth` + `apps/site`.

**Task A (Path A only, replaces 1–5):** adopt the better-auth session hasher option in `createAuth()`

- its migration; changeset `@caisson/auth`. Verify: `bun test apps/site/lib/auth-server.test.ts` (raw
  token absent from stored row) and `bun run check` green.

## Verify (goal-backward)

Re-ask ADR-0210 §3's intent — _a DB dump alone is not a usable bearer credential_ — against the diff:

- A freshly signed-in buyer's `session` row contains **no** value equal to the raw cookie token; the
  stored `token_lookup_key` is an HMAC keyed by a secret that never touches the DB. (Delivered
  property is sub-claim (c); confirm the indexed lookup is preserved, not regressed to a scan — (a)/(b)
  were already true.)
- Session resolution still works end to end: sign in → `getSession()` returns the same
  `{ userId, accountId, role }` as before, through the wrapped adapter, with no measurable extra round
  trip on the read path.
- **Migration:** a session issued _before_ deploy still resolves for the full `expiresIn` window (no
  mass logout); a session issued _after_ resolves via the lookup key; the raw-token fallback stops
  matching once rows expire.
- **Fail-closed:** with the feature enabled and `SESSION_TOKEN_HMAC_KEY` absent, `createAuth()` throws
  at construction — never falls back to storing raw.
- **ADR-0015 boundary intact:** `packages/auth/src/session-token.ts` imports no better-auth symbol
  (`grep -L "better-auth" packages/auth/src/session-token.ts` matches); the provider coupling is
  confined to `apps/site/lib/*`, guarded by the Task 2 conformance test.
- `bun run check` green; the standards-gate license split unviolated (`packages/auth` stays base).

## Operator forks (do NOT auto-decide)

Three operator locks. None is pre-decided here (Caisson one-operator-rule); recommendations carry
confidence + evidence, then wait. The lock is recorded as the superseding ADR (Task 0). This section
has no analog in the post-lock reference SPECs — it is the crux of a pre-lock, future-trigger item.

**Fork 1 — whether/when to build (the gating decision).**

| Option                                                                  | Tradeoff                                                                                           | Recommendation                                                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Hold the defer; build only on Trigger T1 (upstream seam), Path A** | Waits on better-auth; XS build; zero provider fight                                                | **Recommended** — the deferral holds as of 2026-07-02; the item's value is narrow ((a)/(b) already satisfied) and Path A is nearly free |
| B. Build the adapter wrap now (Path B), proactively                     | Defense-in-depth today, but provider-fighting for a marginal delta on an already-O(1)/no-scan path | Not recommended (matches ADR-0210's Rejected "build auth #9 anyway")                                                                    |
| C. Build Path B only on Trigger T2 (a named compliance finding)         | Deferred until a real audit demand; then unavoidable                                               | The conditional path — operator locks if/when T2 fires                                                                                  |

**Fork 2 — HMAC key home + rotation (Path B only).**

| Option                                                                                         | Tradeoff                                                                                          | Recommendation                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **A. Dedicated `SESSION_TOKEN_HMAC_KEY` env secret (`~/.gridwork/env` + Railway service env)** | One more secret to manage; rotation invalidates lookup keys (drain via the same dual-read window) | **Recommended** — mirrors the existing `BETTER_AUTH_SECRET` pattern; independent rotation |
| B. Derive via HKDF from `BETTER_AUTH_SECRET`                                                   | No new secret to manage                                                                           | Couples session-token rotation to the whole auth secret's rotation                        |
| C. Per-tenant KMS/CMK                                                                          | Strongest isolation                                                                               | Over-engineered for a single shared session cookie; rejected                              |

**Fork 3 — existing-session migration posture (Path B only).**

| Option                                                                  | Tradeoff                                                              | Recommendation                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **A. 7-day dual-read window (`session.expiresIn`), zero forced logout** | Slightly larger wrap (dual read + a later fallback-removal follow-up) | **Recommended** — no buyer is logged out; legacy rows drain naturally |
| B. Hard cutover (force logout all buyers at deploy)                     | Simpler wrap                                                          | Logs out every signed-in buyer; rejected                              |

## Effort / Value

**Path A: XS** (a config flip). **Path B: L** (adapter wrap + migration + dual-read + a security-audit
gate at SHIP; `auth`+`security`+`secrets`+`data-migration` tags fire the security audit). **Value: LOW
today** — (a)/(b) already hold, only raw-at-rest is missing — **rising to HIGH only under a compliance
mandate (Trigger T2).** Build nothing until a trigger fires and the operator locks the supersede.
