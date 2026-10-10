---
"@caisson-sh/observability": patch
---

`scrubPath` now checks a path segment for the email shape in linear time. A long segment with many
dots that was almost an email address used to take quadratic time. The same segments are replaced
with `:id` as before.
