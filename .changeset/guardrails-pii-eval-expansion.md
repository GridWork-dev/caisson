---
"@caisson/guardrails": patch
---

The PII eval baselines cover more real-world shapes: per-class detector variants
(parenthesized and country-code phone formats, dash-separated and 15-digit Luhn-valid
cards, plus-tagged subdomain emails) on the must-redact side, and more must-not-redact
negatives (Luhn-invalid card-shaped numbers, TLD-less email shapes, separator-less digit
runs) pinning the detector's false-positive behavior. The PII evals also join the dedicated
`eval` task, so the AI-regression lane exercises them directly.
