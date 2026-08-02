---
"@caisson/prompt-registry": minor
"@caisson/site": patch
---

The prompt registry gains a browser-safe `./browser` entry point: `name@version` and `name@alias`
addressing plus the injection-safe render boundary and its strict variable schemas can now be
imported inside a client bundle. The registry functions and the schema stay off that entry
deliberately, each one takes a tenant executor and runs SQL, so fail-closed tenant isolation stays
on the server. The main entry is unchanged and keeps the full surface; every browser-entry export
is also available there. The site's prompt-registry interactive demo now runs that real addressing
and versioning logic instead of a hand-maintained copy.
