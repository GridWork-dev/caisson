---
"@caisson/compliance-core": minor
---

External-anchoring grade tagging (SPEC external-anchoring §6, ADR-0332/0346): the evidence-pack
generator optionally attaches the newest external-anchor receipt as a DETACHED archive entry
(`external-anchor-receipt.json`) plus a grade tag on the result envelope, and renders the honest
grade phrase in `auditor-summary.txt`. The canonical `manifest.json` body is untouched (byte-stability
and the golden fixture preserved), the receipt carries a non-deterministic TSA token so it never
enters the signed body, and absence of a receipt is not an unresolved-evidence gap (anchoring is
buyer-optional). New dependency-free `evidence/external-anchor.ts` module.
