---
"@caisson/compliance": minor
"@caisson/agent-dev": minor
"@caisson/auth": patch
"@caisson/field-crypto": patch
"@caisson/audit-harness": patch
---

Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
`@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
get them at the edition price (matches the ADR-0137 below-module-sum reprice).

Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
`@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
(dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.
