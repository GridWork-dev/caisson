---
"@caisson/billing-orchestration": patch
---

Fix the Paddle simulator live proof for an upstream API drift: a notification setting must now
opt in with `traffic_source: "simulation"`, or simulation runs abort against it with
"Notification setting cannot be used for 'simulation' traffic". Live-test-only change — no
runtime code path is affected.
