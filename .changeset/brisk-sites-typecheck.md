---
"@caisson/site": patch
---

The site now generates its content and route types before running the TypeScript gate, and app
directory unit tests run as part of the normal test suite. Existing test fixtures were repaired so
the stricter gate checks the complete site surface without widening its browser API baseline.
