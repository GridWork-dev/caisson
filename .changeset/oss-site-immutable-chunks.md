---
"@caisson-sh/site": patch
---

Content-hashed build output under /_next/static/ is served with a one-year immutable cache header, so repeat visits stop revalidating every script and stylesheet.
