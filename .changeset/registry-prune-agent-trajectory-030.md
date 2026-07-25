---
"@caisson/registry": patch
---

Prune the last stranded registry version: agent-trajectory 0.3.0 advertised a downloadable
archive that was never uploaded to the registry's storage. Its PR #312 carve-out ("until the
next consume repoints the pins") expired when #315/#317 repointed the agentic-dev and
everything bundle pins to agent-trajectory 0.3.4. Delisted append-only: publish history is
preserved, the version no longer appears in the served catalog, and every currently
installable version is unaffected.
