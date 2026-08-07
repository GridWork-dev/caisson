---
"@caisson/site": patch
---

The guardrails and local-inference interactive demos now execute the shipped browser-safe package
surfaces instead of maintaining site-local copies. PII handling, moderation decisions, deterministic
embeddings, model-host policy, and egress checks therefore stay pinned to the same code buyers run.
The local-inference demo also stops claiming a metered egress request it never makes — it now reports
zero requests and no recorded usage — and both demos surface a bounded error state instead of an
indefinite spinner when the in-browser guard or embedding computation fails.

Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
taken from a base that predated the merge, so this changeset records the bump only.
