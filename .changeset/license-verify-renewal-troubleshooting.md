---
"@caisson/license-verify": patch
---

Document what a license key stopping actually looks like, and the three things that cause it.

The README explained the fail-safe-to-community mechanism but never named the symptom a buyer
searches for. It now covers the common case — a renewal that never reached the process, since
verification reads the token it is handed — alongside an elapsed expiry and a major-version
boundary, and says how to tell the three apart. Behaviour is unchanged; this is documentation.
