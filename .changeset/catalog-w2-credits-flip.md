---
"@caisson/cli": minor
"@caisson/credits": minor
---

W2 catalog rework (ADR-0249 G5, ADR-0252): the cli codegen debit is decoupled behind a required `DebitFn` injection port (`GenerationDeps.debit`; `@caisson/credits` moves to devDependencies and off the manifest), and `@caisson/credits` flips commercial at $149 (tier `paid`, priceCents 14900, `LicenseRef-Caisson-Commercial`).
