# S8 release train receipt — IN PROGRESS, 2026-09-10

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`.

Latest ruling: the operator diagnosed and unblocked the whole-tree formatting gate. Authorized `bun run format` passed; porcelain then listed only the 11 task-owned paths before any new staging. The prior formatter hold is resolved. Diagnostic verification resumes; direct live measurement remains outstanding. Historical stop records below are retained.

Entry prerequisites passed from the landing and T39 completion receipts. Local HEAD and the live remote main advertisement both name `e2116849082f57c1d5fdaf6b309086813f48e4f4` (Caisson #475).

The initial missing-path hold was accepted by the brief author as a brief defect. Both original hold artifacts were committed unchanged as `714c813a` before the author-authorized resumption. The corrected source census and bounded live probe are recorded in [the run notes](release-train-2026-09-RUN-NOTES.md).

**Current status:** the operator accepted the source-IP refutation, resolved the SOT stop, and directed continuation of direct-key investigation. Branch preservation is EXPECTED-DRIFT; the run notes are relocated under `outputs/audit/`. Corrected Changesets preflight passed using `bunx @changesets/cli status --since=origin/main` (v3.0.2, exit 0). The [SOT disposition](s8-sot-disposition.md) lists all 16 lagging documents, their declared dates and newer source dates; dates remain unchanged. The application key remains unobserved. Deployment remains separately operator-gated under R203.

**New stop:** after committing those corrections as `3e549193` and a successful frozen dependency install, temporary diagnostic source/tests and draft SPEC/PLAN were prepared locally. An in-memory Oxfmt tool invocation returned non-JSON content beginning `process is...`; the orchestration parser raised a `SyntaxError`. No retry followed. These diagnostic edits remain uncommitted; their integration tests and review have not run. No direct application observation or deployment occurred. This is a tool-result hold, not a product-defect finding.

The subsequent attempt to commit only the stop receipts also stopped: staged `diff --check` passed, but pre-commit rejected the commit with `oxfmt check failed` (exit 1). No commit was created, no hook bypass or retry occurred, and these latest receipt updates remain uncommitted. Last successful commit: `3e549193`.

At `2026-09-10T19:41:58Z`, one unsigned POST to `https://license.caisson.sh/issue` returned the predicted 401. Railway request `cpbMpVZTQF-EqIubLPU1MQ` matched the unique probe User-Agent, method, path, host and status; its `srcIp` was `2600:1702:7e60:3c0::31`, identical to the ingress IP measured four seconds earlier. Deployment: `ea0bb9c8-aa36-425e-804a-cf08d9dd4928`. No application-header or bucket-key readback was obtained, so neither collapse nor correct per-client isolation is claimed.

| Required evidence                                | Result                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Live rate-limit key, before                      | NOT DIRECTLY MEASURED; correlated proxy source-IP evidence contradicts the predicted substitution |
| Live rate-limit key, after                       | NOT MEASURED; no fix made                                                                         |
| Rate-limit mutation test                         | NOT RUN                                                                                           |
| R212 folds                                       | NOT ASSESSED; branches preserved                                                                  |
| Published version                                | NO RELEASE CUT                                                                                    |
| Release gate verdicts and readiness count        | NOT RUN / NOT DERIVED                                                                             |
| Tarball count                                    | NOT DERIVED                                                                                       |
| R2 parity                                        | NOT MEASURED                                                                                      |
| Mirror sync                                      | NOT RUN                                                                                           |
| Worker redeploy from tag                         | NOT RUN                                                                                           |
| Rescan cron and first firing                     | NOT IMPLEMENTED / NOT DERIVED                                                                     |
| Consumers moved off the pre-fix line by this run | NONE                                                                                              |

The exact map key construction and sibling contracts are recorded in `outputs/audit/s8-direct-key-prediction.md`. Prediction for the previous client A is `issue|2600:1702:7e60:3c0::31` and the same Ask AI IP, including under forged forwarded-IP headers. The second client's ingress must be measured and its exact prediction written before its application probe.

A temporary diagnostic patch exists only in the handoff directory. Applicability passed; local verification returned **3 pass, 0 fail, 19 expectations** for decision parity, sink-error isolation and TypeScript parsing. Full integration/review/CI and live observation remain outstanding. The decision packet is `OPERATOR-ACT-S8-DIRECT-KEY-OBSERVATION.md` in the estate handoff directory; it is not a deployment-ready packet or deployment authority.

Product source now has the uncommitted temporary diagnostic edits described above; workflows remain unchanged. Earlier holds/predictions were committed as `714c813a`, `8950afe3`, and `33bc343d`; SOT corrections as `3e549193`. No PR, merge, tag push, package publication, deploy dispatch, or branch deletion was performed. No green-gates or task-completion claim is made.
