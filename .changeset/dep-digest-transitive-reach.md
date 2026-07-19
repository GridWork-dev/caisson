---
"@caisson/service-intel": patch
---

`dep-digest` watcher: buyer-impact packages now split into direct vs transitive-only. A
dependency bump finding used to list only packages that declare the affected dependency in their
own manifest; it now also resolves `bun.lock` to find packages that only pull the dependency in
through another internal package or a resolved third-party package, and lists those separately.
If the lockfile lookup fails for any reason, the finding falls back to the direct-only list with
a note, so the watcher never drops a finding over it.
