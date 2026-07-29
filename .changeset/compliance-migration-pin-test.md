---
"@caisson/compliance": patch
---

The migration test suite now proves that every migration file shipped with the compliance modules is listed in the fixed release order, and that the fixed order names no file that has been removed. An unlisted migration would have been free to change position when a later module added one of its own, which reads as tampering to any database that already applied it.
