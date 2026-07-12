---
"@caisson/everything": patch
---

Drop the three dissolved-edition meta pins (@caisson/agent-dev, @caisson/ai-kit,
@caisson/local-ai) from the Everything members map. The ids were delisted 2026-07-07, are
filtered from entitlement expansion by the index allowlist, and can never resolve on the
served registry surface — the new CAISSON-86 coverage pin gate would fail the next version
cut on them. Buyer entitlements are unaffected: tokens sign purchased ids, and legacy-id
aliasing is claim-side.
