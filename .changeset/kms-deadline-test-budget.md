---
"@caisson/site": patch
---

The test covering the key-management request deadline now allows enough budget for the database preamble before the key unwrap begins. On a loaded machine the old budget could expire while the transaction was still setting up, so the request rejected for the right reason but never reached the key service — the test then failed on an assertion about the abort signal it never got to observe. The behavior under test is unchanged; only the test's own budget moved.
