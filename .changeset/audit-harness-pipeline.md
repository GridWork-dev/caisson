---
---

Internal tooling only, no package release. `@caisson/audit-harness` (private, unsold) gains the ADR-0188
pipeline completion: the scoped `reconcile(previous, current, scope)` correctness fix (out-of-scope
domains pass through — no silent cross-domain false-close), the `--domains` fail-loud CLI, and the pure
enablers (`enumerateSurface` / `selectValidateCandidates` / `summarize`) + `check-scope`/`report`
subcommands. No published package changes, so no version bump.
