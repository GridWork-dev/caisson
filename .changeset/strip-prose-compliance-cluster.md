---
"@caisson/compliance": patch
"@caisson/audit-worm": patch
"@caisson/retention-runner": patch
"@caisson/alerting": patch
"@caisson/email": patch
---

Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
internal build-phase shorthand, and bare specification-id citations that had leaked into
shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
match the shipped code. No runtime behavior changed in any package — documentation and
comments only.
