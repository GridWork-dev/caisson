# S8 release train receipt — HOLD, 2026-09-10

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`.

Entry prerequisites passed from the landing and T39 completion receipts. Local HEAD and the live remote main advertisement both name `e2116849082f57c1d5fdaf6b309086813f48e4f4` (Caisson #475).

The initial missing-path hold was accepted by the brief author as a brief defect. Both original hold artifacts were committed unchanged as `714c813a` before the author-authorized resumption. The corrected source census and bounded live probe are recorded in `RUN-NOTES.md`.

**Current hold:** the correlated Railway HTTP log recorded the same source IP as the public Cloudflare trace, contradicting the predicted Worker-egress substitution. Execution stopped on that unexpected result under the unchanged stop rule. This observation does not directly expose the application's resolved limiter key.

At `2026-09-10T19:41:58Z`, one unsigned POST to `https://license.caisson.sh/issue` returned the predicted 401. Railway request `cpbMpVZTQF-EqIubLPU1MQ` matched the unique probe User-Agent, method, path, host and status; its `srcIp` was `2600:1702:7e60:3c0::31`, identical to the ingress IP measured four seconds earlier. Deployment: `ea0bb9c8-aa36-425e-804a-cf08d9dd4928`. No application-header or bucket-key readback was obtained, so neither collapse nor correct per-client isolation is claimed.

| Required evidence | Result |
|---|---|
| Live rate-limit key, before | NOT DIRECTLY MEASURED; correlated proxy source-IP evidence contradicts the predicted substitution |
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

No product code or workflow was changed. The initial hold was committed as `714c813a`; this continuation's evidence updates remain uncommitted following the new stop. No PR, merge, tag push, package publication, deploy dispatch, or branch deletion was performed. The session-wrap `bun run sot` was not run because the brief's stop condition had fired; no green-gates or completion claim is made.
