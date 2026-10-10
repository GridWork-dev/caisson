---
"@caisson-sh/kernel": patch
---

Event redaction now runs in linear time. A string attribute holding a long run of newlines, or many
SQL verbs with no clause keyword after them, used to take quadratic time to check for stack frames
and SQL statements. The same values are redacted as before.
