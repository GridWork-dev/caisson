---
"@caisson/registry-schema": minor
"@caisson/platform-reads": patch
"@caisson/pricebook": patch
---

Module manifests can now declare `sellable: false` to mark a package that ships only as bundle
substrate and is never sold on its own. The field is optional and defaults to sellable, so every
existing manifest stays valid and unchanged. The shared cross-service read layer and the commerce
price-book are both marked bundle-only.
