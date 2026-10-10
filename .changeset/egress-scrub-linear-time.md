---
"@caisson-sh/kernel": patch
---

`scrubForEgress` and `looksLikeSecret` now run in linear time. Text with a long run of ordinary
characters, such as a megabyte of base64, took over a minute to scrub; it now takes milliseconds.
The same spans are redacted as before.
