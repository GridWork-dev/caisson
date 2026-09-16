---
"@caisson/tool-exec": minor
---

Bind two-phase approvals to private one-shot records and revalidate current policy before execution. Legacy hand-built proposals are rejected; the browser preview and run path remain unchanged.

Pending approvals now expire after fifteen minutes and support atomic reject(approvalId) without spawning. Durable approval-store adapters must implement rejection and expiration cleanup.
