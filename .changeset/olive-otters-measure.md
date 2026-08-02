---
"@caisson/site": patch
---

The site's page-speed measurement now runs on the current major release of the Web Vitals
library, including reliable reporting while the page is busy and a compatibility fix for browsers
that disable PerformanceObserver. What the site collects is unchanged — the same five anonymous
speed metrics, still loaded after the page has finished rendering so measurement never slows the
page down, and still cookieless with no visitor profile created. Per-route soft-navigation
reporting remains off so each document still produces at most one batch.
