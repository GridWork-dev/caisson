---
"@caisson/compliance": minor
"@caisson/ai-kit": minor
"@caisson/observability": minor
"@caisson/pricebook": minor
---

Edition seam-completion (ADR-0179..0185).

- `@caisson/compliance`: OSCAL export lifted to v1.2.2 with a JSON→XML converter path (`oscal-export-xml`)
  and NIST-conformant SAR + POA&M output across all three frameworks (SOC2/HIPAA/EU-AI-Act) — finding
  status carries a constrained token + `remarks`, POA&M satisfies the `poam-items` min-1 XSD rule with a
  truthful "no open items" entry rather than a fabricated gap, and the root `props` block is dropped. Adds
  the AI-risk-register + field-crypto-policy collectors.
- `@caisson/ai-kit`: BYOK key resolver (free-tier + edge-safe).
- `@caisson/observability`: manual Bun-OTel request spans (`request-span`).
- `@caisson/pricebook`: seam action export.
