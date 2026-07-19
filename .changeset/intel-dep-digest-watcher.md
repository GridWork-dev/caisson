---
"@caisson/service-intel": patch
---

New weekly `dep-digest` watcher: flags stalled Renovate PRs, available toolchain/pinned-dependency
upgrades (including the exact-pinned better-auth session adapter and the native TypeScript
compiler pin), and new bun releases, holding a bump for a short window after publish before
reporting it as actionable. Each finding lists which internal packages depend on the affected
dependency directly. Alerts route through the same Telegram/Linear delivery path production error
findings already use. Private service — versioned, not published.
