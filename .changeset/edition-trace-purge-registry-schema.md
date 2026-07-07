---
"@caisson/registry-schema": patch
---

Edition-trace purge (ADR-0270): narrow the purchased-id alias spine to nothing-but-the-mechanism. The
four dissolved edition ids (`ai-kit`/`local-ai`/`agent-dev`) and the legacy `bundle` "buy-everything"
sentinel are removed from `LEGACY_ENTITLEMENT_ALIASES` (zero real buyers hold them) and the `BUNDLE_ID`
export is deleted. The edition→bundle INDEX-resolution relation moves to the decoupled `EDITION_BUNDLE_ID`
map so `expandEntitlements` still folds the historical `kind:"edition"` meta-packages' members into a
canonical bundle purchase — every live-index and offline-token member set is byte-identical. The single
`normalizeEntitlementId` alias point and the read-side `entitlementIdAliasGroup` are kept (now empty) for
the next module rename. `legacyEditionNamesFor` is newly exported (additive) so the generator's edition-pin
resolver reads the same decoupled edition→bundle relation. No public value behavior changes for the
six-bundle vocabulary; a dissolved edition id now resolves only to its still-served meta package (a
fail-safe under-grant), never over-grants.
