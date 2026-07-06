---
"@caisson/registry-schema": minor
"@caisson/mcp-server": patch
---

Adds the ADR-0257 bundle vocabulary spine: a new additive "bundle" module kind (historical edition entries stay valid), the shared BUNDLE_IDS constant plus the legacy-purchased-id alias map with normalizeEntitlementId, and resolve-time alias normalization at the single entry point inside expandEntitlements — legacy edition and bundle-sentinel purchase ids keep resolving to the identical leaf sets forever, and a kind:"bundle" index entry expands via its members map exactly like an edition. The mcp-server change is test-only coverage of the alias and bundle paths through the generate gate.
