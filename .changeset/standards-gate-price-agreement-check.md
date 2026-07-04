---
"@caisson/standards-gate": patch
---

The standards gate now checks a locked module's registry manifest price against its authoritative
listed price, keyed by package id. A manifest carrying a stale or drifted price now fails the
build before it can ship, instead of the mismatch only surfacing later at checkout. Package names
and version bumps in a changeset header are unaffected by this change; only manifest pricing is
checked.
