---
"@caisson/demos": patch
---

Bind the demos standalone server dual-stack. The IPv4-only bind copied from the public-edge apps refused every connection arriving over the platform's IPv6-only private network, so the site's demo rewrite answered 500; `HOSTNAME=::` lets both the private mesh and the container healthcheck reach the server.
