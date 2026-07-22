---
"@caisson/email": patch
---

Visual-audit tail sweep on the transactional templates: order ids, license
tokens, and CLI commands inline in body prose (e.g. `bunx @caisson-sh/cli@latest`,
a Paddle order id) now render through new `EmailMono`/`EmailLink` helpers on
`EmailLayout` instead of unstyled plain text, and the EULA URL spelled out in
several templates is now a real link. `waitlist-welcome` now passes its own
accurate `footerNote` (it's a growth send, not a transactional one). Em-dash
sweep (ADR-0080) across every template's body copy.
