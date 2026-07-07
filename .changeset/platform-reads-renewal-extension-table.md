---
"@caisson/platform-reads": patch
---

Test-only: provision the new `renewal_extension` table in the updates-window integration setup —
`@caisson/service-license`'s `extendUpdatesWindow` now records a renewal-extension ledger row
(ADR-0251 renewal un-extend), so any suite that exercises it must create the table.
