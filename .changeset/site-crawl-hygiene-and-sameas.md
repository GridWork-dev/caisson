---
"@caisson/site": patch
---

Site crawl hygiene and a corrected identity claim.

The root JSON-LD advertised the development repository as a `sameAs` identity surface. That
repository is private, so the URL returns 404 to any anonymous crawler and the claim was broken
rather than merely weak. It now points at the public organization page, which resolves, and a
pinning test keeps it from drifting back.

Crawl rules keep robots off the authenticated walls, and the orphaned demo route is now reachable
from the sitemap instead of being published with no inbound path.
