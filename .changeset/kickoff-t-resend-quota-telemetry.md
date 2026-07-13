---
"@caisson/email": minor
"@caisson/service-license": patch
---

Resend quota telemetry + volume-cliff ops alert (Kickoff T deliverability item). The Resend driver
gains an optional `onQuota` observer fed from the `x-resend-monthly-quota` / `x-resend-daily-quota`
response headers on successful sends — Resend exposes no usage API, so these headers are the only
programmatic signal; observer errors never break a send. services/license wires the observer to a
Discord ops alert when remaining monthly quota drops under `RESEND_QUOTA_ALERT_REMAINING` (default
5000, "0" disables), rearming every 6h. Resend's own built-in 80%/100% quota emails remain the
zero-code second layer.
