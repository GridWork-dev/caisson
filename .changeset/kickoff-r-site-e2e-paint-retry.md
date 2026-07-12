---
"@caisson/site": patch
---

Fixes a flaky e2e test: two header-control and carousel-arrow hit-area assertions in
`browser-audit-p1.e2e.test.ts` occasionally read `getBoundingClientRect()` as 0x0 on a slow
CI runner, because `page.goto`'s "load" event resolves before the browser guarantees the
next paint — an evaluate that runs immediately after can see every rect collapsed and drop
every result (`controls.length === 0` on two consecutive main-branch runs on 2026-07-11).
Both evaluates now go through a small bounded-retry helper that reruns the same evaluate up
to four times with a 500ms backoff whenever it detects it read pre-paint geometry, and
otherwise returns immediately; a genuine post-paint failure still fails loudly after the cap.
Test-only change, no product behavior touched.
