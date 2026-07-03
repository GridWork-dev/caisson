---
"@caisson/compliance": patch
---

Add a typed regulatory-exemption posture worksheet to the Compliance edition:
`defineExemptionWorksheet` maps a legal exemption's own test elements (e.g. an FTC
endorsement-disclosure requirement) to concrete, checkable rules an AI copy generator's
output must satisfy, each tagged with how it's enforced today (automated guardrail, human
review, or untracked) and an optional human sign-off once a reviewer has actually looked
at it. Every worksheet carries a fixed "not legal advice" disclaimer enforced by the
schema itself, not left to authoring discipline. Ships as a documentation convention and a
validated data shape — it defines no new enforcement gate on its own. A generic,
unsigned FTC endorsement-guide exemplar is included to show the shape filled in.
