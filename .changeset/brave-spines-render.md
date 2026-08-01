---
"@caisson/oscal-spine": minor
"@caisson/frameworks-pack": minor
"@caisson/compliance-core": patch
"@caisson/site": patch
---

Both packages gain a browser-safe `./browser` entry point: the contracts and vocabulary, the
crosswalk model, the catalog pin, the control model with all three framework packs, and the pure
catalog and assessment-plan exporters can now be imported inside a client bundle. The main entry
is unchanged and keeps the full node-capable surface; every browser-entry export is also
available there. As part of this, the catalog and assessment-plan exporters' default id generator
now uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto
module — the same UUID format, and any injected `newId` seam behaves exactly as before — and
both packages now declare a Node 20.12 minimum. Consumers of the compliance-core re-export
receive the same default-id change.
