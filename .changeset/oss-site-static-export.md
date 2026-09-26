---
"@caisson/site": minor
"@caisson/demos": minor
---

caisson.sh stops selling and ships as a static export. The cart, checkout, sign-in, buyer dashboard, plans, compare, stack fit, glossary and design-partner pages are gone, and every price is removed. The marketplace is now a demonstration gallery: each module links to its docs and to the module page that runs its live in-browser demo. The site and demos no longer build container images. The interactive demos export statically under /demos and ship inside the same site build, and security headers and redirects now ship as static `_headers` and `_redirects` files.
