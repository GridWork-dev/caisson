---
"@caisson/cli": patch
---

Edition-trace purge (ADR-0270): the generator is now six-bundle-only. `--edition` input is read off the
registry-schema alias spine, which ADR-0270 emptied, so the dissolved edition names (`ai-kit`/`local-ai`/
`agent-dev`/`bundle`) are no longer accepted — the input set is exactly the six canonical bundle ids
(`compliance`/`ai-production`/`local-first`/`agentic-dev`/`provenance`/`everything`). No code change to the
seam (it self-narrows off the spine); a future module rename plugs into the same single point.
