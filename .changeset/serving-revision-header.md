---
"@caisson/kernel": minor
"@caisson/service-license": patch
"@caisson/service-docs": patch
"@caisson/site": patch
"@caisson/admin": patch
"@caisson/demos": patch
---

Report the serving revision on every deployed service.

Each service now answers with an `x-caisson-revision` response header naming the commit its
running image was built from, so "which code is actually live" is one request instead of an
inference from how a route behaves.

The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
build that did not come through that path reports `unknown` rather than guessing.

The header is deliberately not gated behind origin verification: it has to stay readable exactly
when that gate is the thing misbehaving, which is the case it exists to diagnose.
