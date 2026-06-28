# apps/compliance

The **Compliance edition** reference app (Next.js App Router, ADR-0044) — the P2 exit artifact. A
thin wiring shell (NO dashboard) that composes the green base + P2 primitives and runs the
Compliance leg end to end over a fully **test-doubled** substrate (embedded PGlite, a local WORM
store, derived field keys, an in-memory event sink) — **no live cloud, no network**.

## The leg (`lib/leg.ts`)

1. **Seed + encrypt** — write a SEC/HIPAA field under `withTenantCrypto` (field crypto nested inside
   the RLS tenant scope, ADR-0005/0055); prove it round-trips and a cross-row relocate fails AEAD
   authentication (TM-E).
2. **Lock → WORM** — append an `artifact.locked` event to the append-only audit chain (minting a
   write-once WORM anchor, ADR-0052), record an append-only locked version (ADR-0053), and store the
   artifact under a tenant-scoped WORM key; prove `verifyChain` passes against the trusted anchor.
3. **Emit + validate** — gather real substrate facts (chain integrity, FORCE-RLS posture, WORM
   retention), generate the deterministic control→evidence pack (ADR-0058), validate it against the
   canonical format contract, sign it per-tenant (Ed25519, ADR-0056), and emit an `evidence.generated`
   operational event through the base `EventSink` (ADR-0075).
4. **Block** — prove flag-never-guess: an unresolved control makes generation throw with **no partial
   pack** (TM-K).

The byte-stable evidence manifest is golden-pinned in `lib/__golden__/`.

## Run

- `bun test apps/compliance` — the end-to-end exit-gate proof (`lib/leg.test.ts`).
- `bun run build` — compiles the App Router shell.
- `bun --filter @caisson/app-compliance dev` then `GET /api/leg` — execute the leg and return the
  four exit checks as JSON.

The only un-exercised path is the live S3 / KMS / RFC-3161 transport, by design (the prod backends
sit behind ports; CI runs the doubles).
