---
"@caisson/site": patch
---

Login and dashboard pages no longer throw hydration errors caused by edge-injected
analytics scripts: the web-analytics site is now managed declaratively with auto-injection
disabled, so the rendered page matches what the server sent. Module pages gain annotated
walkthroughs of their real source snippets, the agentic-dev page documents the MCP tool
discovery sequence, and the /ui gallery renders from the shared component demo registry
instead of a hand-maintained copy.
