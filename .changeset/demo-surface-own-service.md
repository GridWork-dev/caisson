---
"@caisson/demos": minor
"@caisson/site": minor
---

The interactive module demos now ship as their own application instead of being compiled into the
marketing site. They are served from the same address as before — a module page still shows its
demo inline, and nothing about the page's address, security headers, or analytics changes — but the
demos are now built and deployed independently of the site.

The practical effect is that changing a module no longer rebuilds and redeploys the storefront: the
site's internal dependency list drops from 46 workspace packages to 27, and the packages that exist
purely to power a demo move with the demos. A page whose demo is temporarily unavailable now says
so in place of the demo, rather than failing the surrounding page.
