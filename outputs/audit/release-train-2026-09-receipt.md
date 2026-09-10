# S8 release train receipt — HOLD, 2026-09-10

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`.

Entry prerequisites passed from the landing and T39 completion receipts. Local HEAD and the live remote main advertisement both name `e2116849082f57c1d5fdaf6b309086813f48e4f4` (Caisson #475).

Execution stopped during task-1 discovery: a read-only `rg` invocation returned exit 2 because `apps/site/app/api/health` does not exist. The brief requires stopping on any unpredicted result. Exact command, diagnostic, and continuation scope are in `RUN-NOTES.md`.

| Required evidence | Result |
|---|---|
| Live rate-limit key, before | NOT MEASURED |
| Live rate-limit key, after | NOT MEASURED; no fix made |
| Rate-limit mutation test | NOT RUN |
| R212 folds | NOT ASSESSED; branches preserved |
| Published version | NO RELEASE CUT |
| Release gate verdicts and readiness count | NOT RUN / NOT DERIVED |
| Tarball count | NOT DERIVED |
| R2 parity | NOT MEASURED |
| Mirror sync | NOT RUN |
| Worker redeploy from tag | NOT RUN |
| Rescan cron and first firing | NOT IMPLEMENTED / NOT DERIVED |
| Consumers moved off the pre-fix line by this run | NONE |

No product code or workflow was changed. No commit, PR, merge, tag push, package publication, deploy dispatch, or branch deletion was performed. The session-wrap `bun run sot` was not run because the brief's stop condition had fired; no green-gates or completion claim is made.
