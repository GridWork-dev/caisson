---
"@caisson/email": minor
"@caisson/platform-reads": minor
---

Commerce-lifecycle email templates and a live updates-window read.

`@caisson/email` gains two registered transactional templates: `purchase-confirmation`
(post-purchase receipt: buyer, order id, per-line labels, integer-cent total, dashboard
link) and `renewal-confirmation` (renewed entitlement lines with their new updates-window
end dates). Both mirror the existing branded layout and coerce through the same
fail-soft template registry.

`@caisson/platform-reads` gains `readUpdatesWindows(tx, accountId)` — the ADR-0255
per-purchased-entitlement updates-window fold (one_time-sourced grants only,
most-favorable bound per id) as a live read for buyer-facing surfaces, mirroring the
license service's `computeUpdatesWindows` semantics without importing its runtime.
