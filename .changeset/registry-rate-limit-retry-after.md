---
"@caisson/registry": patch
---

Rate-limited registry responses now carry a `Retry-After` header alongside the 429 status, so npm and bun back off and retry instead of failing the install. The edge rate limit is also resized to accommodate a full bundle install burst without tripping.
