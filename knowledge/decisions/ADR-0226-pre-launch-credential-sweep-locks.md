# ADR-0226 — pre-launch credential sweep: four fork locks

**Status:** accepted · 2026-07-02 (third picker round of the day, operator-locked).
**Relates:** SPEC `outputs/specs/pre-launch-credential-sweep/SPEC-pre-launch-credential-sweep.md`
(the draft whose four-fork section this locks) · **ADR-0224 F6** (`~/.gridwork/caisson.env`
is the launch credential SOT the runtime + live-harness read and assert parity against; the
1Password vault is the durable recovery store, not the SOT — unchanged here) · **ADR-0106**
(the license issuer keypair provisioned in dev — Fork 1 regenerates it for launch) · relates
ADR-0201 / ADR-0221 (WORM + KMS live-proof prover creds the sweep re-scopes), ADR-0222
(public `@caisson-sh/*` npm scope, mirror-owned publishing — the npm-token scope-tightening
rides this sweep), ADR-0069 (publish auth = ephemeral `GITHUB_TOKEN`, never stored, never
rotated).

## Context

The pre-launch credential sweep regenerates every rotatable credential as a scoped-only key
and keeps the launch set in one 1Password vault kept in name-level parity with the env
files. Two credentials (`OPENROUTER_API_KEY`, `DISCORD_TOKEN`) were pasted into chat
sessions and one GH secret (`MIRROR_PUSH_TOKEN`) into a transcript — live exposures
regardless of launch timing — and the account-wide npm login token must become a
`@caisson-sh`-scoped automation token before the mirror publishes publicly (ADR-0222). The
SPEC (names-only; no secret value appears in it or in anything it spawns) inventoried the
~19 rotatable credentials and left four operator forks: whether to regenerate the license
issuer keypair, where the vault-parity tool lives, vault item granularity, and the
post-launch rotation cadence. All four are locked here. Every value-handling step (minting,
entering, revoking) stays operator-only; the parity tool + its test are the agent-buildable
pieces and handle names/titles/timestamps exclusively.

## Decision (four forks, operator-locked)

- **Fork 1 = a (Recommended). Regenerate a fresh license Ed25519 issuer keypair at launch.**
  Zero prod licenses have been issued (pre-launch, Paddle sandbox), so the blast radius is
  nil today and non-zero after the first sale; minting the launch keypair clean gives full
  rotation provenance from license #1. The public half is **re-baked into the registry
  Worker in the same act** (the offline-Ed25519 entitlement filter verifies against the
  baked pubkey), so no window opens where the issuer signs under a key the edge cannot
  verify.
- **Fork 2 = a (Recommended). The vault-parity tool lives at
  `tooling/scripts/vault-parity-check.ts`.** Colocated with the existing
  `tooling/scripts/railway-env-sync.ts` (the identical read-only, names-only,
  `~/.gridwork/caisson.env`-anchored contract — reuse the pattern, don't invent a home). It
  reads vault item titles + `updated_at` via `op item list` and env-var NAMES via grep,
  **never sources the env file, never reads or prints a value**, and exits non-zero on any
  name-level drift.
- **Fork 3 = a (Recommended). One 1Password vault item per env-var NAME, title === name.**
  Exact name-level parity makes the tool's diff trivial and unambiguous (one item per name,
  never grouped-by-service fields). The vault mirrors the whole operational set (secrets +
  tracked config), so a dropped var is caught from either side.
- **Fork 4 = c (OPERATOR OVERRIDE of the spec's Recommended per-class cadence). Rotation is
  ON-INCIDENT ONLY across the board — no scheduled rotation cadence.** The spec recommended
  (b): 90-day SaaS/infra tokens, on-incident-only for the license keypair + DB password. The
  operator locked (c): nothing rotates on a clock; a credential rotates only when an
  incident (a suspected leak, a scope change, a provider breach) forces it.

## Rejected

- **Fork 1 (b) keep the provisioned dev keypair** — saves one step but carries a dev-context
  key into production with no rotation record.
- **Fork 2 (b) a `gw` subcommand** — more discoverable, but adds a caisson-specific check to
  the shared gridwork-core CLI for a one-repo concern.
- **Fork 3 (b) one item per service (grouped fields)** — fewer items to eyeball, but breaks
  1:1 name parity and forces per-field parsing in the tool.
- **Fork 4 (a) 90-day for all tokens** and **(b) per-class (90-day SaaS/infra, on-incident
  keypair + DB)** — both give a compromised-but-unnoticed token a scheduled expiry backstop.
  The operator rejected both for the simpler on-incident-only posture (see Consequences).

## Consequences

- **Fork 4 is honestly the weakest posture of the three options, and the operator accepted
  it explicitly.** On-incident-only rotation means a token that is compromised but never
  noticed has **no scheduled expiry backstop** — it stays valid until an incident surfaces
  it or a provider forces a change. The (b) per-class cadence would have capped a silent
  SaaS/infra token's exposure at 90 days; (c) removes that cap. The trade accepted: zero
  scheduled-rotation churn (each rotation is an operator value-handling session) against a
  longer worst-case window for an undetected compromise. This is policy, not a technical
  default; it can be tightened later without a code change.
- **Fork 1's same-act pubkey re-bake** makes the launch keypair rotation one coordinated
  step (mint keypair → set signing key → re-bake pubkey into the Worker → deploy), not two
  loosely-ordered ones.
- **The parity tool is a forever-runnable, names-only check** wired into the pre-launch /
  `gw verify` fanout; its one runnable test proves no value string is ever emitted (fixture
  env-name set + fixture `op`-JSON stub → the three diff buckets, no value in stdout).
- **caisson.env stays the SOT (ADR-0224 F6, unchanged).** The vault is the recovery store;
  the parity tool asserts the two name-sets match, but the runtime never reads the vault.
