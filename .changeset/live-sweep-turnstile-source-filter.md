---
"@caisson/site": patch
---

The production route sweep now attributes console errors to their source frame: noise the
Cloudflare challenge platform emits by design (its token probe's expected 401 and its styled
log lines) is dropped by origin URL, while everything from the site's own frames — and every
page error — stays zero-tolerance. The sweep passes 18/18 against production with the
challenge widget armed.
