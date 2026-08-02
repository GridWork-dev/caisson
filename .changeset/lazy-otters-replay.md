---
"@caisson/agent-trajectory": minor
"@caisson/site": patch
---

agent-trajectory gains a browser-safe `./browser` entry point: the strict event schema, the
in-memory append-only store, the run-state port with its in-memory implementation, both
deterministic projections, and the Claude transcript adapter can now be imported inside a client
bundle, so a dashboard can replay and validate a trajectory in the browser. The main entry is
unchanged and keeps the full surface, including the two Postgres-backed stores, and every
browser-entry export is also available there. The site's replay interactive demo now runs that
real code end to end instead of a hand-maintained copy.
