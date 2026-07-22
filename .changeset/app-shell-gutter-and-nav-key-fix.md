---
"@caisson/ui": patch
---

AppShell's main content region now has its own padding (with a `.cs-shell__bleed` opt-out for full-bleed content), and its sidebar nav items are keyed by label instead of href so a consumer passing duplicate placeholder hrefs no longer trips a React duplicate-key warning.
