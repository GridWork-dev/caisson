# S13 / R273 / R279 / R283 verification record

The demos route-type failure came from concurrent `next build` and
`next typegen`: the effective Turbo graph had no edge from demos typecheck
to demos build. Both tasks waited only for dependency-package builds.
Next build cleans `.next/types`, while typegen creates that directory and
later writes `routes.d.ts`. The package-local typecheck task now waits for
its own build as well as dependency builds, preventing that race.

The regression test queries Turbo's resolved task graph: before repair,
0 pass / 1 fail; after repair, 1 pass / 0 fail. Formatting passed. Generated
`next-env.d.ts` changes are deliberately excluded: they do not repair the
ordering defect. No generated route output is committed.

## Local gate results and established host cause

- Initial full check: admin build exited 143; 190/198 Turbo tasks succeeded.
- R279 isolated admin control: exit 0; 40/40 tasks succeeded, 39 cached.
- R279 `TURBO_CONCURRENCY=4 bun run check`: exit 137 at ai-kit test;
  194/199 tasks succeeded, 186 cached. The actual total was 199, not the
  predicted 198. No complete full-check pass is claimed.

R283 establishes earlyoom host memory pressure as the cause of both signal
kills, superseding the prior unproven-cause assessment. The operator supplied
these journal lines verbatim in box local time. They directly identify the
ai-kit process; attribution of the earlier admin kill is the operator's
R283 ruling. Five lanes were running gates concurrently, with about 29 GB
of swap in use. The complete local gate could not finish for that reason.

```text
2026-09-10T21:54:23-04:00 gw-ms-a2 earlyoom[904]: mem avail:  1200 of 17518 MiB ( 6.85%), swap free: 13345 of 47119 MiB (28.32%)
2026-09-10T21:54:23-04:00 gw-ms-a2 earlyoom[904]: low memory! at or below SIGTERM limits: mem  8.00%, swap 30.42%
2026-09-10T21:54:23-04:00 gw-ms-a2 earlyoom[904]: sending SIGTERM to process 2232050 uid 1000 "bun": oom_score 712, oom_score_adj 0, VmRSS 4514 MiB, cmdline "bun test --timeout 60000 ./src"
```

R283 authorizes the two commits and PR now, and prohibits further local
full-check runs tonight. The isolated admin control remains valid. The
Ubicloud CI run is the full-suite measurement; the hosted macOS run has not
yet been exercised. No merge or Actions variable change is authorized.

ubicloud-standard-2 runners carry 8 GB of memory against the 16 GB of the previous Blacksmith 4-vCPU class, and the ai-kit test process alone reached 4.5 GB resident locally, so this PR's first CI run is also the first measurement of whether caisson's suite fits the new runner size.

## Census

38 sites: 37 variable Linux-only, 1 mixed macOS/Linux, 0 hardcoded Linux-only,
0 other. Zero Blacksmith occurrences in runner expressions. The six already
correct fallback sites are unchanged. The census mutation passed 0 to 1 to 0.

## Evidence

Local logs in this directory: `check-r273.log`, `admin-control-r279.log`,
`check-r279-concurrency4.log`, and `format-r273-final.log`.

## R283 review availability

Independent governed review dispatches were attempted after the quota check
reported 94% usage and selected the OpenRouter fallback. No verdict returned:
security audit reported `OpenRouter chat returned an invalid completion response`;
code review and adversarial review each reported `fetch timeout 90000ms`.
These are unavailable reviews, not passing reviews.

The main-thread diff review found no blocker: 17 workflow files change only
runner expressions and the two requested history blocks; triggers, job steps,
permissions and credentials are unchanged. The demos task dependency prevents
the shared `.next` write race; the regression invokes only a bounded Turbo
dry-run through an argument array. No generated output or Actions variable
mutation is included. R283 explicitly authorizes PR creation for CI measurement;
independent review availability and the full CI verdict remain outstanding.
