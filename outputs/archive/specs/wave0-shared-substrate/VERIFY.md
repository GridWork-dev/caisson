# VERIFY — Wave 0: shared substrate (goal-backward)

Act 4. Re-asks the SPEC's stated goal against the merged diff + tests — not a task checklist.

## Goal restated

Build the shared substrate that gates the four Wave-1 editions: field-crypto, registry runtime,
cli/generator skeleton, kernel primitives — green through the existing `tooling/` gate.

## Did the code achieve the goal? — PASS

| Goal claim                                                                  | Evidence (run + read)                                                                                | Verdict |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| field-crypto derives distinct per-tenant keys                               | `derive.test.ts` (distinct tenant/kv → distinct key); `isolation.integration.test.ts` (A≠B)          | ✅      |
| cross-tenant decrypt FAILS (boundary = RLS boundary)                        | `isolation.integration.test.ts` on PGlite/withTenant: B can't SEE (RLS) nor DECRYPT A's envelope     | ✅      |
| a v1 ciphertext still decrypts after rotation to v2                         | `isolation`/`column`/`kms` rotation tests                                                            | ✅      |
| cipher authenticates (tamper + AAD-mismatch throw)                          | `cipher.test.ts` (tamper ct/tag, AAD tenant+column mismatch, wrong key)                              | ✅      |
| envelope self-describing; unknown ver/alg throws                            | `envelope.test.ts` + golden                                                                          | ✅      |
| index provably CI-built (byte-identical rebuild)                            | `build-index.test.ts` + `git diff --exit-code registry/index.json` green; CI `registry-index` job    | ✅      |
| generator rejects unknown id+version BEFORE any path/subprocess             | `generate.test.ts` (spy engine never called on bad id/version); `meter.integration` (no debit/write) | ✅      |
| codegen debit fires before any write; 402 writes nothing; retry debits once | `meter.integration.test.ts` (debit→write order, 402 spy.calls=0 + empty ledger, idempotent retry)    | ✅      |
| audit chain verifies + detects a break                                      | `audit-chain.test.ts` (tamper/reorder/drop/hash → brokenAt)                                          | ✅      |
| `@caisson/...` parses, `@stack/...` rejected                                | `module-id.test.ts`                                                                                  | ✅      |
| all four ADR-0022 gates green                                               | `bun run check` + standards-gate (0 err) + eslint . + depcruise (0 viol)                             | ✅      |
| all golden fixtures matched BLESS unset                                     | envelope · derive-kat · built-index(file) · generated-fileset · audit-chain · version-chain          | ✅      |
| each new fork → append-only ADR + board row; no locked ADR edited           | ADR-0045–0049 + board rows; Fork 3 → board note                                                      | ✅      |

## Gaps / follow-ups (non-blocking, by design)

- Full P5 generation drive (disk write + buyer MCP + topological backfill) — out of Wave-0 scope; seams shipped.
- Live KMS wiring (AWS/GCP/Azure/Vault) — `awsKmsClient` is a documented seam; CI uses `LocalKmsClient`.
- CODEOWNERS uses the placeholder `@stack-owner` (pre-existing TODO) — branch protection is the operator's to enable.

## Verdict: PASS — proceed to SWEEP + SHIP. (PR open + CI green is the remaining exit item.)
