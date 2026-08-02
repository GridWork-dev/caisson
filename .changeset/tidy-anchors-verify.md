---
"@caisson/kernel": minor
"@caisson/site": patch
---

The browser-safe `@caisson/kernel/audit-verify` entry point now covers whole-chain verification,
not just single rows: `buildChainAsync`, `chainEntryAsync`, and `verifyChainAsync` are WebCrypto
twins of the Node chain builders, and `anchorChain` is available there as the same function the
Node side already calls. A client or an offline pack verifier can now check that a chain is the
complete original one, which is the check a cut tail turns on, without pulling the Node crypto
module. The main entry and the Node entry are unchanged in name, shape, and behaviour, and the
twins are pinned byte for byte against the originals. The site's audit chain interactive demo now
runs those real functions end to end instead of a hand-maintained copy.
