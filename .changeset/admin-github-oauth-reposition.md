---
"@caisson/admin": patch
---

Admin sign-in is repositioned onto in-app GitHub OAuth, replacing the edge-only Access
gate as the control-plane's primary auth. Sign-in is restricted to a GitHub
numeric-user-id allowlist — never a username, which is renameable/re-registerable —
enforced both when a GitHub account first links and on every later request, so
narrowing the allowlist takes effect immediately even against an already-signed-in
session. Private package only; no publishable release.
