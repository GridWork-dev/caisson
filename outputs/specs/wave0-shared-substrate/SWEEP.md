# SWEEP — Wave 0: shared substrate (downstream impact)

Act 5. What else the Wave-0 diff touches: unblocked work, stale docs, queued follow-ups.

## Wave-1 sessions now unblocked

| Session                   | Unblocked by                                           | Consumes                                                                                                                             |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **P2 Compliance (hero)**  | `@caisson/field-crypto` + kernel primitives            | `encryptedColumn`/`TenantFieldCrypto`; `audit-chain` (SEC 17a-4 trail) + `versioning` (supersede-never-mutate) verbatim per ADR-0006 |
| **P5 generator/registry** | registry runtime + cli skeleton                        | `loadRegistryIndexFromFile` + `assertKnownModule`/`assertKnownVersion`; the `GeneratorEngine` seam; `runGeneration` debit seam       |
| **P3/P4 editions**        | the `@caisson/registry` allowlist + the standards gate | publish through the ledger → CI index rebuild (each edition's first gated publish)                                                   |

## Docs reconciled (this diff)

- `registry/README.md` — index now built from `ledger.jsonl`; Worker seam; read path (ADR-0047). ✅
- `SUMMARY.md` — Wave-0 paragraph added. ✅
- `docs/state/decisions-and-forks.md` — ADR-0045–0049 rows + Fork-3 board note. ✅
- New ADRs `ADR-0045..0049`. ✅

## New surfaces (note for future audits)

- **`@caisson/registry` is now a workspace package** — dependents import the schema/allowlist from it
  (not relative paths). The CI `registry-index` job is its byte-identical guard.
- **`registry/index.json` is now git-tracked** (was gitignored) — required for the `git diff` drift check.
- **`registry/worker/` Worker seam** — typed + unit-tested, **NOT deployed**. No published port, no
  loopback bind, no live egress in Wave 0.
- **KMS adapter** — a documented external-sink SEAM (AWS KMS / GCP / Azure / Vault). **No live cloud
  call ships** (CI uses `LocalKmsClient`). When live KMS is wired (P2+), it becomes a real external
  egress sink and must be recorded in the relevant surfaces ledger at that time.

## Queued follow-ups (non-blocking)

1. **Full P5 generation drive** — disk materialization (path-safety re-assert in the writer seam),
   buyer-MCP wiring, topological backfill publish. Seams are in place.
2. **Live KMS wiring** — supply `@aws-sdk/client-kms` (or GCP/Azure/Vault) behind `awsKmsClient`.
3. **CODEOWNERS** — replace the placeholder `@stack-owner` with a real handle + enable branch
   protection (pre-existing TODO; the machine gate — byte-identical rebuild — already bites in CI).
4. **cli `priceCents`** — currently the 4900 placeholder anchor; finalize under the open
   "Pricing numbers" board fork (out of Wave-0 scope).
5. **Compliance edition** should wire `withFieldCryptoContext` alongside `withTenant` (the column's
   ambient tenant context) — documented in `field-crypto/AGENTS.md`.

## No regressions

`bun run check` green · all four ADR-0022 gates green · index byte-identical · no service touched.
