---
"@caisson/standards-gate": patch
---

The standards gate now checks every pending changeset's release note before it can merge. A
changeset body ships verbatim into the target package's public changelog, so the gate rejects
internal shorthand, references to numbered internal documents, and repo-internal directory
paths before they can reach a published changelog. Package names and version bumps in the
changeset header are unaffected; only the written description is checked. An empty changeset
still passes.
