---
"@caisson/compliance": patch
---

Wave-6a control-to-code traceability idiom (ADR-0229 row 9) — a convention, not a framework: the
`soc2Tsc` pack export cites its policy ADR (`Control: ADR-0057 …`) in its docstring, and a
`control-traceability` golden exemplar pins the `policyVersion` a control-logic fixture was captured
under. Documented in `docs/compliance/control-traceability.md`. No runtime/schema change; existing
catalog goldens byte-stable.
