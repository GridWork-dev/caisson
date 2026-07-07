---
"@caisson/ui-pro": patch
"@caisson/everything": patch
"@caisson/registry-schema": patch
"@caisson/standards-gate": patch
---

UI Pro is published to the registry. The ui-pro manifest price is trued to the live catalog
($129 standalone) and its description now covers the full eleven-component set. The Everything
bundle republishes with UI Pro pinned at its real published version instead of the pre-publish
placeholder, so an Everything purchase now installs UI Pro like any other member. The
reserved-id carve-out for ui-pro is removed from entitlement expansion: a ui-pro purchase now
resolves to the real module grant, and the fail-closed rejection of unknown ids applies to it
on any index that does not ship it.
