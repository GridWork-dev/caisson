---
"@caisson/registry": patch
---

The published module catalog can now retire an individual version without touching the rest of that module's history: a superseded release whose downloadable package is no longer available is quietly excluded from what the registry advertises, while every other version of that module keeps installing normally. A new command-line tool applies this in bulk from a plain list of module-and-version pairs, defaults to previewing what would change before writing anything, refuses to retire a version that is still the one buyers currently install, and skips a pair automatically if it was already handled on an earlier run. A maintenance tool that re-uploaded older package archives to storage has been removed; retiring an unavailable version from the catalog is now the supported way to resolve one.
