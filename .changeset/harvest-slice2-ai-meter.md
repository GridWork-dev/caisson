---
"@caisson/ai-meter": minor
---

Pre-call MinHash/LSH dedup-before-meter gate (ADR-0217): new `src/dedup.ts` (`normalizePrompt`,
`shingle`, `computeMinHashSignature`, `lshBands`, `jaccardEstimate`, `createInMemoryDedupStore`,
`checkDedupGate`), all exported from `index.ts`. `reserve()`'s idempotency only catches a literal
`callId` retry — this detects a near-identical prompt (an agent loop rewording a retry, a re-asked
question) BEFORE the price-book estimate/debit, so a caller (ai-kit gateway, agent-runner,
support-bot) can choose to skip or reuse instead of paying twice. Detection only — no auto-skip,
no policy enforcement, zero wallet movement (`dedup.ts` imports nothing from `@caisson/credits`).
Zero edits to `meter.ts`/`schema.ts`/`breaker.ts`/`pricebook.ts` beyond a one-line JSDoc pointer on
`reserve()`; no new dependency, no new Postgres table/migration, no manifest change.
