---
"@caisson/compliance-core": minor
---

Evidence packs can now include external-anchoring proof. When a newest external-anchor receipt
is available, the evidence-pack generator attaches it as a separate archive entry
(`external-anchor-receipt.json`) and labels the pack's evidence grade accordingly in
`auditor-summary.txt`. The signed `manifest.json` body is unchanged either way, so existing
verification is unaffected, and packs without an anchor receipt are still fully valid — external
anchoring is an optional upgrade, not a requirement.
