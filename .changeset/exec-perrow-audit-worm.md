---
"@caisson/audit-worm": minor
---

Per-row proof reads on the WORM-anchored audit chain (per-row-verification-ui, forks ADR-0344).
`AuditChainStore.getRowProof(accountId, seq)` returns a single row plus the per-length WORM anchor
minted when it was the tip (`anchor(seq+1)`), so `anchor(seq+1).tipHash === row.hash` is a genuine
per-row commitment check. One targeted row read and one WORM GET per inspected row (fork f), tenant
scoped through `withTenant`. `seq` is bounded server-side to `0 <= seq < length` (rejects the
truncation-probe boundary), and a missing anchor fails closed to `unverifiable`, never a fabricated
pass.
