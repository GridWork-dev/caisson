---
"@caisson/site": patch
"@caisson/observability": patch
"@caisson/signing-primitive": patch
"@caisson/ui": patch
"@caisson/registry": patch
---

Routine non-major dependency refresh: the OpenTelemetry SDK/instrumentation line moves to its
current minor, Playwright takes a patch, and the Storybook, Vite, wrangler, noble-curves, and
better-auth pins stay at their prior versions because the newer releases have not yet cleared the
seven-day release-age floor. No API or behavior changes in any package.
