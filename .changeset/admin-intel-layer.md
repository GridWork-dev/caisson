---
"@caisson/service-intel": patch
---

New standing operator intelligence daemon: watches compliance-framework updates (NIST OSCAL, EU AI
Act, HIPAA breach portal, AICPA SOC 2), competitor pages, GitHub traction, product analytics
(PostHog + Plausible), and production errors, detecting changes cheaply and deterministically
before any optional LLM enrichment runs. Findings land in a dedicated, additive Postgres schema;
production-error signal routes through the alerting pipeline to the operator's Telegram bridge and
an auto-filed Linear issue. Each watcher is independently runnable via the service CLI as well as
the daemon's own internal scheduler.
