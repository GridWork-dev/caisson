---
"@caisson/audit-harness": patch
---

ADR-0188 pipeline completion for the internal (private, unsold) `@caisson/audit-harness`:
the scoped `reconcile(previous, current, scope)` correctness fix (out-of-scope domains pass through —
no silent cross-domain false-close), the `--domains` fail-loud CLI, and the pure enablers
(`enumerateSurface` / `selectValidateCandidates` / `summarize`) + `check-scope`/`report` subcommands.
Private package — versioned locally, never published.
