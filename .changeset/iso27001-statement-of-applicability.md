---
"@caisson/frameworks-pack": minor
"@caisson/compliance-core": minor
---

Adds an ISO/IEC 27001:2022 Statement of Applicability generator. A new pure function turns
the shipped ISO 27001 crosswalk plus a per-control evidence-status map into applicability
rows (control, applicable, justification, status, evidence pointer); a control with no
crosswalk row is always marked unresolved rather than guessed. The rows can be rendered
into an OSCAL component-definition document, validated against the official schema, and
attached to a generated evidence pack as an additional, clearly separated section that
never changes the pack's existing signed contents.
