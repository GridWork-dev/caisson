---
"@caisson/compliance-core": patch
---

The EU AI Act risk-register evidence collector now runs on the shared risk-register model instead
of its own bespoke shape, with no change to what it reports: an empty register is still unresolved,
and a risk with no treatment plan on record is still flagged. Existing evidence packs are unaffected.
