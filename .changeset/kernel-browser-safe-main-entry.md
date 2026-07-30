---
"@caisson/kernel": minor
"@caisson/frameworks-pack": minor
"@caisson/agent-dev": patch
"@caisson/agent-kernel": patch
"@caisson/ai-kit": patch
"@caisson/alerting": patch
"@caisson/audit-worm": patch
"@caisson/billing": patch
"@caisson/cli": patch
"@caisson/compliance": patch
"@caisson/compliance-core": patch
"@caisson/field-crypto": patch
"@caisson/local-ai": patch
"@caisson/local-inference": patch
"@caisson/mcp-server": patch
"@caisson/migrate": patch
"@caisson/oscal-spine": patch
"@caisson/platform-migrations": patch
"@caisson/risk-register": patch
"@caisson/signing-primitive": patch
"@caisson/admin": patch
"@caisson/site": patch
---

`@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.
