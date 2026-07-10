---
"@caisson/local-ai": patch
---

Drop the stale test:live script left behind by the inference carve — the package has no live/
directory, so the empty filter exited 1 and killed the whole live-harness turbo fan-out. The
live transport proofs live in the inference package's own harness.
