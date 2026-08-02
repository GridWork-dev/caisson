---
"@caisson/alerting": minor
"@caisson/retention-runner": minor
"@caisson/site": patch
---

Both packages gain a browser-safe `./browser` entry point. For alerting that is the event contract,
dedup, rate-cap, quiet hours, the delivery port with its isolation wrapper and capture driver, the
audit port with its in-memory driver, and `processAlert` itself — everything except the five
network delivery drivers, which stay on the main entry because a browser cannot hold a webhook
signing secret. For retention runner it is the request contract, the erasure-target port with all
three reference drivers, the audit-sink port with its in-memory driver, and `runErasure` itself —
everything except the recurring-sweep scheduling helpers. The main entry of each package is
unchanged and keeps the full surface, and every browser-entry export is also available there.

Internally, alerting's delivery port, its per-channel isolation wrapper, and the capture driver move
into their own module so the orchestrator no longer pulls the network drivers in behind it. Every
public export keeps its name and shape.

The alerting and retention-runner interactive demos on the site now run the shipped packages end to
end instead of hand-maintained copies, so what the demo does is what the code does — including the
erasure request validation the copy left out.
