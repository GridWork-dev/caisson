---
"@caisson/frameworks-pack": minor
---

Adds a fifth compliance crosswalk: NIST SP 800-53 Revision 5.2.0. The full text of the Revision 5
catalog now ships in this package too, vendored verbatim and hash-pinned to a specific upstream
commit, so it's available as an in-repo reference rather than an external claim. A new set of
mapping rows shows which caisson mechanisms genuinely relate to specific 800-53 controls — access
enforcement, audit logging and retention, encryption, monitoring, authentication, and media
sanitization — each capped at the same conservative "maps to" language every other crosswalk in
this package already uses, never an "implements" or "satisfies" claim. This crosswalk carries no
FedRAMP claim of any kind: Caisson holds no ATO and is not FedRAMP authorized, and nothing here
implies otherwise.
