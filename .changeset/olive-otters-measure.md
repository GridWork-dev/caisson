---
"@caisson/site": patch
---

The site's page-speed measurement now runs on the current major release of the Web Vitals
library, which adds soft-navigation awareness and reports metrics reliably even while the page
is busy. What the site collects is unchanged — the same five anonymous speed metrics, still
loaded after the page has finished rendering so measurement never slows the page down, and
still cookieless with no visitor profile created.
