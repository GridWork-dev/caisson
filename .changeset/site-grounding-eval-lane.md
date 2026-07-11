---
"@caisson/site": patch
---

The Ask-AI grounding probes (insufficient-context sentinel, injection leak-guard, and
citation-fidelity checks across both answer lanes) now also run in the dedicated `eval`
task, so the AI-regression lane covers the site's grounded-answer pipeline directly.
