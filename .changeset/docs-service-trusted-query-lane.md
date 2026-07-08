---
"@caisson/service-docs": patch
---

`POST /query` now recognizes an authorized caller (a valid Bearer token) and charges it
against a separate, larger rate-limit budget instead of the small anonymous per-IP one.
Many distinct real end-users funneled through a single authorized caller's shared egress
IP (for example, an entire Discord community proxied through one bot) no longer squeeze
into the same tight bucket meant to cap an unauthenticated flood. Every request is still
rate-limited before any expensive work runs — a valid token never exempts a caller from
the gate, it only selects which budget applies. Private package only; no publishable
release.
