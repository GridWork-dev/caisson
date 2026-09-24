---
updated: 2026-09-24
status: live
grounds:
  - docs/build-state.md
  - docs/ops/launch-runbook.md
  - registry/scripts/index-parity-probe.ts
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - outputs/executions/2026-07-27-project-reconciliation.md
---

# Deploy log

## 2026-09-24 — ledger reconciliation: the push-path rides 2026-08-26 → 2026-09-23 (no new deploy)

This entry deploys nothing. It records the `deploy-railway` runs this log never received after the
2026-08-25 entry below, read back from the forge (`gh run list --workflow deploy-railway.yml`,
2026-09-24) — CI deploys commit no receipt, so the run ids are the record.

| Run                                                | Head                                                        | Result                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 33014908371 (push, 2026-08-26)                     | `d68dac1d` (#460)                                           | FAILED at the admin step — still inside the CAISSON-208 freeze                              |
| 33038022706 (push, 2026-08-27)                     | `1e2f79a0` (#464, the health-path carve)                    | success — the freeze ends                                                                   |
| 33038099293 / 33038129812 (push, 2026-08-27)       | `045b21e3` (#465) / `af2e1329` (#466)                       | cancelled (superseded) / success                                                            |
| 33213913109, 33217860502 (push + dispatch)         | `8619c41e` (#468)                                           | success — the dispatch carried license                                                      |
| 33219199636 (push, 2026-08-28)                     | `7d396693` (#469)                                           | success                                                                                     |
| 33595387079, 33596498025, 33596659689, 33642937581 | `3ae03371`, `ecfa65e7`, `ac1a1a45`, `69b3ba35` (2026-09-02) | success                                                                                     |
| 34431098595, 34554314090, 34555354323              | `e2116849` (#475), `7e54ddc5` (#476), `127db655` (#477)     | FAILED at the demos step, 2026-09-10/11 — the Bun 1.3.14 next-swc teardown crash (ADR-0422) |
| 34675184008 (push, 2026-09-12)                     | `a386502a` (#478, images on Bun 1.4.2)                      | success                                                                                     |
| 34877205219, 34888117007, 35007285578              | `0b2046e7` (#479), `6604844a` (#481), `7e11672c` (#482)     | success                                                                                     |
| 35122409283, 35156261036                           | `f02b1935` (#484), `2ae0d7d6` (#487)                        | success                                                                                     |
| 35475647854, 35815698009                           | `271b0ace` (#489), `fd6f6084` (#488)                        | success — latest push-path ride                                                             |

`a620da44` (#490) changed only a changeset file and triggered no deploy. **Current fleet:** the
five push-path services (admin, demos, site, docs, support-bot) last deployed at `fd6f6084`;
`caisson-license` is dispatch-only and its newest receipt is `6604844a` (2026-09-14, operator box),
so it trails `main` by the runtime OS-layer patch (#482) and the version cut (#487) until the next
release train's leg 4. The version cut's 47 tarballs are unpublished, so the Worker's baked index
and R2 trail the repo (the daily `r2-parity-probe` reds on exactly those 47 since 2026-09-17).

## 2026-08-25 — Cloud Run Wave-3 prerequisites merged; BOTH triggered workflows FAILED, prod unaffected (runs 32904702977, 32904702863)

PR #448 (`498b279c`, 34 commits, 144 files) merged under operator ruling CAI-ASK-1b — taken in full
knowledge that merging would fail the Railway deploy. **This entry records a ride that did not
happen.** Nothing was deployed and nothing was published.

**Live traffic was never affected.** Measured immediately after both failures: `caisson.sh/healthz`,
`admin.caisson.sh/healthz`, `license.caisson.sh/health`, `docs-api.caisson.sh/health` — all **200**.
Railway keeps the prior revision serving when a new deployment fails its healthcheck; that is now
measured here rather than assumed.

### `deploy-railway` (run 32904702977) — FAILED at admin's healthcheck

Deployment `15308a5d-83fb-45a8-a48f-613f791f742b` ended FAILED after five attempts. The image
**built** (`bun install --frozen-lockfile` and the turbo build both completed) — the failure is
after build. Because `apps/admin` is the fail-fast verifier step ("MUST precede both issuers"),
site, demos, docs and support-bot were never attempted.

**Cause — deliberate, tested, and not a misconfiguration.** #448 gives `apps/site/proxy.ts` (new;
absent from the pre-merge tree) and `apps/admin/src/proxy.ts` a `matcher: ["/:path*"]` with the
origin gate as the first check, removing the `/healthz` exclusion the admin matcher previously
carried. `apps/site/lib/origin-gate.test.ts` asserts the resulting behaviour at exactly the deployed
configuration — `NODE_ENV: "production"` with `ORIGIN_SECRET` present, header-less `/healthz` →
**403** — and a sibling test pins `matcher` to `["/:path*"]`. Railway's internal probe cannot carry
`x-gridwork-origin-secret`, so it gets the 403 the tests specify. #448 was designed for a Cloud Run
topology where the probe arrives through the Worker.

**Consequence: main is undeployable to Railway until the health-path carve lands** (CAISSON-208).
`deploy-railway` fires on `apps/site/**`, `apps/admin/**`, `apps/demos/**`, `services/docs/**`,
`services/support-bot/**`, `packages/**`, `tooling/audit-harness/**`, `tooling/demo-registry/**`
and `bun.lock`, so every push touching those fails the same way. Nothing on a clock re-deploys:
the four `schedule:` workflows (`nist-catalog-watch`, `pgrls-advisory`, `r2-parity-probe`,
`regulatory-claim-watch`) are advisory/probe jobs and none references `deploy-railway`. The only
non-push deploy paths are `release: published` (train leg 4) and `workflow_dispatch`.

**Two hypotheses were checked and killed — recorded so nobody re-runs them.** `HOSTNAME` (the
container-id bind trap): `apps/admin/Dockerfile:42` already sets `HOSTNAME=0.0.0.0` with a comment
naming that exact class. Dockerfile stage hijack: #448 adds a `migrate` stage whose CMD runs
`admin-deploy-migrate.ts`, which would fit "nothing answering" if it were last — it is **middle**,
and `runtime` (`CMD ["bun", "apps/admin/server.js"]`, `EXPOSE 3020`) is last.

**Two wrong diagnoses preceded the right one, both the same error.** First, a repo-wide grep found
`ORIGIN_SECRET` only in Cloud Run plumbing, and that was reported as "not provisioned" — but it is a
Railway **service** variable, structurally invisible to a repo grep; gridwork-infra measured it
present and canonical on all four services. Second, Railway's `"failed with service unavailable"`
retry text was read as evidence of a non-booting process rather than a 403. **Absent from the
config-as-code file is not absent from the applied service, and vendor log prose is not evidence
about our code** — a test at the exact deployed configuration outranks both, and that test existed
the whole time.

### `publish image` (run 32904702863) — FAILED at `gates`, first push-triggered run ever

All six matrix jobs (site, migrate, docs, admin, license, demos) died at the `gates` step;
`collect` skipped, so no `digests` output. Cause: `deploy/gates.sh` shells `depcruise`, and
`publish-image.yml` sets up Bun but never Node — so dependency-cruiser ran on the Blacksmith
runner's system Node 20.20.0 against its `^22||^24||>=26` floor. Same class as the earlier
wrangler-needs-22 finding.

**No image reached Artifact Registry** — `gates` precedes `prepare build context`, `auth`, the
Docker build and `attest provenance`. So the prediction that attestation would fail on a
free-plan private org repo (leaving images published and the run red) is **untested**; this run
died four steps earlier and is evidence in neither direction. Tracked as CAISSON-209, which also
carries the second blocker waiting behind the Node pin: the T28 vulnerability scan fires once
`gates` passes, and its SARIF upload steps sit after the failing step and skip, so the run blocks
on a CVE it never names (`if: always()`, folded into infra's R44 template pass — not patched
locally, since the workflow's header requires all four repo copies to stay byte-identical).

### Follow-ups opened

`CAISSON-208` (health-path carve + document `ORIGIN_SECRET` in `railway.toml`/this log + the
`caisson-demos` gate design question), `CAISSON-209` (publish-path Node pin + SARIF `if: always()`),
`CAISSON-206` (client-IP keying collapse behind the Worker — pre-existing, unrelated to #448).
`ADR-0415` ratifies the admin Cloudflare Access re-coupling #448 introduced.

## 2026-08-25 — Semconv exemption in the span scrub (run 32892857628)

PR #455 (`9cb7681c`) merged and took the automatic path. All five push-path legs SUCCESS in
**7m36s** (20:00:47 → 20:08:23Z); `services/license` skipped (dispatch-only). The diff touched
`packages/observability`, so every service compiling it re-rode.

**What shipped.** CAISSON-205: the deny-list's unanchored credential terms (`token`, `session`,
`authoriz`) matched 21 real `@opentelemetry/semantic-conventions` attribute names, blanking LLM
usage (`gen_ai.usage.*_tokens`) and session correlation (`session.id`, `mcp.session.id`) on every
span. Fix: a key that is an exact member of the semconv name set (read from
`@opentelemetry/semantic-conventions/incubating` at module load, never hand-copied) skips the
credential arm only — the PII arm is unconditional, so `user.email` / `user.full_name` (semconv
names too) still redact. 19 names newly pass, 2 stay redacted; templates
(`http.request.header.authorization`) are exported as functions, never members, and still redact.
The three deny regexes (union + both arms) are now derived from one term-source pair — a
mid-review CI failure proved the drift class real (a mutation-check state with one term dropped
was accidentally committed and only the hand-written regression list caught it), so the class was
deleted by construction rather than tested for. Review: gw-code-reviewer + gw-security-auditor
(PII tag) both MERGE_WITH_FIXES, zero blockers; 4 confirmed findings fixed on-branch, 3 refuted in
adversarial verify; operator ruled merge via the in-session ask, keeping `mcp.session.id` exempt
(nothing in-repo emits it; the value-level bearer backstop stands).

**Verification.** Suite 136/136 including the full-census sweep (889 exported names →
exactly `user.email` + `user.full_name` flagged, pinned as a literal), 13 exact-match-only
guards, and per-term mutation proof (every load-bearing term deletion reds a named test).
Export-side scrubbing has no served surface to probe; the proof is the merged suite plus the six
green required checks. No receipt file — CI deploys commit none.

## 2026-08-25 — Organization entity edges to the GridWork hub (run 32870028441)

PR #453 (`4087f8e0`) merged and took the automatic path. All five push-path legs SUCCESS in
**17m06s** (16:07:21 → 16:24:27Z); `services/license` skipped (dispatch-only). The admin leg alone
took 10m14s (16:07:43 → 16:17:57Z) against ~2 min on the two earlier rides today — a Railway
build-side slowdown, not a diff effect (admin was unchanged). Only `apps/site` changed.

**What shipped.** The site's `Organization` node now carries two edges into the GridWork hub:
`founder` → `https://gridworkdigital.com/#founder` and `subjectOf` →
`https://gridworkdigital.com/work/caisson-reliability#casestudy`. No `parentOrganization` — Caisson
Software LLC is a separate Georgia LLC, not a subsidiary; the subsidiary predicate stays banned
and the test suite pins its absence (both directions mutation-checked). The edges landed only
after the hub's own deploy (studio main `51a7cab`) served all three IRIs, verified anonymously:
`#founder` is a Person with no organization back-reference, and the case study's `about` points at
the caisson organization.

**Verification.** Anonymous clean-UA fetch of `https://caisson.sh/` after the site leg: one
`Organization` node, `founder` and `subjectOf` exactly as pinned; `parentOrganization`,
`subOrganization`, `worksFor`, `memberOf`, `affiliation`, and the hub `#organization` IRI all
absent from the served JSON-LD. No receipt file — CI deploys commit none.

## 2026-08-25 — PII attribute-key scrub hardened, deployed fleet-wide (run 32868697727)

PR #449 (`87b07c60`) merged and took the automatic path. All five push-path legs SUCCESS in
**8m55s** (15:54:34 → 16:03:29Z); `services/license` skipped (dispatch-only). The diff touched
`packages/observability` and `packages/kernel`, so every service that compiles either re-rode.

**What shipped.** Audit finding `19d1af0e70d0c2d7` had been closed in a 259-row bulk reconcile
while still live: the span-attribute deny-list's `\b` word anchors cannot see a camelCase or
snake_case boundary, so `userEmail` / `user_email` / `phoneNumber` reached the OTLP sink
unredacted. The fix normalizes the key (NFKC + a linear camelCase/snake_case word split) and tests
the deny-list against both forms, with letter-lookarounds replacing `\b` on the short tokens.
The round-1 fix also introduced a quadratic ReDoS in the acronym split (`([A-Z]+)`, ~850 ms at 32k
chars on an attacker-named attribute) — caught by the in-session security audit and removed
before merge. Independent re-verification (own 67-key probe set, 889-name semconv sweep
main-vs-branch with zero delta, kernel golden byte-identical) returned MERGE. Full record:
`outputs/audit/2026-08-25-false-close-19d1af0e.md`; follow-on CAISSON-205 (21 semconv names the
unchanged `token`/`session`/`authoriz` terms redact, pre-existing).

**Verification.** Export-side scrubbing has no served surface to probe; the proof is the merged
suites (observability 82, kernel 10, five mutations each red only where they should) plus the
`bun run check` gate. No receipt file — CI deploys commit none.

## 2026-08-25 — sameAs identity claim corrected, crawl hygiene, llms.txt open-core split (run 32864573000)

PR #452 (`f6282dc3`) merged and took the automatic path. All five push-path legs SUCCESS in
**7m53s** (15:14:39 → 15:22:32Z); `services/license` skipped (dispatch-only, carries migrations).
Only `apps/site` changed in the diff — the trigger's path filter gates the _run_, not the legs, so
admin/demos/docs/support-bot re-rode unchanged code at the new sha.

**What shipped.** The root JSON-LD `sameAs` advertised the private development repo, which 404s
to any anonymous crawler — a broken identity claim, not a weak one. It now names the public org page
only, pinned by `apps/site/lib/jsonld.test.ts` (shape floor first, then both directions).
`llms.txt` gained the Licensing / Documentation / Buying blocks (package count read from the same
const the license page reads) and carries **no** parent-organization line — Caisson Software LLC
and GridWork Digital LLC are separate Georgia LLCs with common ownership at the individual level
only, so a subsidiary-shaped claim would be false; a test pins its absence. `robots.txt` disallows
`/cart`, `/login`, `/forgot-password`, `/reset-password` alongside `/dashboard` in both rule groups
(the AI-crawler group cannot inherit from `*`), and `/demo` is in the sitemap.

**Verified against served content, anonymous clean-UA, after the run:**

- `https://github.com/caisson-sh` → **200** (control: the private repo path → 404)
- `caisson.sh/` JSON-LD: `"sameAs":["https://github.com/caisson-sh"]`
- `caisson.sh/llms.txt`: zero hits for the parent-org strings; `## Licensing` and the
  no-self-serve statement present
- `caisson.sh/robots.txt`: `Disallow: /cart` in both groups

**Receipts.** Unchanged: a CI deploy commits no receipt, so `outputs/deploy/receipts/*.json`
lags every service on the automatic path. The deployment ledger remains the truth.

## 2026-08-19 — analytics origin gate shipped, verified in the served bundle (run 32294345876)

PR #447 (`8b1ab7ca`) merged and took the automatic path. All five legs SUCCESS in **6m39s**
(19:40:44 → 19:47:23Z); `services/license` correctly skipped — it stays dispatch-only because it
carries migrations.

**What shipped.** Both client analytics senders were gated on `NEXT_PUBLIC_POSTHOG_KEY` being
present, which is the wrong gate: Next inlines `NEXT_PUBLIC_*` at build time, so every artifact
built on a box exporting that env carries the caisson-prod key and beacons into production from
wherever it is served. `apps/site/lib/analytics-host.ts` now gates both senders on the runtime
origin instead, which makes the inlining harmless by construction.

**Verified against the served bundle, not the deploy's exit code.** The sender is a lazy chunk
pulled after `load`, so it is invisible to a plain fetch of the HTML; a browser was needed to reach
it. In `2ptzaa4bqh75c.js` as served from caisson.sh:

- the gate is the **first statement** of `startWebVitals` — `if(!(0,H.isProductionAnalyticsHost)(window.location.host))return;`
- the batch carries `$host:window.location.host`
- the allowlist module resolves to `[e,` + "`www.${e}`" + `]` over `new URL("https://caisson.sh").host` — i.e. **both** apex and `www`, which is the half that matters, since too narrow an allowlist would silently blind real traffic rather than only blocking noise

**A detail worth keeping.** The old `if (!key) return` guard is _absent_ from the minified output:
the key is a build-time string literal, so that branch was statically dead and eliminated. That is
direct evidence of the inlining behaviour the fix addresses — the key gate could never have
discriminated anything at runtime, because by the time the code runs the key is a constant.

**Receipts.** Unchanged from the ADR-0414 note below: a CI deploy commits no receipt (the deploy
script writes into a discarded checkout), so `outputs/deploy/receipts/*.json` continues to lag for
every service on the automatic path. The deployment ledger remains the truth.

## 2026-08-19 — the first automated docs + support-bot ride (run 32285889495)

ADR-0414 merged as `cb33fdd7`, and **the merge was itself the first ride** — `deploy-railway.yml` is
a line in its own `paths:` filter, so the merge commit matched and the workflow fired on the merge
push, running the merged version with both new legs. All five legs SUCCESS; license correctly
skipped (dispatch-only).

| Leg             | Window              | Duration  |
| --------------- | ------------------- | --------- |
| admin           | 18:11:39 → 18:12:52 | 1m13s     |
| demos           | 18:12:52 → 18:13:51 | 0m59s     |
| site            | 18:13:51 → 18:15:35 | 1m44s     |
| **docs**        | 18:15:35 → 18:17:49 | **2m14s** |
| **support-bot** | 18:17:49 → 18:18:53 | **1m04s** |

Whole job 7m43s against the raised 125-minute cap. **The docs leg took 2m14s, not the 20+ minutes its
`--wait-minutes 40` budget allows for** — the cold-boot full re-embed is the worst case, not the
normal one. Keep the budget: the point of a budget is the bad day, and the 1500s `healthcheckTimeout`
is still the ceiling Railway itself will wait.

Live read-back: `docs-api.caisson.sh/health` → `{"ok":true,"chunks":562}`, down from **576**
at the pre-ride baseline (`d9a56601`, 2026-08-15). The count changing is the proof a new image is
serving — the old one cannot report a different number. The delta is explained by the corpus source:
it indexes `apps/site/content/docs` **plus each package's README**, and the baseline predates the
`@caisson/analytics` retirement (ADR-0410), which removed a package README from the corpus.

**Not verified: whether the new `ds-manifest` prose is in the LIVE index.** Rebuilding the corpus
locally at `main` shows 4 chunks mentioning it, so it is in the source — but confirming it in the
served index needs a query against `DOCS_SERVICE_TOKEN`, which is an operator-held secret. The
one-command check, if it's ever worth running: a `/search` call with that Bearer for `ds-manifest`.

### The receipt ledger now goes stale for these two, and the collision gate narrows with it

`railway-deploy.ts` appends `docs/deploy/receipts/<service>.json` inside its checkout, and a CI
checkout is discarded — so this run committed nothing. `caisson-docs.json` still records
`d9a56601` (2026-08-15) and `caisson-support-bot.json` `26092936` (2026-08-16), while both services
are now on `cb33fdd7`.

This is a **second-order effect of ADR-0414 itself**, and worth stating because it inverts a
property these two used to have: they were the only services whose receipts were reliable, precisely
because they were the only ones deployed exclusively by hand. They now join site (last committed
receipt `886e1e7c`, 2026-08-15, many CI rides ago) in the stale column.

It also narrows the correction ADR-0414 made to the single-use collision gate. That correction is
still right — receipts are tracked, so a CI checkout does read them and the gate does fire — but the
gate can only ever see **operator hand-committed rows**. It will block a dispatch at a sha the
operator once deployed by hand; it cannot block a re-deploy of a sha only CI has shipped, because no
row was ever written for it. Read the deployment ledger or the workflow run ids for truth, never the
receipt files.

## 2026-08-19 — the last two services get an automated deploy path (ADR-0414)

`caisson-docs` and `caisson-support-bot` are now deployed by `deploy-railway.yml` like the rest of
the fleet. Until this change **no workflow deployed either service** — not the release train, whose
leg 4 is a dispatch of that same workflow. Their only path was an operator hand-run of
`tooling/scripts/railway-deploy.ts`, which is why both drifted (`docs` at `d9a56601`, `support-bot`
at `26092936`) while the other four rode every merge.

Shape of the change:

- `services/docs/**` and `services/support-bot/**` join the push-path filter, and two steps append
  after `site` in the order **docs → support-bot** — the bot is a client of the docs API
  (`DOCS_SERVICE_URL`), so the API must serve the release before the client restarts against it.
- One guard each (`armed`), no second `CAISSON_DEMOS_ARMED`-style gate: both services have existed
  and been Online since 2026-06-30, so the missing-service hazard that earned demos its extra gate
  does not apply.
- `railway-deploy.ts` gains `--wait-minutes` (default 15, unchanged behaviour) and the docs step
  passes **40**. Its poll budget was a fixed 15 minutes; docs answers `/health` with a warming 503
  while it re-embeds its whole corpus on every cold boot, bounded by a 20-minute deadline under a
  1500s `healthcheckTimeout`. At the default this step would have reported "timed out waiting" on a
  deploy that was still succeeding, and taken the support-bot step down with it.
- The job's `timeout-minutes` goes 25 → 70. **25 was already exactly equal to docs'
  `healthcheckTimeout`** — adding the docs leg without raising it would have guaranteed a job-level
  kill on any cold-boot re-embed, before counting the four legs that run ahead of it.

**The gate was promoted first, on purpose.** `support-bot` (ruff · pyright · pytest · the offline
eval gate) was an advisory, path-scoped workflow. An advisory gate in front of an automatic deploy
means a red bot reaches production and nothing blocks it, so this change makes it the sixth required
check — and removes its `paths:` filter in the same commit, because `release-readiness.ts` counts a
check that never reported as `missing` and ci.yml's rule is that a required job stays unconditional.

**The merge itself is the first ride.** `.github/workflows/deploy-railway.yml` is a line in its own
`paths:` filter, so the merge commit matches and the workflow fires on the merge push — running the
merged version, with the two new legs, armed and unattended. Expect
admin → demos → site → docs (up to 40 min on a cold re-embed) → support-bot, and watch it.

## 2026-08-19 — leg 4 cleared, and the fleet brought to one revision

Railway's snapshot stage recovered between 01:48Z and 08:03Z (dev-profile proved it on
`gridwork.dev` with a live health read-back). Four green deploys followed, in this order:

| Run                    | Ref                     | Services                       | Result                                       |
| ---------------------- | ----------------------- | ------------------------------ | -------------------------------------------- |
| 32256561340 (push)     | `1ca11b8e` (#443 merge) | admin · demos · site           | SUCCESS — 8th attempt overall, first success |
| 32256783788 (push)     | `aee4285e`              | admin · demos · site           | SUCCESS                                      |
| 32258237983 (dispatch) | `v2026.08.18`           | admin · license · demos · site | SUCCESS — **this is leg 4**                  |
| 32258937690 (dispatch) | `main`                  | admin · license · demos · site | SUCCESS                                      |

**Leg 4 landed at the tag with `require_armed=true`, as ADR-0325 requires.** It was run under an
explicit operator ruling after this session raised, and the operator overrode, two objections: at
dispatch time the tag was six commits behind main, so the tagged deploy briefly reverted
admin/demos/site (both retirements plus the leg-2 mirror-gate repair), and it baked the tag's
53-entry `registry/index.json` against a Worker already re-baked at main's 52-entry index. The
main dispatch seven minutes later was ordered in the same picker and closed both windows — the
sequence was chosen tag-first precisely so the fleet would end on main.

**The fleet is no longer split.** admin, demos, site and license all deployed from `main` at
13:35–13:40Z. `caisson-license` had been stranded on 2026-08-12 — its leg is dispatch-only because
it carries migrations, and nothing had dispatched it since; no new migration had been added under
`packages/platform-migrations/src/` in that window, so it shipped as a pure code redeploy.
Post-deploy probe: `registry.caisson.sh/index.json` → 200, 16 anonymous modules, `@caisson/analytics`
absent — parity with main's committed index holds.

**No receipts were committed for these four.** `railway-deploy.ts` appends to
`docs/deploy/receipts/<service>.json`, but a CI checkout is discarded, so only operator-box runs
ever produce a committed receipt. The run ids above are the record for this ride.

**`caisson-docs` and `caisson-support-bot` did not move** — they are at `d9a56601` (2026-08-15, a
forced re-application of bytes already live) and `26092936` (2026-08-16). See the correction below.

## 2026-08-18 — v2026.08.18 release train: four legs landed, leg 4 blocked on a Railway platform incident

The train fired off the `v2026.08.18` Release (published 23:11:30Z; the tag targets `5ac7d9ca`).
Four of the five legs are done and verified; the deploy leg is the one exception and it never
reached a build.

- **Leg 1 publish** (run 32196175743) SUCCESS — 53 tarballs uploaded to R2 at the tag, 0 already
  present.
- **Leg 1b deploy-worker** (run 32196860140) SUCCESS — `registry.caisson.sh` serving 17 entries,
  matching the repo's recorded latest.
- **Leg 2 mirror-sync** SUCCESS on the second pass. The first (run 32196950131) went red on two
  independent breaks the train was the first thing to exercise: upstream `@electric-sql/pglite`
  0.5.5 exits the process 99 on a clean close, and the gate installs WITHOUT a lockfile by design
  (it resolves as a stranger cloning the public repo would), so it picked up the bad release the
  main repo's lockfile was shielding us from; and the oxc toolchain swap had left the gate's lint
  and format legs matching ZERO files, because oxlint/oxfmt discover ignore files by walking UP and
  `mirror-out` is gitignored by this repo. Repaired in `7128ea74` (pin 0.5.4 in `tooling/testing`,
  not the root catalog — a catalog range change would churn packed manifest bytes through
  `platform-migrations`; plus a `.git` boundary marker created after export and stripped before
  push). Re-dispatched at the repair sha (run 32198658645): `caisson-oss` main is now `1e9d110a`.
  **Disclosed ADR-0325 deviation:** the mirror is anchored one commit ahead of the tag, at the
  repair sha, because the tag's tree could not pass its own gate.
- **Leg 3 npm** — skipped this ride, still operator-gated (CAISSON-179).
- **Leg 4 deploy-railway** — NOT DEPLOYED. Five attempts, every one failing on Railway's side:

  | Attempt                                                                     | Result                                                                                                                 |
  | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
  | run 32198636015 (push)                                                      | `railway deployment list` returned an HTML error page; died on the pre-deploy ledger read                              |
  | run 32198660264 (dispatch)                                                  | same                                                                                                                   |
  | run 32198809238 (dispatch, `ref=v2026.08.18`)                               | deployment `4bdbd1af` FAILED — snapshot timeout, ~16 min to terminal, so the script's 15-min poll budget expired first |
  | run 32201188780 (dispatch, `ref=v2026.08.18`)                               | deployment `0eaedbfc` FAILED — same error in ~60s                                                                      |
  | operator box, `railway-deploy.ts --service caisson-admin --ref v2026.08.18` | deployment `26ae1771` FAILED — same error                                                                              |

  Every deployment record carries the identical `meta.configErrors`: _"Repository snapshot
  operation timed out. This may be due to a large repository size or network issues."_ — and
  `railway logs --build <id>` answers _"Deployment does not have an associated build"_. Upload
  accepted, no build ever scheduled: a Railway snapshot-stage failure, not ours.

  Two things rule out the payload. The `git archive` of the tag is 58 MB, the same size as
  `30919cae` — which deployed fine at 20:44Z the same day — so "large repository size" is
  excluded. And the operator-box attempt reproduces it from an entirely different client and
  network path, so the runner is excluded. Independently, the `gridwork-dev-site` Railway project
  hit the identical `configError` in the same window; two unrelated projects failing the same way
  is a platform incident, and the last attempt failing in 60s where the first took 16 min reads as
  a degrading subsystem. Railway's public status page showed UP throughout.

**Fleet as it stands:** caisson-admin / caisson-demos / caisson-site on `30919cae` (the auto ride,
run 32183926543, 20:44Z); caisson-license on `886e1e7c` (2026-08-12 — dispatch-only, so it does not
ride the path filter). The gap between `30919cae` and the tag is documentation plus lint config
only, so nothing buyer-facing is waiting on this; the fleet simply is not unified on one sha yet.
Leg 4 is the free retry once the incident clears — either a dispatch at the tag, or the next
push that trips the deploy path filter.

**No receipts were written for this ride.** Nothing deployed, so `docs/deploy/receipts/` is
deliberately unchanged rather than carrying a row for a deploy that failed. The 20:44Z auto ride's
receipts live in that run's job summary, per the tool's CI behavior.

## 2026-08-15 — consolidation wave 1: auto ride + the two hand-deployed post-merge obligations

`26092936` (#437 — the 18 verified consolidation cuts, ADR-0407/0408) touched `packages/**`, so the
path filter fired an auto ride at 21:59:21Z (run on `26092936e191`, success): **caisson-admin
21:59:37Z → caisson-site 22:01:52Z**, both SUCCESS. Two services the auto ride does not cover were
deployed by hand, each closing an obligation the merge created:

- **Better Stack Worker** (Cloudflare, outside the Railway path filter) — `bunx wrangler@4.106.0
deploy`, version `c6c93b44-dd6e-4865-b861-a97b5438912e`. The wave deleted its
  `ALLOW_UNAUTHENTICATED` bypass and made a missing secret a fail-closed 401, so the auth smoke is
  the proof the bypass is actually gone from the running edge, not just from the source tree:
  no-header POST → **401**, wrong-secret POST → **401**, correct `X-Betterstack-Secret` +
  a `resolved` incident body → **200 `{"ok":true}`**.
- **caisson-support-bot** (dispatch-only, never on the auto path) — `railway-deploy.ts --service
caisson-support-bot --ref 26092936`, receipt appended. This is the deploy that finally serves
  **#435's F-10 fix**: the 2026-08-15 F-02 pass had redeployed the bot at the sha it already had
  live (`d9a56601`) precisely so it applied the config and nothing else, which left the
  security-header middleware merged but unserved for a day. Read back live on `/health` 200:
  `strict-transport-security: max-age=63072000; includeSubDomains`, `x-content-type-options:
nosniff`, `x-frame-options: DENY` — all three, where the pre-fix probe had none.

Probed live after the ride, all 200: `caisson.sh/healthz`, `admin/healthz`, `license/health`,
`docs-api/health` (`{"ok":true,"chunks":576}`), `caisson.sh/demos/healthz`, `registry/index.json`.

## 2026-08-12 — mirror pre-push gate merged; full fleet ride incl. the license leg

`886e1e7c` (#431 — the mirror-sync pre-push verification gate + the internal-citation strip) touched
`packages/**`, so the path filter fired an auto ride, and the operator then approved a dispatch to
carry the **dispatch-only license leg**. Both runs deployed the same sha; every service is on
`886e1e7c`.

- **Auto**, run 31632456581: caisson-admin 19:25:39Z → caisson-demos 19:26:45Z → caisson-site
  19:28:41Z, all SUCCESS. `services/license` skipped as designed (dispatch-only).
- **Dispatch**, run 31632874787 (`require_armed=true`): caisson-admin 19:32:32Z →
  **caisson-license 19:34:52Z** → caisson-demos 19:35:16Z → caisson-site 19:37:16Z, all SUCCESS.
  Because CI never commits receipts, the dispatch's fresh checkout saw no receipt for this sha and
  so redeployed admin/demos/site too — a second restart of the same bytes, recorded honestly as its
  own receipt row rather than suppressed. `workflow_dispatch` has no service selector, so a
  license-only ride is not expressible today.

Probed live after both rides, all 200: `caisson.sh`, `www`, `/docs`, `/demos/healthz`,
`/demos/embed/audit-worm`, `admin`, `license/health`, `docs-api/health`, `registry/index.json`.
(`/demos` and `/demos/` are 404 by design — apps/demos has no index route at its basePath root.)

**Runner egress to GitHub's release CDN was degraded for roughly 20 minutes** and reddened three
separate workflows on artifact download, never on repo content: `deterministic` twice (503 on the
trivy tarball), `zizmor` once (six retried 503s), and this deploy's `install Railway CLI` once
(ECONNRESET from `@railway/cli`'s postinstall). GitHub reported all systems operational and every
URL served 200 from the operator box throughout, so it was runner-side. #431 hardened the four
security-scan downloads with `--retry 5 --retry-delay 3 --retry-all-errors` (integrity unchanged —
`sha256sum -c` still verifies each artifact); the Railway CLI install is an npm postinstall and has
no equivalent retry, which is the remaining exposure in this class.

## 2026-08-10 — Renovate close: two auto rides prove the root-dep path filter

The operator's clean-state directive lifted the Renovate hold; three of five PRs merged on
pinned-head full rollups, and both bun.lock merges auto-triggered deploy-railway — the first real
exercises of the #426 path-filter fix, which the 2026-08-10 dep wave had needed a manual dispatch
for:

- `358cebe1` (#419 fast-uri v4, a root-only pin with no import sites): run 31454521083 —
  caisson-admin 03:10:28Z → caisson-demos 03:11:23Z → caisson-site 03:13:14Z, all SUCCESS,
  ci/quality/security-scan green.
- `8993cf75` (#421 ioredis v6 in `@caisson/jobs`): run 31455136863 — caisson-admin 03:22:47Z →
  caisson-demos 03:23:48Z → caisson-site 03:25:35Z, all SUCCESS, full green rollup. The bump was
  coordinator-completed on the Renovate branch (merge-from-main, lockfile regen, pin test moved to
  `^6.0.0` after verifying bullmq's `>=5.0.0` optional-peer range, changeset) — no force-push.
- `ab8d89a4` (#415 python:3.14-slim digest for support-bot): no fleet ride by design — support-bot
  deploys only via the release train, so the digest reaches prod on the next train.
  **[Corrected 2026-08-19: that reason is false. No workflow deploys `caisson-support-bot` — not
  the train, not `deploy-railway.yml`, which has only ever covered admin/license/demos/site. Its
  only deploy path is a hand-run `railway-deploy.ts --service caisson-support-bot`. The digest
  reached prod on 2026-08-16 that way, not on a train.]** Its
  support-bot workflow run (test) passed; the superseded ci/quality/security-scan cancellations on
  this sha are the benign concurrency-group class (the tip's runs are green).
- Held, not merged: #418 (non-major batch) + #422 (jsdom 30) are red only on the bun 7-day
  `minimumReleaseAge` floor and self-heal as versions age; hold comments on both PRs.
  `renovate.json` now pins `minimumReleaseAge: "7 days"` so future batches arrive pre-aged.
  #418 carries a rider: the better-auth 1.6.26 inside it needs the session-adapter lockstep
  review (CAISSON-175) before merge even on green.

Receipts appended for admin/demos/site on both rides.

## 2026-08-10 — four-lane wave: three fleet rides + the deploy-worker lane proven

The 2026-08-09/10 four-lane worktree wave (copy #420 · consolidation audit #423 · queued-eng #417

- Node-22 follow-up #424 · dep wave #425, coordinator-merged on pinned-head full rollups) produced
  three fleet rides, all receipted in the per-service JSON ledgers:

* **`581cb2d8`** (copy merge, auto path): admin + demos + site, 03:05–03:08Z — the D12
  message-match copy live.
* **`e6866e55`** (queued-eng merge, auto path, run 31410239876): admin landed first attempt (CLI
  log-stream drop, ledger-adjudicated SUCCESS); **demos hit a real Railway platform 500 on code
  upload** — deployment `6951ce53` FAILED in the ledger, the honest-fail class, not the
  stream-drop class — which also blocked the site leg behind it. A `--failed` rerun healed both
  (admin redeployed same-bytes in passing), 16:54–17:04Z.
* **`6f326503`** (dep wave merge): the root-only diff (package.json override + bun.lock) matched
  **no auto-deploy path** — the security bumps (dompurify site-bundle XSS fix among them) would
  have sat undeployed; caught at the wave close, deployed via manual dispatch run 31415468919
  (admin + **license** + demos + site — the dispatch path carries the license leg the auto path
  skips), 17:48–18:06Z, all four ledger-adjudicated. The filter gap is closed in #426
  (root `package.json`/`bun.lock` added to the auto paths).

**The `deploy-worker.yml` lane is proven and the 2026-08-09 open follow-up closes.** The
queued-eng PR made the swallowed `bunx wrangler deploy` capture loud and pinned the shim; the
first coordinator proof dispatch (run 31410273428) then failed LOUD with the real cause the
silent 35ms deaths had hidden: wrangler 4.x requires Node >= 22 and the Blacksmith image ships
v20.20.0 (local deploys worked because the operator box is >= 22; `setup-bun` provides no node).
#424 (`cd8e3593`) added the pinned `actions/setup-node` at 22, and the second proof dispatch
(run 31410887694, blank ref = main) went **green end-to-end** — ancestry check, build, wrangler
deploy, live-edge `index-parity-probe --only worker` PARITY OK. The lane is usable as the
release train's leg 1b again.

## 2026-08-09 — audit-remediation wave: demos zone armed (ADR-0400 flip), demos+site deploys

The ADR-0400 two-variable arming executed end to end from the reconcile session (operator lock
"Go — run it end to end"): the `caisson-demos` Railway service created via CLI/API (project
caisson-prod, sfo, `railwayConfigFile: apps/demos/railway.toml`, no public domain), the site's
`DEMOS_ORIGIN_URL` build var set to `http://caisson-demos.railway.internal:3040`, and the
`CAISSON_DEMOS_ARMED` repo variable flipped after the in-flight deploy run settled. Receipts:
[caisson-demos.json](receipts/caisson-demos.json) (first row) and
[caisson-site.json](receipts/caisson-site.json) (rows at `0f3f5e2a`); recorded shas are the
deploy-time branch base — the demos image itself carries the PR #411 Dockerfile fix.

Two production root causes found and fixed at first flip, both now pinned in the tree:

- **Railway's private mesh is IPv6-only:** the standalone server's `HOSTNAME=0.0.0.0` bind
  refused every rewrite connection (public 500 on `/demos/*`); `HOSTNAME=::` binds dual-stack
  (PR #411, comment in `apps/demos/Dockerfile`).
- **Railway injects `PORT` (8080) at runtime over the image ENV:** the container healthcheck
  self-consistently passed on the injected port while the mesh dialed the documented 3040
  (ECONNREFUSED); fixed by pinning `PORT=3040` as a service variable
  (comment in `apps/demos/railway.toml`).

Proven live in-browser after the fixes: `/demos/healthz` 200 under the demos CSP,
`/demos/embed/audit-worm` 200, and the marketplace module page mounting an interactive
same-origin iframe.

**Registry Worker redeployed** after the reconcile PR (#413) merged: version `b5a09cc0` off
`c10e3b64`, run locally via `registry/worker/deploy.sh` — the ADR-0402 post-delist 53-module
index is live, `index-parity-probe --only worker` **PARITY OK** on the first attempt (17
anonymously-probeable open entries match repo latest; commercial entries are not anonymously
probeable, per the probe's documented scope). Open follow-up: the `deploy-worker.yml` CI lane
died silently (~35ms, exit 1, no output) at the `bunx wrangler deploy` capture line on the same
tree that deploys cleanly by hand — `deploy.sh`'s `deploy_out="$(… 2>&1)"` swallows the error
under `set -e`, so the lane needs an un-swallowed failure path before it can be trusted again;
also note a bare sha is not a valid `ref` input for the workflow's checkout (use a branch/tag or
blank-for-main).

## 2026-08-06 — release train `v2026.08.06.1` off `d9a56601`, driven locally; first full five-service leg 4

The DEPLOY act for the `v2026.08.06.1` release (the successor tag to the dud `v2026.08.06` — six
stale sidecar rows re-recorded, see the tagged tree's
[release checklist](../releases/v2026.08.06.1-checklist.md) and
[release audit](../../outputs/audit/release-audit-v2026.08.06.1.md)). Every leg was driven from the
operator's box during the 2026-08-06 GitHub Actions outage, per the same standing lock that merged
the release on local gates.

**Legs 1–3:**

- **Leg 1 (R2):** 49 tarballs uploaded, 5 already present, 0 overwrites — head-object-first per
  object, byte-verified against `registry/tarballs.json` before upload.
- **Leg 1b (Worker):** version `d7176705-a786-435f-be4c-2b7c6a2f1d42` live at `registry.caisson.sh`,
  serving the release index.
- **Leg 2 (mirror):** `caisson-oss` advanced `9785695..b434a8b`, one appended commit, never forced.
- **Leg 3 (npm):** skipped — operator-gated (CAISSON-179), unchanged.

**Leg 4 deployed all five Railway services** at the tag via
`bun tooling/scripts/railway-deploy.ts --service <name> --ref v2026.08.06.1`, serially, each verdict
read from Railway's own deployment ledger (UTC times are 2026-08-07 00:45–00:56Z, late 08-06
US-Eastern): caisson-admin 00:45:26Z → caisson-license 00:49:19Z → caisson-site 00:52:20Z →
caisson-docs 00:54:49Z → caisson-support-bot 00:56:18Z, all SUCCESS, receipts appended for all five.
This is the first ride where leg 4 covered docs and support-bot — the train's workflow still deploys
only admin/license/site; the two extra services were part of the operator's full-fleet lock for this
release.

**A stale CI backfill was superseded in passing.** When Actions recovered it drained a queued push
run for `04cf1ff4` — a pre-Wave-B, pre-repair commit — and its `deploy-railway` job deployed admin
(22:22Z) and site (22:23Z) from those stale bytes, reporting green. Those two deployments briefly put
the live site _behind_ the tag (missing the Wave B poke-mirror retirement); the five deploys above
replaced them ~2.5h later. The CI run's receipts were appended in its own checkout and are lost —
the receipts committed here are the local run's, which is also the fleet's live state.

Post-deploy `bun registry/scripts/index-parity-probe.ts`: all four legs `d2948ee2b5a8` · 54 entries,
**`RESULT: PARITY OK`** — and `caisson.sh`, `admin.caisson.sh/healthz`, `license.caisson.sh/health`,
`registry.caisson.sh/health` all 200.

## 2026-08-01 — caisson-license redeployed at the release SHA; fleet parity restored

`bun tooling/scripts/railway-deploy.ts --service caisson-license --ref d9ae893e` — the receipted
operator-gated redeploy the 2026-07-31 entry below called for. Receipt appended to
[receipts/caisson-license.json](receipts/caisson-license.json) (`d9ae893e` at
`2026-08-01T09:53:43.911Z`); Railway deployment `dd6af196` SUCCESS; `license/health` reports
`dc5ee000aebf`/54; the full four-leg parity probe returns **`PARITY OK`**.

The structural half landed the same day: `deploy-railway.yml` gained a dispatch-only
`caisson-license` step (between admin and site — after its verifiers, before the image that needs
its `preDeployCommand` migrations), so leg 4 now covers every Railway index-baking surface and this
drift class stops recurring.

## 2026-07-31 — no deploy; parity re-probe finds the license leg one index behind

`bun registry/scripts/index-parity-probe.ts`, run from a clean checkout of `main`:

| Leg     | Result                                    | State     |
| ------- | ----------------------------------------- | --------- |
| repo    | `dc5ee000aebf` · 54 entries               | OK        |
| license | `4810e38157c1` != repo                    | **DRIFT** |
| worker  | 17 served entries all match repo `latest` | OK        |
| admin   | `dc5ee000aebf` == repo                    | OK        |

`RESULT: DRIFT DETECTED`, exit 1. Public HTTP is healthy on all three reachable surfaces
(`caisson.sh` 200/156ms, `admin/healthz` 200/172ms, `license/health` 200/86ms) — this is a staleness
drift, not an outage.

**The cause is structural, and it is the same class as the Worker-leg gap recorded below.** Four
surfaces bake `registry/index.json` into their build: the Worker bundle, the license image, the admin
image, and the repo file itself. The release train's leg 4 (`deploy-railway.yml`) deploys exactly two
services — `caisson-admin` and `caisson-site`. So the `v2026.07.30` train moved repo, Worker (by
hand), and admin onto `dc5ee000aebf` and left license on the index it was last deployed with, which
is the one from the 2026-07-29 fleet deploy. Every release will do this until a leg covers every
index-baking surface. Closing it needs a receipted `caisson-license` redeploy at the release SHA —
an operator-gated act, tracked in [outstanding work](../state/outstanding-work.md).

**The Worker half of that class is now fixed in CI.** `deploy-worker.yml` deploys the Worker from an
ancestry-verified ref and then proves the live edge serves that ref's index before reporting green;
the train runs it as leg 1b, after leg 1 uploads the bytes and before leg 4 puts the site live.

## 2026-07-30 (PM) — release train `v2026.07.30` off `d9ae893e` (first fully automated leg 4)

The DEPLOY act for the `v2026.07.30` release train. **The first ride where leg 4 deployed by itself**
— every prior fleet deploy in this log was run by hand from the operator's box.

**Leg 4 deployed `caisson-admin` (19:21:41Z) then `caisson-site` (19:24:27Z), in that order.** The
ordering is load-bearing and now enforced in the workflow: `apps/admin` is the internal-proof bearer
VERIFIER and `apps/site` is its ISSUER, so a new issuer against an old verifier is a hard 401 on every
buyer evidence dashboard. Both at `d9ae893e`; receipts appended in `docs/deploy/receipts/`.

**What made that possible:** `railway up --ci` exits non-zero when its build-log stream drops, and did
so on five consecutive runs today whose deployments Railway's ledger records as `SUCCESS`. That false
RED was not cosmetic — on run `30562233469` it failed the admin step and skipped site, half-deploying
the fleet. `80748af3` moved the verdict off the CLI exit code onto the deployment's own terminal
status (`--detach` was rejected: it reports green on upload acceptance, a false green).

**The registry Worker was a manual step on this ride** (fixed 2026-07-31 — see the entry above). The
train had no leg for it, and it is not optional: leg 1 uploads tarballs to R2, but `deploy-entry.ts`
inlines `registry/index.json` into the Worker bundle at build time, so a published version is not
_resolvable_ until the Worker is redeployed. Run by hand here (`registry/worker/deploy.sh` → version
`d5e82c9b`). Between leg 4 and that redeploy the site advertised `@caisson/kernel/node` while the
registry still resolved 0.6.0, where that entry point does not exist.

**Edge propagation is not instant.** For roughly a minute after the Worker deploy the packument still
served the previous `dist-tags.latest`. A probe fired immediately after `wrangler deploy` reads stale;
give it a minute before concluding a deploy failed.

| Surface             | Evidence                                                                          | State  |
| ------------------- | --------------------------------------------------------------------------------- | ------ |
| caisson-admin       | Railway `f343ee3b` SUCCESS 19:21:41Z (verifier, deployed first)                   | **OK** |
| caisson-site        | Railway `0411ebf6` SUCCESS 19:24:27Z; `/updates` shows `kernel-browser-safe-v0-6` | **OK** |
| Registry Worker     | `wrangler deploy` → version `d5e82c9b`; `registry.caisson.sh` 200                 | **OK** |
| Registry resolution | `@caisson/kernel` packument + `/modules` both `0.7.0`; `@caisson/ui` `0.6.4`      | **OK** |
| Buyer install path  | clean-env `bun add @caisson/kernel` → **0.7.0**, exports include `./node`         | **OK** |
| Tarball integrity   | `kernel-0.7.0.tgz` 200, 76576 bytes — matches the `tarballs.json` row exactly     | **OK** |
| Entitlement gating  | anonymous `/index.json` serves **17** modules (the Apache-2.0 base) — unchanged   | **OK** |
| Public mirror       | caisson-oss HEAD `97856957` "mirror sync from d9ae893"                            | **OK** |

**Not deployed this ride:** `caisson-license`, `caisson-docs`, `caisson-support-bot` remain at
`f9c04f33`. Leg 4 covers admin + site only; nothing in this release changed those services. **No
migration ran** — `0033` was already applied in the 2026-07-29 deploy below.

**npm leg skipped** by operator lock — `RELEASE_NPM_MIRROR_ARMED` is deliberately unset, so
`bunx @caisson-sh/cli@latest` still 404s. Expected, not a failure.

## 2026-07-29 (PM) — `RAILWAY_TOKEN` armed + full fleet deploy off `f9c04f33`

The DEPLOY act for the six PRs merged this sitting (#361–#366), and the close of the credential gap
the 2026-07-28 entry below opened.

**`RAILWAY_TOKEN` is now a repo secret** (operator-minted project token scoped to `caisson-prod`,
environment `production`; set 18:49Z, `gh secret list` confirms the name). This closes the
"next release train FAILS at leg 4" consequence recorded below — the train's leg 4 passes
`require_armed=true` and will now find the token. **Second consequence, new:** `deploy-railway.yml`
self-arms on path-triggered pushes, so the next merge touching `apps/site/**` or `packages/**`
deploys `caisson-site` for real instead of skipping green. That job deploys the site **only** — it
never migrates (see the 2026-07-15 migration lesson below), so arming did not put the platform
chain on a push trigger.

**Migration (the one real schema act):** `caisson-license`'s `preDeployCommand` printed
`[deploy-migrate] platform: applied 1, skipped 32` — `schema_version` 32 → **33**. The single new
entry is `0033_entitlement_grant_refunded_amount.sql` (ADR-0394, release-audit F2: `refunded_amount`

- `refunded_adjustment_ids` + the non-negative CHECK). `0030`/`0031` were already live from the
  07-28 deploy. Tail append past the checksum-pinned tail, so no repeat of the PR #254 mid-chain drift.

**Deployed at `f9c04f33`** via the receipted immutable-input path
(`tooling/scripts/railway-deploy.ts --ref f9c04f33`), locked order — license first, then the rest in
parallel. Receipts in `docs/deploy/receipts/*.json`.

| Surface             | Evidence                                                             | State  |
| ------------------- | -------------------------------------------------------------------- | ------ |
| caisson-license     | `applied 1, skipped 32`; `issuer serving on :8080`; `/health` 200    | **OK** |
| caisson-site        | `/` `/healthz` `/marketplace` `/updates` all 200, ≤330ms             | **OK** |
| caisson-admin       | `/healthz` 200                                                       | **OK** |
| caisson-docs (RAG)  | `/health` 200 → `{"ok":true,"chunks":556}` (was 548)                 | **OK** |
| caisson-support-bot | deploy complete; Online (private, no public DNS by design)           | **OK** |
| Registry Worker     | `wrangler deploy` → version `1cc288cd`; `registry.caisson.sh` 200    | **OK** |
| Index parity probe  | repo `4810e38157c1`/54 · license · worker (17) · admin → `PARITY OK` | **OK** |

The Worker redeploy is not cosmetic: `registry/index.json` is unchanged since the last one, but the
Worker bundles `@caisson/registry-schema`, which carries the F1 fail-soft in
`addNamedEntitlementClosure` — an unresolvable compatibility edge is now skipped per-edge instead of
throwing away the buyer's entire purchased-id set. That fix only reaches the edge gate through this
deploy.

**Not done here:** no version cut, no tag, no registry publish — changesets stay unconsumed for the
next operator-gated release train. `npm` delivery stays unarmed (ADR-0329).

## 2026-07-29 — independent parity re-probe: still OK, one day after the release

No deploy. `bun registry/scripts/index-parity-probe.ts` was re-run from a clean checkout to confirm
the release receipt with a second, independent reading rather than citing the train's own output:

| Leg     | Result                                    |
| ------- | ----------------------------------------- |
| repo    | `4810e38157c1` · 54 entries               |
| license | `4810e38157c1` == repo                    |
| worker  | 17 served entries all match repo `latest` |
| admin   | `4810e38157c1` == repo                    |

`RESULT: PARITY OK`, exit 0. Public HTTP: `caisson.sh`, `license/health`, `admin/healthz`, and
`registry/index.json` all 200 under 400ms. Docs-RAG and support-bot have no public DNS by design —
they are private Railway services. The site's `POST /api/ask` proxy is the only outside path to
docs-RAG and it is Turnstile-gated (`{"error":"challenge_failed"}`, 403), so both legs stay
uncertified by any automatable method. This reading is what retires the DRIFT rows that
[production readiness](../state/production-readiness.md) had been carrying since before the release.

## 2026-07-28 — v2026.07.27.1 released: train green, 50 tarballs published, full parity

The re-cut tag shipped. `v2026.07.27` had been pushed on the version-PR merge and its train **failed
at readiness R3** — `bun run sot` red on a package-count drift, plus a missing R4 audit and
per-release checklist, both of which readiness reads from the **tagged tree**. `v2026.07.27.1` is the
attestation-only successor: docs, the audit, the checklist, and fixes confined to unpacked trees, so
every recorded tarball hash was untouched and the byte gate passed on the first ride.

**Tag:** `v2026.07.27.1` → `8f930b6753d9`, the first **signed** release tag (SSH, ADR-0382;
`git tag -v` → `Good "git" signature for admin@caisson.sh`). GitHub still shows it unverified until
the signing key is registered on the account — the `gh` token lacks `admin:ssh_signing_key`, so that
one step is outstanding and cosmetic (GitHub re-evaluates signatures at display time).

**Train** (run 30363421552): readiness ✓ · leg 1 registry publish ✓ · leg 2 mirror sync ✓ · leg 3 npm
mirror **skipped** (unarmed pre-launch, by design) · leg 4 site redeploy **inert — see below**.

| Leg / probe        | Evidence                                                                                               | State  |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------ |
| Registry publish   | **50 uploaded, 4 already present**; every row "packed bytes match the recorded row"                    | **OK** |
| R2 parity probe    | **350/350** advertised objects reproduce (was 300/350)                                                 | **OK** |
| Index parity probe | repo `4810e38157c1`/54 · license · worker · admin all equal → `PARITY OK`                              | **OK** |
| Registry Worker    | redeployed from the tagged index, version `07c65081`; serves 17 anon entries                           | **OK** |
| Site               | `/updates` v0.5 entry + RSS live; marketplace renders $1,649 / $2,259 / $249                           | **OK** |
| Docs-RAG           | `/health` 548 chunks; generated pricing corpus carries $1,649 / $2,259 / $249 and neither stale figure | **OK** |

Railway services were deployed from the tag through the receipted immutable-input path
(`tooling/scripts/railway-deploy.ts --ref v2026.07.27.1`): admin, license, site, docs — receipts in
`docs/deploy/receipts/*.json`, all at `8f930b6753d9`. No new `.sql` migration landed between the
Act 1 SHA and this tag, so the license pre-deploy chain re-ran idempotently and `schema_version`
stays 32 — this was not a second migration act.

### The train's site-redeploy leg ships nothing (found during this release)

`deploy-railway.yml` guards on a `RAILWAY_TOKEN` **repo secret** that is not set. Its arm check
writes `armed=false`, every subsequent step is `skipped`, and the job reports **success**. Three
green `deploy-railway` runs in this session deployed nothing, and the train's leg 4 is decorative
today: a release can report a fully green train while the site still serves the previous image. It
was caught only because a post-deploy probe read the live `/updates` page and the new entry was
absent. The inert-until-armed pattern is deliberate (ADR-0318 W3), but an unarmed leg inside an
**armed** train is a false green — leg 1 already refuses to no-op for exactly this reason.

**The fail-loud half is CLOSED** (`45683e6e`, post-tag remediation PR #360): `deploy-railway.yml`
takes a `require_armed` input and the train's leg 4 passes `require_armed=true`, so an absent
`RAILWAY_TOKEN` now aborts the train instead of skipping green. Path-triggered pushes still skip
green, which is the deliberate inert-until-armed posture. **The consequence is operator-facing and
immediate: the next release train FAILS at leg 4 until `RAILWAY_TOKEN` is added as a repo secret.**
Arming it is a credential act and stays with the operator; until then, deploy from the operator box
with `tooling/scripts/railway-deploy.ts --ref <tag>`, which is how every receipt in
`docs/deploy/receipts/` was produced.

### Post-deploy observation

Raw docs-RAG `/query` retrieval did not surface the Compliance bundle price for direct phrasings
("How much is the Compliance bundle"), and "Compliance renewal price" returned the $1,499 Updates
**plan** instead. The corpus itself is correct — verified by regenerating the pricing sources, which
contain $1,649 / $2,259 / $249 and neither stale figure — so this is retrieval ranking, not stale
content. Carried as a follow-up, since a buyer asking the support bot a plain price question is the
exact path affected.

**Root-caused and fixed 2026-07-29 (post-tag remediation PR #360).** Reproduced against the real
corpus, where it was worse than observed: **no** plain price question put a single `pricing/*` chunk
in the top 5 — not "how much is the Compliance bundle", not "how much is Everything" — on a corpus
whose generated pricing docs exist for exactly that purpose. The cause is vocabulary, not ranking
weights: the generated heading reads `## Compliance — $1,649`, which shares no token with "how
much", "cost", or "price", and the FTS floor has no synonyms. Each bundle now carries a one-line
answer in the buyer's own words with the renewal figure beside the list price, projected from the
SOT's own `renewalAmount` rather than typed in.

Two things worth keeping from the fix. First, the module cost lines were **reverted**: adding the
same line to all 27 modules pushed `licensing.mdx` out of the top 5 for "how do I renew my license"
and put the `audit-worm` price card above the `audit-worm` doc — 27 copies of one explanation
outrank the single page that owns the topic. Second, and the reason this reached production green:
`retrieval-golden.integration.test.ts` called bare `buildCorpus()`, so the ~40 pricing chunks the
service actually serves had **zero** golden coverage while the suite read as end-to-end. It now
builds the corpus the way `server.ts` does and fails loud if the pricing SOT is unreachable.

## 2026-07-27 — Act 1 executed: one-SHA fleet + migration chain through 0032; PARITY OK

The ADR-0379 T4 hold was released by the operator and the preliminary one-SHA fleet ran end to end.
**Every leg is built from `e6ee01a6`** (receipts in `docs/deploy/receipts/*.json`). The long-standing
red parity is CLOSED.

| Leg             | Evidence                                                             | State  |
| --------------- | -------------------------------------------------------------------- | ------ |
| Registry Worker | Cloudflare version `a515a0fe`; serves 17 anon-filtered entries       | **OK** |
| Repository      | index digest `74e92a6813bc` · 53 entries                             | source |
| License         | `09adca8d32a5`/49 entries → **`74e92a6813bc`/53**                    | **OK** |
| Admin           | `97b183902c08` → **`74e92a6813bc`/53**                               | **OK** |
| Site            | healthz 200; marketplace renders $1,649 / $2,259 / $249              | **OK** |
| Docs-RAG        | 548 chunks, semantic index rebuilt (269 cache hits / 279 new embeds) | **OK** |
| Support bot     | /health 200                                                          | **OK** |

`bun registry/scripts/index-parity-probe.ts` → **`RESULT: PARITY OK`**.

### Migration receipt (data-migration act)

The migration is not a separate step: `services/license/railway.toml` runs
`bun apps/site/lib/deploy-migrate.ts` as `preDeployCommand`, so deploying license LAST _is_ applying
the chain. `schema_version` went **29 → 32** (`0030`, `0031`, `0032_field_crypto_keys.sql`).

Post-migration structural receipt, per the runbook's pre-wrap requirement:

| Assertion                                       | Result                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| `field_key_version` + `field_wrapped_dek` exist | both present                                           |
| Forced RLS                                      | `rowsecurity` **and** `relforcerowsecurity` true, both |
| Tenant policies                                 | `*_tenant_isolation` (cmd ALL) on both                 |
| Append-only guards                              | `*_no_mutation` on **UPDATE and DELETE**, both tables  |

Pre-migration backup: `~/backups/caisson-preT4/20260727T211420Z` — `pg_dumpall --globals-only` (6
roles incl. `admin`/`admin_write`/`admin_app`/`app`) plus custom-format dumps of `railway` (47 data
tables) and `admin_auth` (4), each verified readable with `pg_restore --list`.

### BLOCKING preflight — `tenant_ai_credential` (ADR-0392)

Run before any Azure arming, with the privilege proof the runbook requires (a bare count is a false
green under FORCE RLS): `current_user = postgres`, `rolsuper = t`, `rolbypassrls = t`,
`bypasses_rls = t`; `SET row_security = off` accepted with no `SET LOCAL` warning; **`sealed_rows = 0`**.
The wave's premise holds — nothing is sealed, so the version-collision data-loss path is not live
whenever Azure is eventually armed.

### Buyer-flow probes

| Probe                   | Result                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Paddle webhook → grant  | **PASS** — signed delivery drove verify → `applyBillingEvent` → real grant row → teardown                                 |
| Site live suite         | **PASS** — 19 tests (buyer-dashboard flow, prod routes, analytics bundle)                                                 |
| Unknown SKU             | **PASS** — HTTP 500 fail-closed; **0** grant rows written                                                                 |
| Docs-RAG catalog answer | **PASS** — `Compliance — $1,649`, `Everything — $2,259`                                                                   |
| Support-bot answer      | **PARTIAL** — retrieval source (docs-RAG) verified; the bot answers over Discord, so end-to-end needs an operator message |

### Not armed, deliberately

`site.byok-field-crypto` remains **unarmed**: zero of the seven `AZURE_*` names are on
`caisson-site` and none exist in the secret source of truth — the Key Vault, key, and service
principal were never provisioned. Operator-deferred for this deploy (reachable only via a buyer BYOK
submit, which is gated and has no caller). It stays a REQUIRED seam blocking paid launch.

## 2026-07-27 — local reconciliation only; fleet unchanged

Local `main` now represents the validated writing surface, OSCAL spine/catalog, Ask AI evidence,
and checkout/Python supply-chain pin updates. The field-crypto KMS async branch remains outside
`main` for fresh exact-head review. No PR was remotely merged, no artifact was published, no
provider setting changed, no migration ran, and no service was deployed or restarted. The runtime
parity evidence below is therefore unchanged.

## Current fleet parity — superseded 2026-07-27 (see the Act 1 entry above)

The table below is the pre-Act-1 state, retained for history. Live parity is now **OK** on
`e6ee01a6` / `74e92a6813bc`.

## Historical fleet parity — 2026-07-25

Health and source parity are separate:

| Leg                           | Current evidence                                          | State                        |
| ----------------------------- | --------------------------------------------------------- | ---------------------------- |
| Audited repository baseline   | `fe2dfaca`; registry digest `74e92a6813bc` (53 entries)   | source                       |
| Registry Worker               | 17 served entries match repository latest                 | OK                           |
| License                       | digest `09adca8d32a5`                                     | **DRIFT**                    |
| Admin                         | digest `97b183902c08`                                     | **DRIFT**                    |
| Site                          | latest site-only source `ea2bee11`, deployment `3120a2ef` | not a fleet receipt          |
| Docs-RAG / support-bot        | no current same-source receipt                            | uncertified                  |
| Site migrations `0030`–`0032` | authored in source                                        | production apply unreceipted |

ADR-0379 supersedes any “fleet current” or CAISSON-150 defer wording below. The next production
act is one approved immutable SHA across site, admin, license, docs-RAG, support-bot, and Worker,
followed by migration and parity/probe receipts. This is an external-system/data-migration hold.

## 2026-07-25 — OSCAL catalog source ready; sandbox rows minted

The OSCAL wave carries the 36-product/68-price desired catalog, with Compliance at $1,649 and
Everything at $2,259. Paddle Sandbox now has the standalone OSCAL product
`pro_01kye9596gvz4c25pjj7hf4rz5`, purchase price
`pri_01kye9597z46149qg5xfrqxybk`, and renewal price
`pri_01kye959a399018w0hmvbeem7h`. The forward-only bundle reprice minted Compliance purchase
`pri_01kyeczreqq58ze5en0p3f0jkc` and renewal `pri_01kyeczrnp20006sebn9gzg5zb`, plus Everything
purchase `pri_01kyeczrjj0tzpwg7tv752e42s` and renewal `pri_01kyeczrrsq68b8wbx2atygs5a`; the four
predecessor prices were archived, not mutated, and remain in the append-only fulfillment resolvers.
No production catalog or fleet deployment changed; docs-RAG and support-bot remain on their old
image until the post-merge fleet deploy, after which the Act 6 price probe must assert both new
bundle prices.

## 2026-07-25 — clean-state wave live (site): truth-fixes + CVE batch

`railway up --service caisson-site` from clean main `ea2bee11` — deployment
`3120a2ef` SUCCESS, healthz 200. Live-verified: dead `bunx @caisson-sh/cli@latest`
hero command GONE (honest "private beta" chip, PR #327 / CAISSON-147), compliance
page now states GOVERNANCE-mode WORM with a typed escalation to COMPLIANCE at
launch (CAISSON-148; the leaked-root-key line dropped). Also in this image: the
2026-07-24 CVE batch (postcss 8.5.23, valibot 1.4.2, js-yaml/brace-expansion
re-resolves — 768e53f3) and dep-cruiser v18 (#303). Ledger context: visual
re-audit closed 729/0/0 same day (8a652c92). Board-audit D1 is now incorporated into
the ADR-0379 completion program (CAISSON-150).

## 2026-07-24 — post-deploy visual re-audit: the 14 accepted rows flip to fixed (CAISSON-149)

The illustration-placeholder family re-audited against production at `c6b42869`
(caisson.sh live). All 14 surfaces now render the ADR-0377/0378 proof-triad media where
the empty placeholder slots were: the 11 module pages (ai-evals, local-store,
retention-runner, audit-worm, field-crypto, alerting, agent-runner, agent-kernel,
guardrails, ai-meter, prompt-registry) each carry a real SSR blueprint sheet ("The
package in blueprint: …" caption + labeled SVG schematic, 32–55 SVG nodes on the pages
browser-probed), and the 3 bundle pages (agentic-dev, compliance, ai-kit) each carry the
cross-section strata ("bundle: … · cross-section · N members drawn"). Verification split:
4 pages browser-verified with playwright screenshots + DOM probes (ai-evals, local-store,
retention-runner, audit-worm) before a host Chrome fault killed the browser lane; the
remaining 10 verified via rendered-page extraction of the SSR schematic captions
(crawl4ai against production — the schematics are SSR, so the payload is the proof; the
browser-verified four confirm identical payloads paint as real schematics).
**Ledger reconciled: 729 rows = 729 fixed / 0 accepted / 0 open** — the ledger is fully
closed for the first time (`tooling/design-critic/findings.toml`, 14 accepted→fixed).

## 2026-07-23 — ADR-0378 media-overhaul program live (site)

The full program (PR 326 squash, `45784c38`; state batch `0bce43df`) deployed to
**caisson-site** with operator approval via the continue picker: `railway up` from the
repo root, deployment `c6b42869` SUCCESS first try. Live-verified: healthz 200; the
homepage decision band renders and StackBuilder is gone (the two remaining "your stack"
strings are the locked /stack-fit ghost-link copy); the marketplace toolbar catalog is
live with the stack dock/rail absent from the payload; module sheets SSR in the page
HTML; the field-crypto envelope-bench poke MOUNTS client-side in a real browser against
production (`data-poke` present, seal/key-version/golden-replay controls rendered —
pokes are ssr:false, so HTML greps cannot see them; browser verification is the proof).
This deploy also takes **next 16.2.11** live (the 2026-07-23 CVE batch: middleware
auth-bypass + SSRF x2 + Server Actions DoS fixed in production). The 14 accepted
ledger rows are now eligible to flip at the next re-audit.

## 2026-07-22 — open-row sextet live (site) + schematics kickoff opened (ADR-0377)

The six open live-reaudit ledger rows fixed, merged (PR 325 squash, `78a3b8fa`, CI 15
pass / 3 path-skips, opus SHIP review CLEAN with one P3 test-pin applied in-branch) and
**caisson-site redeployed** (deployment `bdf577b8` SUCCESS, `Deploy complete` clean
first try) with operator deploy approval via the picker. Live-verified with geometry
proofs: docs copy buttons carry the 44px `::before` catchment (measured 44×44 over the
24px button; the 34px header-button row was already catchmented by the P2-006 pass —
closed as already-mitigated), field-crypto terminal headline holds one line at 1440w,
home chain notation unified on `‖` (4/4 occurrences), marketplace dock clears the
footer's last row by 19px at full mobile scroll (footer pad 72px), ai-kit lede
reconciliation sentence live. Ledger reconciled: **729 rows = 715 fixed / 14 accepted /
0 open** — the open class empty for the first time; the 14 accepted stay owned by the
module-schematics kickoff (CAISSON-145), whose direction locked the same sitting
(ADR-0377: hybrid — blueprint sheets for modules, cross-section strata for bundles).
Lane litter `apps/site/outputs/admin-shots.ts` swept (gitignored but eslint-scanned).

## 2026-07-22 — visual-remediation phase closeout: wave + CVE bumps + ADR-0375 closeout live (site · admin)

The full ADR-0374/0375 visual-remediation phase merged and deployed in one sitting:

- **Merges (all squash, main CI green):** PR #319 the overnight ADR-0374 wave (`6d1c8051`,
  73 commits folded from the W1–W4 worktree lanes), PR #320 the four osv-scanner CVE dep
  bumps restoring the `deterministic` gate (`280f09d8`), PR #321 the ADR-0375 closeout —
  four operator locks: em-dash copy law, one-accent-eyebrow-per-page, legal
  bold+contrast conspicuousness, component tail (`af54102c`). #321 needed one CI round-trip:
  the rebased branch rode the wave's changesets pre-squash, so a branch-local
  site+admin patch changeset was added for the `--since=main` presence gate.
- **caisson-site redeployed** (image `aca16ed6`, `Deploy complete`) at main `af54102c`,
  `railway up` from the repo root per convention. Verified live: healthz 200;
  `/legal/terms` renders the conspicuous clauses sentence-case bold ("provided "as is"
  and "as available"", "Disclaimer of warranties" headings, zero residual ALL-CAPS walls).
- **caisson-admin redeployed** (deployment `9fca73b7` SUCCESS, image `848e6d57`) at the
  same SHA — first deploy carrying the mobile nav collapse disclosure. Edge answers 307
  to the in-app GitHub OAuth login as designed. Note: the CLI stream
  ended at `image push` without a `Deploy complete` line — completion confirmed via
  `railway deployment list` (status SUCCESS), not the stream.
- **Linear:** CAISSON-135…143 all moved to Done (the nine visual-audit + ADR-0374 items).
- The `deploy-railway` workflow run on the #319 merge push was an **inert no-op**
  (RAILWAY_TOKEN still unset — arms at cutover C2); manual `railway up` remains the
  real deploy path.

**Same-day residual batch (ADR-0376, PR 322 squash-merged `56e46f1c`):** the residual
picker's locks 1+3 built and deployed the same sitting — legal "On this page" jump-nav
rail (rendered-geometry proof green pre-merge), waitlist Turnstile `onReady`
sibling-mount fix, harness third-party console filter, light `surface-1` L step
(contrast matrix 60/60), admin foundations explicit 3-up grid. Opus SHIP review PASS
(two P3s applied in-branch); CI 16/16 green. **caisson-site redeployed** (`Deploy
  complete`; TOC rail + section ids verified live, healthz 200) and **caisson-admin
redeployed** (deployment SUCCESS; edge 307 to in-app GitHub OAuth) at `56e46f1c`. The lock-4
standard live re-audit + final ledger reconcile ran as the phase-closing act (see the
tracker row for the resulting ledger state).

**Lock-4 re-audit tail (same sitting):** the 10-lane live re-audit verified 8 fix
classes outright and surfaced three real leftovers, fixed and shipped as two micro-PRs —
PR 323 (`2bfc60e0`: terms EULA link was color-alone, marketplace catalog section
duplicated the hero accent eyebrow) and PR 324 (`5788b030`: the hero artifact label
"one base, 5 composable bundles" contradicted the page's own six-bundle lede/facet —
now "+ Everything", chips unchanged). **caisson-site redeployed** at `5788b030`
(`Deploy complete`; all three fixes verified live; healthz 200) — note the FIRST
redeploy attempt at `2bfc60e0` died in the Railway builder during the type-check step
with no error line (CI had built the identical tree green; builder transient) and never
touched the live deployment; the `5788b030` deploy superseded it. **Final reconcile:**
the design-critic ledger closed at **729 rows = 709 fixed · 14 accepted (the
illustration-placeholder family, owned by the module-schematics kickoff CAISSON-145) ·
6 open** (curated info-tier findings from the live re-audit: docs touch targets ×2,
field-crypto headline wrap, home glyph inconsistency, dock-over-footer at exact scroll
bottom, ai-kit four-vs-seven copy nuance).

## 2026-07-20 (third wave) — compliance-gap SKU arming: two trains + catalog debut

The ADR-0373 arming executed end-to-end in one sitting (checklists
`docs/releases/v2026.07.20.{2,3}-checklist.md`, audit
`outputs/audit/release-audit-v2026.07.20.3.md`):

- **v2026.07.20.2** (tag `5b37fb0e`, consume 1 = the sellable flip + bundle join, PR #316):
  readiness 9/9, train ALL GREEN. **Registry Worker redeployed** (`42f33702`) post-train;
  r2-parity re-dispatched manually (workflow_run stays suppressed for GITHUB_TOKEN-dispatched
  trains): 293/294, sole miss = the known agent-trajectory 0.3.0 stranded row.
- **Consume 2** (PR #317, merged `8b728f95`, 18 checks green) — sibling churn predicted locally
  and the signing-primitive repack changeset PRE-landed on main, so the version PR came out
  clean first round. Index truth verified: three SKUs sellable at the locked prices,
  compliance 13 / everything 34 members at 0.2.0 pins.
- **v2026.07.20.3** (tag `b1be281f` at the attestation commit): local byte-gate proof green
  before tagging, readiness 9/9, train ALL GREEN. **Registry Worker redeployed** (`0dcd2c49`);
  r2-parity 300/301 — same sole stranded-row residual. Mirror private, npm leg unarmed.
- **Catalog-debut PR #318 squash-merged** (`108a358a`; main CI 4/4 green) after a two-audit
  SHIP pass — opus review (P0 compliance-page composed-vs-standalone honesty + 4 nits, all
  fixed) and a fable money-seam audit (**PASS, no blockers**; its LOW — a silent fail-open in
  the new pricebook-agreement gate — fixed in-PR with a visible warn + smoke tests). Ships the
  pricebook books + COMPLIANCE_GAP join instants, the $1,449 site display + three MODULE_PRICES
  rows, Paddle sandbox wiring (3 products + 6 prices minted via the recreate tool; both
  existing compliance prices PATCHed in place — price ids stable, no dashboard edit), leaf-set
  pin re-capture, RIDER3 prune, and the deploy.sh Worker build-surface fix.
- **Registry Worker redeployed** (`655a9b0c`) at the merge commit — serves the COMPLIANCE_GAP
  membership timeline; the fixed deploy.sh built all three workspace deps cleanly.
- **caisson-site redeployed** (image `5e46a81b`, `Deploy complete`) at main `108a358a` after a
  self-inflicted 10-failure detour: `railway up` was run from `apps/site`, uploading only that
  subtree while `railway.toml`'s `dockerfilePath` is repo-root-relative — the builder aborted
  with `couldn't locate the dockerfile` before any build step, surfacing only the misleading
  `scheduling build on Metal builder` line (initially misdiagnosed as the 2026-07-19 platform
  incident recurring; the operator-supplied dashboard build log showed the real cause).
  **The command must run from the repo root** (the railway.toml header says so; memory #380).
  Verified live: `/compliance` shows $1,449 + "Thirteen packages" with the composed-10 vs
  standalone-3 copy; all 26 module cards render buyable on `/marketplace` including the three
  debuts at $199/$279/$149; healthz 200. Known content gap (not a bug — links are conditional):
  no MODULE_PAGES depth records for the three yet → CAISSON-134.

The close-out picker's execution (PRs #312/#313, both squash-merged green same sitting):

- **Registry Worker redeployed** (version `e2221ad1`) serving the pruned index — 60 stranded
  mid-chain versions delisted append-only; live spot-check: kernel packument now lists only
  uploaded versions (0.5.1/0.4.2 gone, `latest 0.5.3` intact). The re-dispatched r2-parity
  probe (run 29749913921) converged **61 → 1 miss** — exactly the carved-out member-pinned
  version, which delists in a follow-up prune after the next consume repoints the
  agentic-dev/everything bundle pins.
- **caisson-site redeployed** (image `622a5db0`, `Deploy complete`) at main `0f2215e7` carrying
  the #313 fix batch: catalog-derived depth-page prices AND the three pages that had been
  rendering raw template source (tool-exec · org-controls · local-sync) — all three verified
  200 with zero raw-source remnants live.
- The dud `v2026.07.20` tag + GitHub Release deleted (operator-authorized at the picker);
  `v2026.07.20.1` is the sole `.20` tag and Latest.

## 2026-07-20 — v2026.07.20.1 release train GREEN + deploy tail (Worker · site · intel)

The v2026.07.20 tag's first ride FAILED CLOSED at the publish byte gate (`@caisson/kernel@0.5.3`
packed ≠ recorded — the release-branch refresh recorded the row under a bun.lock resolution the
squashed tag tree doesn't reproduce; the known lock-sensitive kernel-pack class). Repair per the
gate's prescription: row re-recorded from a pristine frozen-lockfile worktree at the tag, the
FULL byte gate then proven locally (`ci-publish-step --mode publish`, exit 0, every package
byte-verified), successor tag `v2026.07.20.1` cut at the attestation commit `c30d6153` on the
pre-wave chain (CI attached via throwaway-base PR #311, closed unmerged; readiness 9/9 local).
**Train run 29744131724: ALL LEGS GREEN** — readiness, publish child 29744179767 (byte gate +
R2 upload), mirror-sync, deploy-railway (inert no-op). Deploy tail executed same sitting:

- **Registry Worker** redeployed (`registry/worker/deploy.sh`, version `7f4c0e35`): serves the
  consumed index — `@caisson/kernel` `dist-tags.latest` `0.5.2 → 0.5.3` verified live at
  `registry.caisson.sh`; `kernel-0.5.3.tgz` 200 from R2 (71,535 bytes). Brief propagation lag
  (~1 min) showed the prior version — re-probe before diagnosing.
- **caisson-site** redeployed (`railway up -y --service caisson-site --ci`, image `a05eeb86`,
  `Deploy complete`) at main `1a78b64e`: glossary at 50 terms + the /updates coverage-window
  section live. Probe 200.
- **caisson-intel** rebuilt (`docker compose up -d --build`) for dep-digest transitive v2.
- r2-parity probe re-dispatched post-upload (run 29745214071): **61 advisory misses,
  byte-identical to the pre-ride set — leg 1 healed NOTHING, and that is structural.** Every
  miss is a MID-CHAIN version (kernel-0.5.1, mcp-server-0.6.0/0.6.1, platform-reads-0.2.2/0.2.3,
  pricebook-0.5.5/0.5.6, …): a consume not followed by a ride before the next consume strands
  the intermediate version — the publish leg stages only the tag tree's CURRENT versions, so a
  superseded version's tarball can never upload from any later train (the ride-after-consume
  rule's permanent consequence). Zero buyer impact today (`latest` coverage green; the stranded
  versions 404 and were never installable). Remediation forked on the tracker: version-delist
  prune of the 61 (the established machinery) vs per-consume-commit backfill — operator's call.
- The dud `v2026.07.20` tag + GitHub Release await operator deletion (tag mutation stays
  operator-only). The compliance wave (PRs #304-#307) is merged on main but NOT in this tag —
  its packages ride the next consume; the three new SKUs stay reserved-unpublished pending the
  pricing round.

## 2026-07-19 (post-midnight) — dep-digest watcher live in the local intel daemon

`caisson-intel` rebuilt (`docker compose up -d --build`, healthy) at main `ad9b1e03`
(PR #297, ADR-0369): the weekly `dep-digest` watcher registered and ran its first sweep on
boot — 1 finding, delivered end-to-end as Linear draft CAISSON-129 (the deliberate
typescript API-dep <7 hold, with the buyer-impact package list; dedup keeps it a one-time
marker). toolchain-advisory workflow retired; declaration drift now bump-gated in PR CI.

## 2026-07-19 (late night, second) — caisson-site redeploy at `cd48b89d`: bespoke marks live

Delta deploy (SUCCESS first attempt) carrying PR #296: the 12 lucide placeholder marks
became bespoke brand glyphs (family 22 → 34; design-lane authored, all seams in lockstep).
Probes 200. Changeset (ui/brand/site patch) accumulates with the rest.

## 2026-07-19 (late night) — caisson-site redeploy at `e07319f9`: 23 module depth pages live

Single-service delta deploy carrying PRs #294 + #295 (ADR-0368). First attempt FAILED at
the runtime stage after a clean image build (the same transient Railway class as the
morning incident); the immediate retry deployed SUCCESS — the killed-deploy-may-have-landed
rule checked, only one live deployment.

- 12 new module depth pages (MODULE_PAGES 11 → 23) + the ai-evals bundle-membership truth
  fix + lucide marks for the new slugs. Probes: agent-trajectory · credits · ui-pro ·
  compliance-core · ai-evals module pages all 200, `/healthz` 200.
- `compliance-updates` depth page STRUCK at content review (subscription anchor, not a
  catalog module); record archived under `outputs/research/`.
- The tsgo cutover (#294) rides in the same image: the site's dependency packages compiled
  through the native TS-7 `tscn` bin inside the Railway build (40/40 tasks, ~50s).
- Pending changesets now: auth minor + site patch ×3 + the 53-package cutover patch — all
  accumulate for the next train per the standing lock.

## 2026-07-19 (night) — caisson-site redeploy at `8f07b011`: 43-term glossary live

Single-service delta deploy (`railway up --service caisson-site --detach`, SUCCESS)
carrying PR #293 (ADR-0367): the 7-term glossary expansion batch + the 16-fix content
audit over the existing 36 pages. Site-only content change — the rest of the fleet
stays at `655bb26a` (no code delta for those services), Worker untouched.

- Probes: `/glossary/rfc-3161-timestamping` 200 · `/glossary/token-hash-at-rest` 200.
- Pending changesets (auth minor + site patch ×2) accumulate per the ADR-0367 lock;
  they ride the next train.

## 2026-07-19 (late PM) — Full fleet redeploy at `655bb26a`: hash-at-rest live

All five Railway services rebuilt from main `655bb26a` (`railway up --detach`, all
SUCCESS): site · admin · license · docs · support-bot. Carries PR #292 (ADR-0366
session-token hash-at-rest) as the only code delta since the previous wave.

- **`SESSION_TOKEN_HMAC_KEY` armed**: provisioned this sitting (env store +
  `caisson-site` Railway var, hash-parity verified, value never displayed; 1Password
  vault copy backlogged to the next env-management session). Site boot passed the
  fail-closed key check — caisson.sh 200.
- **Cutover proven**: `session` table reads 0 raw-token rows post-deploy (0 hashed /
  0 raw — empty pre-launch; the invariant "no raw tokens at rest" holds from here on).
- Probes: caisson.sh 200 · /trust 200 · admin.caisson.sh 200 · license /health 200 ·
  support-bot /health 200.
- **Registry Worker NOT redeployed — deliberate**: `registry/` + `registry-schema`
  untouched since the `f3952684` deploy (verified by diff); index unchanged.

## 2026-07-19 (PM) — Wave rides v2026.07.19 + v2026.07.19.1 + Worker redeploys

Two further train rides the same day, both delivered:

- **v2026.07.19 (the lock-hash ride, `028e5ca9`): FIRST fully green end-to-end train** —
  readiness, publish (12 uploaded + 37 present), mirror-sync, deploy-railway, all legs on
  Blacksmith. 12 sidecar rows carry lockHash from this ride on.
- **v2026.07.19.1 (the wave ride, `a49d82fd`)**: OSCAL live-push transport
  (compliance-core 0.5.0) + the multi-year renewal lever mechanism (pricebook 0.7.0) +
  the lock-hash annotate refinement + two repack refreshes. Publish leg green
  (5 uploaded + 44 present); the train run shows red only because its watch loop hit a
  network reset AFTER the publish succeeded — mirror-sync dispatched manually, green.
- **Worker redeployed twice** (`3002077a` after .19, `f3952684` after .19.1); kernel
  packument serving `latest: 0.5.2` verified after each.
- Guard lesson recorded: the lock-hash short-circuit mass-flagged identical-byte rows
  (whole-lock hash moves every consume) — refined to annotate-on-mismatch (PR #290);
  platform-reads hit its fourth resolution-drift repack (terminal cure if it recurs:
  scoped isolatedDeclarations).

## 2026-07-19 — Agent-trajectory release train v2026.07.18.3 + Worker redeploy (`31917e36`)

The agent-trajectory deploy tail (operator-approved; picker locks in ADR-0365). Four tags
to land one release — the full lineage lives in `docs/releases/v2026.07.18.3-checklist.md`:
byte-gate repair (kernel@0.5.2 sidecar re-record) → GitHub free-org Actions minutes
EXHAUSTED mid-ride (2,003/2,000; ubuntu-latest jobs died zero-step) → train legs moved to
Blacksmith → a sot freshness cascade fixed at the fourth tag.

- **Train ride v2026.07.18.3 (run 29681287040): readiness green, publish leg green — R2
  upload 44 uploaded + 5 already present (49/49 byte-verified at the tag), mirror-sync
  green (caisson-oss stays PRIVATE), npm leg unarmed (ADR-0329).** The train run shows
  red only from the dispatched deploy-railway leg — the designed-inert, deliberately
  still-hosted job, quota-killed (zero-step). Delivered: agent-trajectory 0.3.x + its
  bundle membership, kernel 0.5.2, the full-catalog re-version, agent-usage index entry.
- **Registry Worker redeployed** (`bunx wrangler deploy`, version `e9854324`) off main at
  the tag content — serves the new index: kernel packument `latest: 0.5.2` verified live;
  commercial packuments stay constant-time 404 unauthenticated (agent-trajectory probe).
- **caisson-site + caisson-license redeployed** (`railway up`, SUCCESS on the third
  attempt — the first two died at `scheduling build on Metal builder`, a Railway
  degraded-performance incident, cleared ~09:45Z). Probes: site `/healthz` 200 +
  `/marketplace` serves agent-trajectory; license `/health` 200 (new purchase/renewal
  books live). Sandbox Paddle prices for agent-trajectory ($49 + $19 renewal) created via
  `tools/paddle-catalog-recreate.ts`.
- **Blacksmith-only runner posture landed** (operator directive): `deploy-railway` — the
  last hosted job — flipped (`585dfc81`); the next main push ran ALL workflows green
  including intel-eval on Blacksmith, confirming its three reds were quota kills.
- Follow-ups merged same sitting (PR #285): lockHash row provenance (CAISSON-127),
  Blacksmith sweep of quality/intel-eval + version-pr + r2-parity-probe (intel-eval's
  reds were quota kills, not eval regressions), R4 P3 comment fixes. Changesets pending
  for the next consume.

## 2026-07-17 (night, close-out) — Worker redeploy off the audit-fix merges (`97c9924a`)

The DEPLOY tail of the audit-follow-up chain, per the operator's "proceed through audit
fixes, PR, merge, and worker redeploy" and the standing clean-main pre-approval.

- **Registry Worker redeployed** (`registry/worker/deploy.sh`, version `d41bd5b6`) off
  clean main `97c9924a` (the --strict-digests merge, PR 267). Content-identical to
  `c22eed25` — nothing under `registry/` changed since `fdf9dedb` (the two commits since
  are `f45ab6bd` terraform DMARC authz + `97c9924a` security-scan.yml) — run as
  belt-and-braces because the operator named the redeploy explicitly. Live probe:
  index.json serves, kernel packument 200.
- Same sitting, off-repo: Tailscale upgraded 1.98.4 → 1.98.9 on the box (daemon
  restarted); the DMARC external-report authorization TXT applied via terraform and
  answering live.

## 2026-07-17 (night) — SECOND full train ride v2026.07.17.5 + Worker redeploy: bundles with live pins (`fdf9dedb`)

The 14-changeset consume (version PR #266 → `8cd9ac5e`) rode the FULL release train — the
second ADR-0325 ride ever (today's earlier .1–.4 rides used the publish-lane dispatch). The
train's readiness gate first failed CLOSED (missing R4 audit + per-release checklist — the
attestation-only-successor shape from the 2026-07-12 operator lock), so the tag was re-cut
onto `fdf9dedb` carrying both artifacts; second run green end-to-end (run 29622027895).

- **Legs:** readiness 9/9 (incl. the live-hybrid retrieval golden leg, run locally green) →
  leg 1 byte-verified + uploaded the 9 new tarballs to R2 (never-overwrite) → leg 2 mirror
  sync appended `mirror sync from fdf9ded` to caisson-oss (healing the 5-day / 91-commit
  staleness the same-night audit sweep flagged) → leg 3 npm SKIPPED (unarmed pre-launch,
  ADR-0329) → leg 4 inert (`RAILWAY_TOKEN` unset).
- **What shipped:** the six bundles republished with live member pins (everything@0.2.4 ·
  compliance@0.5.4 · ai-production@0.2.2 · local-first@0.2.2 · provenance@0.2.2 ·
  agentic-dev@0.2.2 — the CAISSON-125 prune's customer-facing tail) + cli@0.6.3 +
  mcp-server@0.5.1 + ds-manifest@0.2.1. `skippedDelisted === 3` held in the live consume —
  the prune PR's P1 fix's first production exercise.
- **Worker redeployed** (version `c22eed25`) off clean main `fdf9dedb`. Live proof:
  cli@0.6.3 packument serves with dist, tarball GET 200 sha1-identical to the sidecar row
  (69d0dcd5/24607B); commercial bundles correctly absent unauthenticated (entitlement
  floor). Release notes buyer-clean (no tracker ids).
- Pre-launch gate stays ON; no R2 objects overwritten; ledger append-only holds.

## 2026-07-17 (late PM, after the parallel-wave deploy) — Worker redeploy: the CAISSON-125 prune live (`3fdc6a8d`)

Pre-approved by the operator ("worker redeploy approved whenever asking as it's off clean
main") as the DEPLOY tail of PR #265 (ADR-0359 — CAISSON-125 resolved PRUNE, not backfill).

- **Registry Worker redeployed** (`registry/worker/deploy.sh`, version `cd733a02`) off clean
  main `3fdc6a8d`, bundling the pruned `index.json`: the 93 R2-404 rows are no longer
  advertised (87 append-only version-delists for live modules + 6 sidecar-only removals under
  module-delisted ids; packument 330 → 243 versions, every module keeps ≥ 1 version, no
  latest touched). Verified live: `@caisson/kernel` serves 0.5.0 latest with 0.4.2 absent.
- **The daily R2 parity probe goes green by honest omission** — nothing advertised is
  missing from R2. The advisory-red state recorded in the entry below is CLOSED.
- No other service touched; no R2 objects written or deleted; pre-launch gate stays ON.

## 2026-07-17 (late PM) — Parallel-wave deploy: v2026.07.17.4 ride + Worker + caisson-site (`03b07b33`)

Operator-approved ("Ride + site redeploy") closing the ADR-0357 PM parallel wave
(PRs 257-260 + version PR 261 consume: agent-kernel/agent-dev 0.6.0 · mcp-server 0.5.0 ·
site 0.2.6 · registry 0.0.12). Pre-launch gate stays ON.

- **caisson-site redeployed** (`railway up`): the four ADR-0357 copy locks live — verified
  serving on `/compliance` (proof-scope block) and `/build-vs-buy` (DIY objection). No
  migrations in the wave (no license predeploy needed).
- **Registry publish ride `v2026.07.17.4`:** the first attempt (tag `v2026.07.17.3`) FAILED
  CLOSED at the byte gate — the 261 consume churned `@caisson/cli@0.6.2` packed bytes at an
  unchanged version (third occurrence of the pack-embeds-devDep-versions class). The new
  sibling-churn gate (PR 257) could not catch it: it runs only on release-branch synchronize,
  and a single-shot version PR never fires one — filed CAISSON-124 (run the check inside the
  dispatch `--mode version` step). Row re-recorded from a pristine no-build worktree at the
  tag (hash matched the byte-gate computation exactly, `03b07b33`), re-tagged, ride green —
  53 tarballs staged/uploaded byte-verified.
- **Worker redeployed** bundling the corrected sidecar + the 261 index: live `/index.json`
  advertises cli 0.6.2 + mcp-server 0.5.0 on the public floor (commercial entries correctly
  absent unauthenticated; agent-dev's "delisted — skipped" is pre-existing catalog state).
- **R2 parity probe first production run (auto-fired by the green publish; correctly SKIPPED
  after the failed one): DRIFT — 1 hash-mismatch + 93 missing.** The mismatch was tonight's
  own re-record meeting the ride's upload-never-overwrites rule (R2 kept the morning
  cli-0.6.2 bytes while the sidecar advertised the tag-tree bytes) — REPAIRED in-session per
  the morning's operator-locked overwrite procedure (`wrangler r2 object put` from a pristine
  tag pack, round-trip sha1 `c8d22311`/24602B verified). The **93 MISSING are the historical
  backlog**: superseded versions recorded in the sidecar that no ride ever uploaded (rides
  stage only rows current at ride time — the morning "43 byte-verified" and tonight's 53 were
  the current sets). The index/packument advertises full version history, so a buyer pinning
  an old version would 404 — pre-launch severity low, but it needs an operator fork (LOCKED same night: accept advisory-red — backfill tracked CAISSON-125)
  (backfill from historical checkouts vs prune historical rows vs accept-advisory). The
  probe stays red on its daily cron until that fork is decided — by design, it is advisory
  and gates nothing.

## 2026-07-17 (PM) — Kickoff-U reconcile wave: fleet redeploy + v2026.07.17.2 ride + R2 repair + Worker + PostHog activation (`331e971e`)

Operator-approved deploy wave closing the Kickoff-U reconcile (PRs #246/#247/#250/#251 + version
PR #256, ADR-0353–0356). Pre-launch gate stays ON (Paddle sandbox); Rekor anchoring set stays
UNARMED.

- **Fleet redeploy (touched four, `railway up`):** caisson-license (predeploy
  `applied 0, skipped 29` — no new migrations, swap confirmed), caisson-site (Ask-AI
  `$ai_generation` capture + version bumps), caisson-support-bot (M4 telemetry observer + clears
  audit M1 stale-code debt; fresh container confirmed), caisson-admin. services/docs skipped
  (unchanged). Probes all 200: site `/healthz` + `/demo`, license `/health`, support-bot
  `/health`, admin.
- **PostHog LLM-obs ACTIVATED (ADR-0356):** `POSTHOG_CAPTURE_KEY` set on caisson-site +
  caisson-support-bot from caisson.env (host defaults US). Events flow on the next real model
  call; no prompt/completion text by design.
- **Registry publish ride `v2026.07.17.2`** (second ride of the day): the first attempt (tag
  `v2026.07.17.1`) FAILED CLOSED at the byte gate — the #256 consume bumped workspace deps
  embedded in `@caisson/cli@0.6.2` + `@caisson/platform-reads@0.2.1` packed package.json at
  unchanged versions (the #249/#253 churn class), staling both append-only rows. Re-recorded
  from a pristine NO-BUILD worktree at the tag (`331e971e`; published tarballs are SOURCE packs —
  a built worktree poisons `bun pm pack` with dist/.turbo/test artifacts, 2-6x fat and can never
  match CI). Ride 2 green: **6 tarballs uploaded, 42 already present, byte-verified at the tag**.
- **R2 repair (operator-locked exception to never-overwrite):** the two re-recorded keys held the
  morning's bytes while the sidecar (and any future Worker packument) carries the tag-verified
  hashes — a Worker redeploy would have broken installs of exactly those two versions. Both
  objects overwritten with byte-exact tag repacks (sha1 `6269e79e` cli / `dc21caee`
  platform-reads), round-trip-verified from R2. Caveat: any pre-existing lockfile pinning the OLD
  integrity of these two versions fails — pre-launch that is only our own test installs.
  CAISSON-119's R2-parity probe covers recurrence.
- **registry Worker redeployed:** version `a52b98f1` from the pristine tag worktree (pricebook +
  license-verify dists built first; deploy.sh builds registry-schema). `registry.caisson.sh/health`
  200; packuments now advertise the v2026.07.17.2 rows consistent with R2.

## 2026-07-17 — runtime+sandbox wave: R2 publish ride + Worker + site/support-bot/license redeploys (`12182a52`)

Operator-approved close-out of the CAISSON-109/110 wave (PRs #244/#249/#253/#254/#255 + consumes
#245/#248/#252). Pre-launch gate stays ON (Paddle sandbox).

- **Registry publish ride `v2026.07.17`** (the sandbox audit's failing-install finding was a real
  prod registry gap): tag at `96645936` after 3 consumes + 2 stale-row re-records → publish.yml
  `dry_run=false` SUCCESS — **43 tarballs uploaded to R2, 5 already present, byte-verified at the
  tag**. Recurrence guards on CAISSON-119 (R2-parity probe; pack-embeds-devDep-versions churn).
- **registry Worker redeployed** (operator-approved): version `0a9e722d` via wrangler on a fresh
  worktree (built the missing pricebook + license-verify dists first — deploy.sh only builds
  registry-schema). `registry.caisson.sh/health` 200; scaffold install/build/test proof green
  against the live registry after rebuilding the stale bundled CLI index snapshot.
- **caisson-site redeployed** (`railway up`, SUCCESS): PR #254 `/demo` surface — prebuilt preview
  pane with a REAL passing transcript, demo-run with F5 atomic caps, bounded-body reads on
  demo-run + ask-ai. Probes: `/demo` 200 · bare POST 403 (Turnstile fail-closed) · `/healthz` 200.
- **caisson-support-bot redeployed** (`railway up`, SUCCESS) — carries the docs-RAG excerpt
  updates from the wave.
- **caisson-license redeployed twice** — the first run FAILED CLOSED on
  `checksum drift at version 24 (0024_rate_limit.sql)`: the three PR #254 site-local migrations
  (0023-0025) landed mid-chain because the shared platform chain had itself grown 0023-0026 and
  the assembly renumbers positionally. Fix PR #255 (merged `12182a52`) renamed them 0027-0029 +
  added an append-only assembled-ledger golden test. Second run SUCCESS:
  `[deploy-migrate] platform: applied 3, skipped 26` (`rate_limit`, `demo_run_budget`,
  `demo_run_leads` created), better-auth ensured. Post-migrate probe:
  `GET /api/demo/run` → `{"enabled":true}` 200 (was 500 on the missing tables).
- **Migration lesson (locked into tests):** site DB migrations apply ONLY via caisson-license's
  `preDeployCommand` — redeploying caisson-site alone never migrates; and a new migration's
  numeric prefix must sort past the merged chain's highest (claimed-prefix registry in
  `@caisson/platform-migrations`; next free `0030`).

## 2026-07-15 (PM) — trust-page site redeploy + intel container rebuild + Better Stack public status page (`0a58f8ee`)

Same-day follow-on to the reconcile redeploy below, carrying the two post-picker build PRs:

- `caisson-site` → redeployed with PR #242 (`/trust` page + subprocessor module + footer route);
  live probe `https://caisson.sh/trust` 200 with subprocessor table, betteruptime link,
  `security@caisson.sh`, and zero `certif|compliant` hits (ADR-0080 gate).
- **Better Stack public status page LIVE**: `https://caisson.betteruptime.com` (id 255425),
  monitors site 4656433 · license 4656434 · docs-RAG 4676344. Created WITHOUT the custom domain
  (the SPEC's own fallback) — `status.caisson.sh` attach + terraform CNAME stays operator-gated.
- **intel container** rebuilt from PR #243 (`docker compose up -d --build`, healthy) — hash-mode
  watchers now persist snapshots, so the CAISSON-101 eval lane arms at the next genuine
  EUR-Lex/AICPA page change.
- **registry Worker DEPLOYED (operator-directed follow-up, same sitting):** version
  `71bff3c8` via `registry/worker/deploy.sh` — `registry.caisson.sh/health` 200
  `{"status":"ok","version":1}` (3× consistent). 4th Better Stack monitor created
  (id 4677314, "Module registry") and attached to page 255425 (resource 8964977).
- **`status.caisson.sh` CUSTOM DOMAIN LIVE (operator-directed):** free-tier support
  re-verified, `custom_domain` set on page 255425, `infra/terraform/status-page.tf` CNAME →
  `statuspage.betteruptime.com` applied **targeted only** (`-target=cloudflare_dns_record.status_page`;
  the email.tf records exist in Cloudflare but NOT in this tfstate — a blanket apply would
  create duplicates; their import runbook remains an open operator act). Probe:
  https://status.caisson.sh 200, all 4 monitors rendered.

## 2026-07-15 — reconcile-wave fleet redeploy: site · admin · license · docs on clean main (`ca44db58`)

Operator-approved at the 07-15 reconcile picker. WHY: put the merged six-PR wave (#235–#240,
kickoffs S+T + the four SPEC exec lanes) plus the #241 close-out (anchoring-scheduler wiring,
release-age fix, state sweep) onto the fleet. Pre-launch gate stays ON (Paddle sandbox).
Scope by diff vs pre-wave main: site (49 files, motion v2), admin (6), license (6, scheduler
wired INERT), docs (kernel dep changed). Skipped: registry Worker (test-only change),
support-bot + intel (zero changes).

Evidence (`railway up -s <svc> --ci` from the main checkout, sequential):

- `caisson-site` → SUCCESS 12:09Z · probe `https://caisson.sh` 200
- `caisson-admin` → SUCCESS 12:11Z · probe `https://admin.caisson.sh` 307 (OAuth gate, expected)
- `caisson-docs` → SUCCESS 12:14Z · probe `https://docs-api.caisson.sh/health` 200
- `caisson-license` → first attempt FAILED at boot (`EACCES reading /app/packages/auth/src/jwt.ts`):
  the file was mode 600 locally (git tracks only the executable bit, so invisible to status) and
  `railway up` ships local perms; license runs from source so the runtime user hit it — site/admin
  build as root at build time and survived. Fixed by chmod'ing 73 non-world-readable local files
  (git status unchanged), redeploy `a3c19b45` → SUCCESS 12:18Z · probe
  `https://license.caisson.sh/health` 200 · boot log clean, issuer serving, no scheduler line
  (`ANCHOR_CHECKPOINT_SCHEDULE` unset → inert by design, arming is a separate operator act).

## 2026-07-12 — FIRST RELEASE-TRAIN RIDE: v2026.07.12 (ADR-0325/0328 D2) — R2 catalog upload + mirror sync

Operator-approved (session 4 kickoff step 4b). WHY: the version PR (#222, 153 changesets →
`d4a32ecc`) put the whole catalog's new versions in ledger/index/tarballs.json, but the R2
objects only arrive via the train's leg 1 — the CAISSON-85/86 gap (rows exist, bytes 404).
Tag `v2026.07.12` targets `3a03390c` (the version-PR merge's attestation/train-fix successor
per the operator tag-anchoring lock — see `docs/releases/v2026.07.12-checklist.md`).

Three tag attempts; the train's gates stopped each defective ride BEFORE any external write:

1. `efe43438` — readiness NOT READY 6/8: job token lacked `checks: read`/`pull-requests: read`,
   and sot's branch-hygiene counted the detached-HEAD pseudo-entry as drift. Fixed in `39d19bad`.
2. `39d19bad` — readiness 8/8, but leg 1's byte gate killed publish: 5 tarballs.json rows stale
   (PR #222's in-branch fixes edited packed files AFTER version-pr.yml recorded the rows;
   append-only rows are never re-packed). Repaired in `3a03390c` — rows re-recorded from a
   pristine checkout, 46/46 re-verified byte-identical locally. Follow-up: CAISSON-103.
3. `3a03390c` — **train green end-to-end** (run 29213161110): readiness 8/8 → propagate.

Pasted live-verify evidence:

- **leg 1 — registry publish (run 29213178982):** verified 46/46 tarballs byte-identical at the
  tag, then `[publish-and-index] R2 upload complete: 46 uploaded, 0 already present (tag
v2026.07.12)` — **CAISSON-85/86 closed.**
- **leg 2 — mirror sync (run 29213249786):** caisson-sh/caisson-oss HEAD → `d5a37a51 chore:
mirror sync from 3a03390` (history appended, never rewritten).
- **leg 3 — npm mirror publish: SKIPPED** (`RELEASE_NPM_MIRROR_ARMED` unset pre-launch,
  ADR-0329). **leg 4 — site redeploy (run 29213272549):** green inert no-op (Railway leg unarmed).
- **Live probe through the Worker (pre-redeploy):** `kernel-0.4.3.tgz -> 200` (R2 bytes live);
  packument `@caisson/kernel` still advertises `latest: 0.4.2` from the old inlined sidecar —
  by design (advertise-follows-upload).

**Deploy act (b) EXECUTED (operator-approved, same day): registry Worker redeploy** —
`registry/worker/deploy.sh` from post-train `main`, version `c941f5d2-d546-4c68-b680-71c22cd83f4b`,
live at registry.caisson.sh. Pasted verify: packument `@caisson/kernel` → `latest: 0.4.3 |
versions: 0.4.0, 0.4.1, 0.4.2, 0.4.3` · `kernel-0.4.3.tgz -> 200` · clean-env
`bun add @caisson/kernel@latest` → `installed @caisson/kernel@0.4.3 with binaries: caisson-gate`
· two REPAIRED-row packages install integrity-verified: `bun add @caisson/ui@latest
@caisson/cli@latest` → `ui: 0.6.0 cli: 0.5.0` (102 packages, bun verifies packument integrity
against served bytes — the 3a03390c row repair proven at the buyer seam).

## 2026-07-12 — wave-1 reconcile deploy act (a): registry Worker + site + docs from merged main

Operator-approved (session 4, ADR-0328). WHY: the P/Q/R wave merges — the Worker had never
deployed PR 213's `Retry-After` emitters (CAISSON-87) and gained P's tarball-backed
`dist-tags.latest` recompute + the 3 reconciled sidecar rows; caisson-site gained the
CAISSON-84 docs content (licensing.mdx + six per-bundle Install sections); caisson-docs gained
the CAISSON-83 retrieval levers (`ftsWeight`, per-source cap 2) + the new corpus.

- **registry Worker** — `registry/worker/deploy.sh`, version `0d85f715-42bc-4864-a324-71c401112d51`,
  live at registry.caisson.sh. Verify pasted: sustained 8-way load tripped the tarball limiter —
  `429 after ~160 requests` / `HTTP/2 429` / `retry-after: 10` (**CAISSON-87 Retry-After PROVEN
  live**); `kernel-0.4.1.tgz` range-GET `200`; packument `@caisson/kernel` latest `0.4.2` per the
  sidecar. Known pre-train state: grandfathered advertised versions (e.g. `kernel-0.4.2.tgz`,
  `analytics-0.1.0.tgz`) still 404 at the bytes — R2 objects arrive with the first train ride
  (rows exist, objects don't; the recompute guards NEW advertisements).
- **caisson-site** — `railway up -s caisson-site` from main@`d4c8a287`, "Deploy complete". Verify
  pasted: `site /docs/licensing -> 200` · `site /docs/compliance -> 200` · `site / -> 200`.
- **caisson-docs** — `railway up -s caisson-docs` from main@`d4c8a287`, "Deploy complete";
  re-embed on boot. Verify pasted: `{"ok":true,"chunks":506}` (489 → 506 with the new
  licensing/install corpus).

Reverse-chronological. One entry per operator-executed DEPLOY act (never autonomous —
`identity/doctrine.md` DEPLOY line). Each entry: date · services/SHAs · WHY (the consumed-package
diff that forced the redeploy) · live-verify evidence.

**Going-forward convention:** every future DEPLOY act appends a NEW entry at the top of this file
with **pasted** live-verify output (curl/health-check stdout), not a paraphrase. Do not edit a past
entry except to fix a factual error — new truth is a new entry, per the frontmatter-freshness
convention (`outputs/archive/specs/sot-expansion/SPEC.md` §1.4).

**Seed note:** the entries below (2026-07-01 through 2026-07-05) are seeded RETROACTIVELY from
`docs/build-state.md` banners, `docs/state/decisions-and-forks.md`, `docs/ops/launch-runbook.md`,
and `docs/archive/opportunity-backlog.md`. None of the seed entries carry raw pasted terminal output —
none survived in the source docs verbatim. Where a source recorded a concrete result (an HTTP status,
a fingerprint, a row count) that value is quoted; where it only recorded a verification claim in
prose, this entry cites the doc/section that made the claim instead of fabricating a transcript.

**Standing sequence constraint (catalog-program, SHIP-audit F5):** the license claims schema is
`.strict()`, and the catalog-program wave adds `updatesWindows`/`entitledSince` to signed tokens —
an old verifier build REJECTS a new token (fail-safe to community/base, but a paying buyer degrades).
Deploy order for any wave that widens the claims schema: **registry Worker (and any other verifier
consumer) FIRST, license service re-mints AFTER.** Buyer-side tooling needs the bumped
`@caisson/license-verify` before it can read new-shape tokens.

---

## 2026-07-11 — EXECUTED: Kickoff-O email wave (ADR-0324) — site + license + admin redeploy from post-#209 `main`

**What deployed:** `caisson-site`, `caisson-license`, `caisson-admin` from `main`@`4036574e`
(`railway up --service <name> --detach` per service from repo root; all three deployments
reached SUCCESS). Operator approval: the Kickoff-O deploy gate — "full redeploy approved"
(one ask, per the kickoff's binding rule).

**WHY:** PR #209 (email wave, CAISSON-92 / ADR-0324) — `reply_to: support@caisson.sh` on all
three Resend call-sites via the new `@caisson/email` `ResendConfig.replyTo` field, plus the
support@ copy pass (refunds/procurement/partners/affiliates/ask-AI; legal pages keep admin@) —
AND the staged `RESEND_FROM="Caisson <no-reply@caisson.sh>"` env flip set `--skip-deploys` on
the same three services (this redeploy is what carried it live; hello@ sender retired). PR #208
(the Playwright-graduation e2e suite, CAISSON-93) rode the same `main` but is test-only — no
runtime diff. Pre-merge operator acts in the same wave: CF Email Routing catch-all on caisson.sh
NEUTRALIZED via API (undeletable singleton → `enabled: false` + action `drop`); the
`admin@gridwork.dev` destination address KEPT (ADR-0324 D3 deviation — shared plumbing for 4
other live zones); `~/.gridwork/caisson.env` flipped (backup `caisson.env.bak-adr0324`). No
Worker republish, no schema widening, no migrations in the diff.

**Live verify (pasted):**

```
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-site)
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-license)
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-admin)
{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}
site:200 docs:200 marketplace:200 login:200

bun test apps/site/live/prod-routes.live.test.ts
 13 pass
 0 fail
 52 expect() calls
```

**Residuals:** 1Password vault `RESEND_FROM` item value update (op session stale at close —
next authed pass) · Proton send-as alias for support@ (operator act, tracker §1).

## 2026-07-11 — EXECUTED: browser-audit remediation wave — caisson-site redeploy from post-#207 `main`

**What deployed:** `caisson-site` only, from `main`@`bae8ae7b` (`railway up -y --service
caisson-site --ci` from repo root; build + image push + "Deploy complete"). Operator approval:
the ADR-0323 picker pre-approved the redeploy riding this session; re-confirmed in the split-flow
picker ("This session").

**WHY:** PRs #205–#207 merged serially — #205 the full 7-finding browser-audit remediation
(homepage codecard `:global()` id-scope fix, docs `<main id="main-content">` landmark, marketplace
compare 44px target, docs-search focus return, systemic 44px hit areas, GitHub icon aria-label,
WebGL probe-first poster fallback + the review-P2 probe-attrs low-power fix) · #206 the Cookiy
trust/copy wave + architecture-fit diagram · #207 docs-only spec draft (no runtime change). Only
the site app consumed the diff — no other service, no Worker, no schema widening.

**Live verify (pasted):**

```
/ 200 /docs 200 /marketplace 200
```

(`curl -s -o /dev/null -w "/$p %{http_code}" -L https://caisson.sh/...` right after "Deploy
complete"; `/plans` 404 in the same probe was a wrong probe path — the route is
`/marketplace/plans`.) Deterministic replay of the four P1 fixes graduates to Playwright in
Kickoff O (ADR-0323 D2) rather than ad-hoc re-probing here.

## 2026-07-11 — EXECUTED: Kickoff-N cockpit + affiliate + Kickoff-M OSS-launch — full fleet redeploy from post-M `main`

**What deployed:** the 4 Railway app/service deploys from `main`@`cbffbadc` (every deploy SUCCESS) —
`caisson-license`, `caisson-site`, `caisson-admin`, `caisson-support-bot` (`railway up -y --service
<name> --ci` per service from repo root). The registry Worker was **not** redeployed — the index/
ledger republish rides the ADR-0318 W4 gated release train (ADR-0321), and an index-only republish
now widens the CAISSON-85/86 drift. Consumed diff: Kickoff-N (PR #202) admin cockpit six waves +
PostHog federation + affiliate `discount_id` capture (ADR-0316/0320); Kickoff-M (PR #204) OSS-launch
program — append-only mirror history, W4 dormant release train, entity restamp to Caisson Software
LLC (ADR-0321). **No in-branch version cut** — the ~132 changesets stay UNCONSUMED for the
operator-gated CI publish run (ADR-0069/0223/0321).

**Order (locked):** license (its `preDeployCommand` migrates the platform DB) → site + admin +
support-bot in parallel → verify.

**Database (platform Postgres):** `caisson-license` `preDeployCommand`
(`bun apps/site/lib/deploy-migrate.ts`) applied the shared `@caisson/platform-migrations` chain incl.
`0025_order_record_discount` + `0026_affiliate_code`. Verified live: `order_record.discount_id`
PRESENT, `affiliate_code` table PRESENT. Admin mutation surface re-provisioned idempotently
(`provision-admin-mutation-surface.ts admin_app` — new read policies + grants + widened action CHECK).

**Live-verify (pasted `curl -w "%{http_code}"` from the repo box, 2026-07-11):**

```
https://caisson.sh/                          200
https://caisson.sh/docs                       200
https://caisson.sh/llms.txt                   200   # public for AI-indexing (ADR-0303)
https://caisson.sh/dashboard                  302 -> gridworkdev.cloudflareaccess.com/.../login/caisson.sh   # commerce CF-Access gated
https://admin.caisson.sh/ops                  307 -> admin.caisson.sh/login?next=%2Fops   # in-app GitHub OAuth (ADR-0283)
https://admin.caisson.sh/product              307
https://admin.caisson.sh/support              307
https://admin.caisson.sh/architecture         307
https://admin.caisson.sh/intel                307
https://license.caisson.sh/health             200
https://registry.caisson.sh/                  200   # Worker untouched, still live
https://registry.caisson.sh/index.json        200
https://registry.caisson.sh/@caisson/kernel   200
POST https://license.caisson.sh/webhook  (unsigned)       -> 401   # affiliate webhook handler live + fail-closed
POST https://license.caisson.sh/webhook  (bad Paddle-Sig) -> 401
```

**Deferred to Gate 2 (commerce readiness — pre-flip sequence item 8):** the full end-to-end
affiliate sandbox sim (fire a Paddle sandbox `transaction.completed` with `discount_id` + a real
`account_id` → assert `order_record.discount_id` stamped) and minting the REAL affiliate codes both
write production rows and are operator-gated commerce acts — NOT deploy-time smoke. Proven at deploy
time instead: the mint leg is live (prior session, `dsc_01kx6z3yd4bqdhdbbmv5btkf0c`), the webhook
handler is live + signature-gated (401 above), the stamping code is deployed + unit-tested, the DB
column exists.

**Follow-up (not the Railway fleet):** `services/intel/migrations/0002_findings_triage.sql` applies
on the LOCAL intel daemon's next boot (`INTEL_MIGRATE_ON_BOOT`), separate from this redeploy.

---

## 2026-07-10 — EXECUTED: Kickoff-J verification fleet redeploy — OTLP logs live fleet-wide, docs retrieval stack armed + warm

**What deployed:** all 5 Railway services redeployed from `main`@`50910bbb` via `railway up`
(every deploy SUCCESS). The consumed diff: `@caisson/observability` OTLP logs pipeline +
stdout/stderr bridge (minor), the `@caisson/local-store` FTS5 per-token sanitization fix
(`329150a8` — multi-word queries matched zero rows before this), the docs-service embed knobs
(`DOCS_EMBED_PHASE_DEADLINE_MS=1200000`, `healthcheckTimeout` 300→1500), support-bot per-answer
confidence telemetry (`546d5b9f`), and the two main-red fixes that rode along (`4930368d`
support-bot ruff format, `50910bbb` nav-account import cycle).

**Live-verify evidence (session-captured):** site 200 · license 200 · docs health
`{"ok":true,"chunks":489}`. Docs boot log: all 489 chunks embedded, semantic index built
(1024-dim) — the first full-corpus embed (previously ~77/489 under the 3-min deadline). The
embed-cache persistence question RESOLVED: this boot reported **244 hits / 245 misses**
(previously `1 hits/84 misses` every boot) — the `/data` volume cache persists and the next boot
warms near-instantly. Loki now carries per-service streams for `admin`, `service-docs`,
`service-license`, `site` (the `caisson-log-error-burst` rule armed itself, NoData=OK).
Support-bot booted clean with `[telemetry] OTLP export enabled` and the `#ask-ai` listener active.

**Residual (spec-parked):** live hybrid ranking quality is UNVERIFIED — the golden suite runs on
the FTS floor only, and the first live probe ("how do I install a bundle", k=3) ranked
bundle pages above `getting-started.mdx`. The battery-v2 re-run owns the verdict:
`outputs/archive/specs/close-out-triage/SPEC-retrieval-quality-battery-v2.md`.

---

## 2026-07-10 — EXECUTED: Kickoff-I perf/mobile wave deployed — `/` perf 0.57→0.95, all lighthouse floors green

**What deployed:** `caisson-site` redeployed from `main`@`418b26f7` (`railway up -y --service
caisson-site --ci` → `Deploy complete`, image `sha256:635fa583dca8…`). The three merged waves:
ADR-0310 hydration diet (RepoArtifact→CSS, StackBuilder/waitlist defer, shared Reveal observer,
NavAccount idle-mount) · ADR-0311 config (compress:false for CF brotli, theme-init inlined,
header cleanup, NFT excludes) · ADR-0312 mobile-nav accordion (pinned account/cart/CTA block,
three `<details>` sections derived from the desktop panel spec, authored slide-down, the
dead-mobile-search P0 fixed). SHIP-audit fixes rode in `11396d6b` (owned-items fetch restored —
the HttpOnly gate was a double-pay vector; the invalid `::details-content > *` selector that
500'd dev and killed the prod section-slide).

**Live-verify (pasted):** homepage HTML after deploy —

```
$ curl -s https://caisson.sh/ -w "%{http_code}"   → 200
grep -c "theme-init.js"        → 0   (inlined, blocking request gone)
grep -c "challenge-platform"   → 0   (ADR-0313 jsd kill holding)
grep -c "cs-nav-toggle"        → 1   (drawer shell present)
$ curl -sI -H "Accept-Encoding: br" https://caisson.sh/_next/static/chunks/0ghtei8evo-qs.js
content-encoding: br            (CF brotli live — origin no longer pre-gzips)
cache-control: public, max-age=31536000, immutable
```

**Lighthouse evidence (run `29106799203`, dispatch vs the live origin, error-level assertions):
conclusion SUCCESS.** Median desktop scores:

```
https://caisson.sh/            performance=0.95 accessibility=1.00 best-practices=0.96 seo=1.00  TBT 70ms  LCP 1.4s
https://caisson.sh/marketplace performance=0.90 accessibility=0.96 best-practices=0.96 seo=1.00  TBT 30ms  LCP 2.0s
```

The homepage residual red is CLOSED: `/` perf 0.57 → 0.95 (TBT ~1.36s → 70ms; the ADR-0313 jsd
kill + the ADR-0310 diet in combination), best-practices 0.78 → 0.96 with the floor restored to
0.9 and passing. Follow-ups filed: CAISSON-81 (session-hint cookie to land the slice-b signed-out
skip), CAISSON-82 (NFT trace diagnostic in services/license).

## 2026-07-10 — EXECUTED: support-bot listener armed + affiliate delivery proof + Loki rule (Kickoff-J later sitting)

**Support-bot `#ask-ai` listener armed.** The operator toggled the privileged intents in the
Developer Portal (verified over the Discord API: app flags carry MESSAGE_CONTENT-limited +
GUILD_MEMBERS-limited — the enabled form for an unverified bot) and the token was confirmed
rotated-and-consistent (railway `DISCORD_TOKEN` sha12 `ef2344d8e9c3` == local env; `users/@me`
→ HTTP 200). The missing wiring was env: `SUPPORT_CHANNEL_ID` was UNSET, so the channel
listener + the reply-`escalate` handler were dormant (code only requests message_content when
the channel is configured). Set `SUPPORT_CHANNEL_ID=1521528418930524270` (`#ask-ai`) +
`railway redeploy` — fresh container up clean:

```
SUPPORT_CHANNEL_ID=1521528418930524270
Starting Container
[telemetry] OTLP export enabled (service=service-support-bot)
```

Global slash commands verified over the API: `['ask', 'kick', 'ban', 'timeout', 'role-add',
'role-remove', 'grant-role', 'post-roles']`.

**Affiliate attribution delivery proof (sandbox):** pricing-preview with `CAISSONAFF1` on
`pri_01kwwqa266p6smw4yaanxg1n5j` → `subtotal=9900 discount=990 total=8910` (exactly 10%);
`transaction.completed` sim `ntfsim_01kx6822kdnaxzzxma3m8mf1q2` with `discount_id` delivered
to `https://license.caisson.sh/webhook`:

```
event: transaction.completed | status: success
  delivered discount_id: dsc_01kx5b0f9majy4wbgq5cjgdm7y
  delivered subscription_id: None
  delivered txn id: txn_01simaffproof0710aaaaaaaaa
  endpoint response code: 200
  endpoint response body: {"ok":true}
```

**OTLP logs fix landed on main (`0dd715ae`), fleet redeploy PENDING (operator-gated):**
`@caisson/observability` now ships the logs pipeline + stdout/stderr bridge; the
`caisson-log-error-burst` Loki rule is provisioned via the API (201, NoData=OK) and arms
itself when site/admin/license/docs redeploy. The pipeline itself is LIVE-PROVEN against the
real Grafana Cloud gateway — a local probe process booted the new package with the fleet's
OTLP endpoint/headers and its lines landed in Loki:

```
streams: 2
labels: {'detected_level': 'warn', 'service_name': 'caisson-logs-probe'}
  line: [observability] OTel SDK started (service=caisson-logs-probe)
  line: caisson-logs-probe: OTLP logs pipeline live proof 2026-07-10T14:58:40.719Z
```

Loki is no longer zero-streams; per-service streams appear at the fleet redeploy.

---

## 2026-07-10 — EXECUTED: ADR-0313 zone bot-management kill (terraform apply, operator-run)

**Operator-locked at the perf/mobile picker, applied via `terraform apply bm.plan`.** One
in-place update on `cloudflare_bot_management.caisson` (resource imported first):
`fight_mode true→false` · `enable_js true→false` · `ai_bots_protection block→"disabled"`
(the block value was a FOUND misalignment — the zone was blocking AI crawlers against the
ADR-0303 public-for-AI-indexing posture). Live-verify pasted: API readback
`fight_mode=False enable_js=False ai_bots_protection=disabled`; fresh fetches of `/`,
`/marketplace`, `/compare` each `grep -c challenge-platform` → `0` (first probe seconds after
apply still showed 1 — propagation lag, gone on re-fetch). Lighthouse best-practices floor
returned 0.75→0.9 (`db8a3ba4`). Re-arm trigger: real bot pressure at launch (ADR-0313).

## 2026-07-10 — EXECUTED: Kickoff-J tail wave — migration 0024 + abandoned-checkout arm + EULA clause live + alerting floor

**Operator-ordered ("want you to do the full deploy sequence").** Ships the `5ece1d43` wave
(EULA continuity clause · abandoned-checkout email build · CAISSON-71 harness stub) plus the
same-sitting operational floor.

- **Migration 0024** (`checkout_abandonment` + notice tables, RLS): read-only bless first —
  pasted: `bless: 23 already applied, 1 pending: 0024_checkout_abandonment.sql` → apply
  `[deploy-migrate] platform: applied 1, skipped 23` → re-bless `bless: 24 already applied,
0 pending: (none)`. Zero drift.
- **Admin provision re-run** (`provision-admin-mutation-surface.ts admin_app`) — pasted tail:
  `applied: admin mutation provision · applied: role grants to admin_app · roles: admin,
admin_write, app`. Policy verified live: `checkout_abandonment_admin_select|{admin_write}`
  (the review's P2 deploy gate — provision BEFORE arming — honored in order).
- **Paddle SANDBOX discount** `CAISSONCART10` (10%, `dsc_01kx5aw8mgvmxwmdym80tmzyq4`) created
  over the API; `ABANDONED_CHECKOUT_SCHEDULE=30 6 * * *` + `ABANDONED_CHECKOUT_DISCOUNT_CODE/
_LABEL` set on caisson-license (`--skip-deploys`, then redeploy).
- **Railway ×2** from `main@665e7311`: `caisson-site` (EULA clause serves — pasted:
  `Last updated: 10 July 2026` / `Section 365(n)` / `Vendor continuity and self-maintenance`
  all present on https://caisson.sh/legal/eula, 200) + `caisson-license` (`/health` 200,
  preDeploy `[deploy-migrate] platform: applied 0, skipped 24`, issuer on :8080). Scheduler
  ARMED — pasted: `pgboss.schedule` row `checkout.abandonment_tick|30 6 * * *`.
- **Grafana alerting floor over the provisioning API** (glsa_ token): contact point
  `caisson-ops` → Discord #ops-alerts (delivery proven, webhook 204) + root policy + folder +
  3 rules on metrics that EXIST (`caisson-heartbeat-lost` target_info<2 NoData=Alerting ·
  `caisson-5xx-spike` http_server 5xx rate · `caisson-p95-latency` >2s) — all `inactive`
  (evaluating). Four pre-existing console rules DELETED as provably dead (`up`/spanmetrics
  don't exist in this stack; Loki has ZERO streams — see residual).
- **Support-bot public HTTP leg CLOSED**: public domain already existed
  (`caisson-support-bot-production.up.railway.app`, `/health` 200 `{"ok": true}`); the skipped
  TS live leg run — pasted: `1 pass, 0 fail, 7 expect() calls` — the ADR-0224 all-seams matrix
  is now fully closed.
- **RESIDUAL (new finding):** the OTLP **logs** pipeline is dead — Loki label query over 24h
  returns zero streams for every service, so log-based alerting is impossible until the log
  pipeline is fixed; the dead Loki rules were pruned with the rest — re-add a log-error rule
  once streams actually land.

## 2026-07-10 — EXECUTED: Kickoff-I design wave — caisson-site redeploy (ADR-0306–0309 live)

**Operator-ordered ("push to branch and then also deploy the code").** The Kickoff-I merge
(`f620ab15` + J-copy-wave reconcile `a33eeeb9` + changeset-prose fix `5c710fd0`, all CI-green)
landed the design wave on main; this act shipped it to the one service the wave touches.

- **`caisson-site`**: `railway up -y --service caisson-site --ci` from `main@5c710fd0` →
  clean image build (36/36 turbo tasks, 197 static pages, digest `2d788ee0…`) → `Deploy complete`.
  Live probes: `/` 200 with the `hero-field-module__` poster markup served, `/marketplace` 200.
- **Scope**: apps/site + packages/ui only (ui bundles into the site build). No Worker republish
  (registry/index.json untouched), no license/docs/admin/support-bot changes in the wave.
- **ADR-0309 evidence run**: `lighthouse-ci` dispatched post-deploy against `https://caisson.sh`
  (run 29071930623, GitHub-hosted — the fleet image ships no Chrome) — first error-level run,
  and it correctly ran RED. Triage: page load itself excellent (FCP 0.8s · LCP 1.5s · SI 2.6s);
  the perf/TTI/TBT miss was the field's rAF loop rendering on the runner's SwiftShader software
  GL (43s CPU in one chunk) — fixed with a software-renderer bail to the poster in
  `hero-field-scene.ts`; a11y 0.92 was 12 color-alone footnote links (→ `.cs-link` sweep) + a
  prohibited `aria-label` on the Turnstile mount div (→ dropped); best-practices 0.78 is capped
  by Cloudflare's injected `challenge-platform/jsd` script (third-party deprecations + CSP
  issues) — floor set to 0.75 with the cause documented in `lighthouse.yml`. Fixes merged to
  main; the green evidence run rides the next site redeploy. The prod visual-harness delta
  remains the second evidence leg.
- **Second redeploy + rerun (same day, image `c39dd56a…`, run 29072745113):** the fixes
  verified live — TBT 33s→710ms (`/`) / 90ms (`/marketplace`), `/` a11y 0.92→**1.0**,
  `/marketplace` 0.96, TTI/TBT/best-practices/SEO assertions ALL green. ONE residual red:
  `categories:performance` on `/` = 0.57 desktop (marketplace 0.9 passes). Named causes, both
  out-of-wave: Cloudflare's `challenge-platform/jsd` script (676ms bootup — half the TBT; the
  operator lever is killing zone JS-detections, same terraform class as the CAISSON-50 beacon
  kill, at the cost of the bot-management signal) and homepage hydration (684ms — a
  server-componentization diet, a future design-track item). The gate stays error-level and
  red on purpose (ADR-0309: a red run, not a shrug) until one of those levers is pulled.

## 2026-07-10 — EXECUTED: G+H close-out fleet deploy (PR #198 merge → full DEPLOY sequence)

**Operator-ordered ("once all on clean main full dpeloy sequence").** The Kickoff-H merge
(PR #198 squash `2b65cf3d`, ADRs renumbered 0300–0302) + the close-out sweep (PR #199
`6ebb6b3e`) landed both kickoffs on single-branch main; this act activated H's code live.

- **Migration 0023** (`order_record_subscription_link`, ADR-0302): read-only bless first —
  pasted: `bless: 22 already applied, 1 pending: 0023_order_record_subscription_link.sql` →
  apply `[deploy-migrate] platform: applied 1, skipped 22` → re-bless
  `bless: 23 already applied, 0 pending: (none)`. Zero checksum drift (the runner is
  drift-fail-closed; bless ran the real code path with a no-op applier).
- **Admin provision** (`provision-admin-mutation-surface.ts`, incl. H's action-CHECK widening):
  pasted tail — `applied: admin_action_log action CHECK widening · applied: admin mutation
provision · applied: role grants · roles: admin, admin_write, app`.
- **Railway fleet ×5** redeployed from `main@2b65cf3d` (`railway up -y --service <s> --ci
--detach`): probes — `caisson.sh → 200`, `license.caisson.sh/health → 200`,
  `admin.caisson.sh → 200`, docs service healthy per boot log (`serving 489 chunks on :8080`;
  no public domain by design), support-bot proven by the pytest live legs below.
- **Registry Worker** redeployed (version `aed690f2`) with the CAISSON-55 rate-limit bindings —
  dry-run binding table confirms `RATE_LIMIT_CATALOG (300/60s) · RATE_LIMIT_NPM_PACKUMENT
(120/60s) · RATE_LIMIT_TARBALL (60/60s)` live. **Residual:** a 320-request curl burst did NOT
  reproduce a live 429 (CF's `simple` limiter is per-server approximate; escalating the burst
  was declined as prod load-testing). The limiter is fail-open abuse-throttling by design
  (ADR-0112 posture), unit-tested; the live 429 repro stays an open verification item.
- **Ops-alert env armed:** `DISCORD_OPS_WEBHOOK_URL` set on `caisson-license` (verified via
  `railway variables`) + appended to `services/intel/.env`, `caisson-intel` container recreated
  — `Up 5 seconds (healthy)`.
- **Post-deploy live proofs (pasted):** license seam-1 webhook→grant-row PASS with the PUBLIC
  DB URL (the env's `DATABASE_URL` is the Railway-internal hostname — ENOTFOUND from the box;
  export `DATABASE_URL=$DATABASE_PUBLIC_URL` for box-side live runs); support-bot
  `uv run pytest -m live` → `2 passed`. **Known-red leg:** license→bot Discord grant-push
  (`discord-grant.live.test.ts`) fails because `SUPPORT_BOT_URL` still points at H's expired
  Tailscale funnel — resolves with the "expose it" fork (public Railway domain), not a deploy
  regression.
- **Docs-service warm-up residual:** first boot after G's docs expansion hit the 180s embed
  deadline (77/489 chunks semantically embedded, rest FTS-only; cache 1 hit / 84 misses) —
  self-heals over subsequent boots as `/data/embed-cache.json` fills.

## 2026-07-09 — EXECUTED: Better Stack → Discord ops-alerting floor live (Kickoff-H W2 activation)

**Operator-approved in-session ("can you create monitor and like configure etc with this?").**
First deploy of the `caisson-betterstack-adapter` Worker + the external-uptime half of the
alerting floor wired end-to-end via the Better Stack API — then the WHOLE chain proven with a
real incident and torn down.

- **Worker:** `caisson-betterstack-adapter` →
  `https://caisson-betterstack-adapter.broken-wood-97a9.workers.dev` (version `09329f10`), both
  secrets set. First live delivery exposed a launch-blocking workerd incompatibility —
  `redirect: "error"` throws under workerd (only follow/manual supported), so every delivery
  502'd; fixed as `redirect: "manual"` (identical fail-closed semantics), commit `eed1949c`,
  redeployed.
- **Live-verify (pasted):** no-secret POST → `401` (fail-closed); with-secret e2e POST →
  `{"ok":true}` / `deployed-e2e: 200`; real-chain probe — temp 404 monitor → Better Stack
  incident `988503686` `"TEMP chain probe - will be deleted" Started` → embed delivered to
  `#ops-alerts` (operator confirmed visually) → `resolve: 200`, `delete temp monitor: 204`.
- **Better Stack objects:** monitors `4656433 https://caisson.sh up` ·
  `4656434 https://license.caisson.sh/health up`; outgoing webhook `84150`
  (`incident_change`, custom `X-Betterstack-Secret` header).
- **Env SOT:** `DISCORD_OPS_WEBHOOK_URL` + `BETTERSTACK_API_TOKEN` + minted
  `BETTERSTACK_WEBHOOK_SECRET` appended to `~/.gridwork/caisson.env`. Residual:
  `DISCORD_OPS_WEBHOOK_URL` still needs setting on the license/intel Railway services at the
  next fleet DEPLOY so the pg-boss/watcher alerts share the channel; Grafana contact point +
  4 rules (the (a) half of the alerting-floor row) still open.

## 2026-07-08 — EXECUTED: credential-sweep propagation — per-service OpenRouter keys + vault + docs embed cache (PR #185)

**Operator-approved same-session ("run the propagation fully and redeploy and resync").** The
runbook Phase 1–2 execution: all OpenRouter keys revoked + re-minted as SIX per-service keys
(gw-box · caisson-docs · caisson-support-bot · caisson-site · caisson-intel · aeo-probe), the
1Password "Caisson Launch" vault created and CLI-filled (one item per env name, per-service
concealed fields, tags = services), values propagated vault→consumers, and PR #185 (docs
content-hash embed cache + vault-parity non-env tag) deployed with a persistent volume.

- **Propagation:** Railway sets ×5 (docs/support-bot/site keys, `DISCORD_TOKEN`,
  `NEXT_PUBLIC_DISCORD_INVITE_URL` — site's key + invite are NEW vars) · box `~/.gridwork/env`
  gw-box key · `services/intel/.env` + container recreate (healthy) · GH secrets ×6
  (`OPENROUTER_API_KEY`, `POSTHOG_CAPTURE_KEY`, `POSTHOG_CAPTURE_HOST`, `DATAFORSEO_LOGIN`,
  `DATAFORSEO_PASSWORD`; `MIRROR_PUSH_TOKEN` still pending the operator's PAT mint).
- **Key verification (pasted):** all six keys probed against `GET /api/v1/key` → `HTTP 200`;
  every key reports `limit=null` — per-key credit limits **waived by the operator 2026-07-08**
  (uncapped keys accepted; attribution, not caps, was the goal of the split).
- **Redeploys:** `caisson-docs` deployed from `main@be359eeb` (embed-cache code) — SUCCESS;
  `caisson-support-bot` + `caisson-site` redeployed — SUCCESS.
- **Volume:** dashboard-created volume landed on support-bot by mistake; moved via
  `railway volume detach/attach` (the `add` subcommand panics — CLI bug) and renamed
  `caisson-docs-volume`, mount `/data`.
- **Embed cache PERSISTING (pasted, PR #186 `main@7bc8e713`):** the first deploys wrote
  nothing — Railway mounts the volume ROOT-owned while the container ran `USER bun` (uid
  1000), and the cache write is fail-soft by design (`0 hits / 75 misses` then `0 hits / 87
misses`). PR #186 fixed it: entrypoint chowns the mount then drops privileges via
  `setpriv --reuid=bun` (healthcheck dropped the same way — review finding), plus visible
  errno logging on cache read/save failures. Proof after redeploying from #186: cold boot
  `[service-docs] embed cache: 0 hits / 68 misses (/data/embed-cache.json)` with no
  save-failure line, warm boot `60 hits / 81 misses` — the cache survived the redeploy, and
  because hits are network-free the same 3-minute embed deadline covered 141 chunks instead
  of 68. Coverage converges to the full corpus across the next boot or two, then
  unchanged-corpus redeploys make zero embedding calls.
- **Vault parity (pasted):** `vault-parity-check: clean — vault and caisson.env agree on names.`
  with `--rotated-after 2026-07-08` — 126 names, 7 non-env exclusions printed by title, exit 0.
- **Cost verdict recorded (runbook 1.1):** the credit exhaustion was about 92 tracked
  frontier-model calls (about $0.81 avg) on the PAL lanes, not embeddings; per-service keys
  make future burn attributable per consumer.

---

## 2026-07-08 — EXECUTED: CF beacon auto-injection OFF + full-fleet redeploy (twelfth-sitting fix wave)

**Operator-approved same-session ("do the terrafom apply and fleet redeploy").** Two acts:

**Act 1 — terraform apply, `cloudflare_web_analytics_site.caisson` (CAISSON-50/51 root fix).**
The dashboard-created Web Analytics site (site_tag `d2a2578432d94e78a5ab08392d9f63c4`) was
imported into state first (the file's documented adoption step), then plan showed exactly
`0 to add, 1 to change, 0 to destroy` — only `auto_install = true -> false`. Applied; post-apply
API read-back:

```
caisson.sh auto_install=false
```

The edge no longer injects the beacon `<script>` into `<body>` — the `/login` React #418
hydration mismatch and the CSP-blocked cloudflareinsights load die at the root. Remaining
close-out: rerun the prod-routes live harness and remove the `KNOWN_NOISE` beacon filter
(the tf comment documents this).

**Act 2 — 5-service Railway redeploy from `main`@`72e5cb7a` (the fix wave, PRs #178–#184).**
Why: license mint-deadline + claw-lock (#182), docs boot hardening (#181), admin resend
throttle (#178), site hydration/content/gallery wave (#184), shared migration chain (#180).
All five `railway up --detach` → SUCCESS. No Worker republish (registry/index.json untouched
by the wave — license health confirms the same 46-entry digest). Live probes (pasted):

```
license: {"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}
site: 302        (CF-Access pre-launch gate ON — correct)
www: 302
admin: 200
docs: {"ok":false,"warming":true}    <- the NEW #181 warmup response, live during boot
docs (~90s later): {"ok":true,"chunks":255}
```

The docs warmup evidence is the #181 fix working in production: the service now binds
immediately and serves a warming 503 while embedding (previously: connection-refused 502s for
up to ~10 minutes). Pre-launch gates stay ON (CF-Access site_gate, PADDLE_ENV=sandbox).

---

## 2026-07-08 — EXECUTED: full-fleet redeploy — the eleventh-sitting wave (26 commits, PRs #161–#177)

**Operator authorization:** "want you to do full deploy sequence with the new code", 2026-07-08
session (the whole merged buyer-lifecycle wave plus #161–#164 was undeployed).

**Services/SHAs:** `main@2ff49b04`. Five Railway services redeployed via `railway up` (all
deployments SUCCESS): `caisson-license`, `caisson-site`, `caisson-admin`, `caisson-docs`,
`caisson-support-bot`. `caisson-intel` NOT redeployed (its only delta since `55b3d486` is a
test file). Registry Worker republished (version `1a9cb273-b7d9-41ef-8861-a3b11add0341`) — the
repo index had gained `@caisson/analytics` (PR #159 driver batch) since the Worker's last
publish; add-only, so no same-act admin rebuild required (and admin already baked the 46-entry
index). Anon floor 15→16 modules (`@caisson/analytics` is Apache-2.0 — verified in its
package.json before accepting the count). Pre-launch posture UNCHANGED: CF-Access `site_gate`
ON, `PADDLE_ENV=sandbox`.

**F5 ordering pre-check:** claims schema unchanged — `packages/license-verify/src/claims.ts`
0-line diff `55b3d486..HEAD`, `license-verify` + `registry/index.json` byte-identical over the
wave — so no verifier-first ordering applied.

**Live-verify evidence (pasted):**

- `caisson-license` `/health` → `{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}`
- `caisson.sh` → `302` to `gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?…`
  (pre-launch gate ON); `www.caisson.sh` → `302`
- `caisson-admin` `/healthz` → `{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46} [200]`
  (fail-closed gate: 200 proves the boot migration ran)
- `caisson-docs` `/health` → `{"ok":true,"chunks":255} [200]` — after a **~10-minute 502
  warmup window** (boot-time corpus embed over OpenRouter; the corpus has grown past the
  railway.toml comment's "60–90s cold boot" expectation). Boot hardening (bounded embedder
  retry so the FTS-degrade path can fire + boot progress logging) queued in the same-day fix
  wave.
- `caisson-support-bot`: Railway healthcheck-gated SUCCESS (`healthcheckPath = "/health"`,
  30s timeout) — the deploy cannot go SUCCESS without the probe passing.
- Worker anon `index.json` → `{"schemaVersion":1,"count":16}` modules.

**Incident (operator action needed):** while listing domains, `railway domain --service
caisson-support-bot` — which CREATES a domain when none exists (the no-subcommand legacy
behavior) — minted `caisson-support-bot-production.up.railway.app`. The deletion
(`railway domain delete …`) was classifier-blocked in auto mode. The domain serves nothing
(the bot's `/health` answers Railway's internal probe; no routes are meant to be public), but
it is an unsanctioned published surface until deleted.

**Local note:** the Worker bundle build required a fresh `bun install` on the main checkout
first (`tooling/testing`'s new jsdom/react-dom deps from the merged wave; the stale
`node_modules` failed `@caisson/registry-schema`'s dependency build).

---

## 2026-07-07 — EXECUTED: bug-fix redeploy — intel (soc2 tight-loop) + admin (migration-in-instrumentation)

**Operator authorization:** picker "Both now (recommended)", 2026-07-07 session (redeploy of the two
services affected by the CAISSON-49/48 fixes merged in PR #160).

**Services/SHAs:** `main@55b3d486` (PR #160). `caisson-intel` rebuilt on gw-ms-a2 (`docker compose
up -d --build` from `services/intel`); `caisson-admin` redeployed on Railway (`railway up --service
caisson-admin`, deployment `f156b4c0`, Online). Pre-launch posture UNCHANGED: CF-Access `site_gate`
ON, `PADDLE_ENV=sandbox`.

**WHY:** two bugs found during the ninth-sitting intel deploy. **CAISSON-49 (Urgent)** — `setInterval`
clamps any delay over the signed-32-bit ms ceiling (~24.8d) to 1ms, so soc2's 30-day cadence
tight-looped (170× in 75s, hammering AICPA). `longInterval` chains ceiling-bounded `setTimeout`s.
**CAISSON-48** — the admin better-auth migration ran via a `preDeployCommand` that is a no-op on the
Next standalone image (strips `src/`); moved into `instrumentation.register()` (ships in standalone,
awaited before serving), with `/healthz` failing closed on a boot-migration failure.

**Live-verify evidence:**

- `caisson-intel`: `Up (healthy)`, `/healthz` → `{"ok":true}`; **soc2 ran 1× on boot (was 170×)**,
  all six watchers fire once. The `INTEL_CADENCE_SOC2_MS<24d` env workaround was removed — the
  30-day default now works with the fix.
- `caisson-admin`: deployment `f156b4c0` **Online**, `/healthz` → `200 {"ok":true}` (with the new
  fail-closed gate a 200 proves the boot migration succeeded via the instrumentation path), `/` →
  `307` (→ `/login`).

---

## 2026-07-07 — EXECUTED: ninth-sitting seven-PR wave deploy + admin OAuth flip (site + license + admin; no Worker republish)

**Services/SHAs:** `main@a0aa9a3c` (PRs #153–159 merged serially, all in-session SHIP-audited).
Redeployed `caisson-site`, `caisson-license`, `caisson-admin` via `railway up --service <s> --ci`.
`caisson-docs`/`caisson-support-bot` unchanged this wave — not redeployed.

**WHY:** site = marketplace one-surface rework + email consolidation (#154/#153); license = E2 eval
scoring + the F-1 `/health` indexDigest parity leg (#156); admin = the ADR-0283 CF-Access→GitHub-OAuth
flip + the unified component catalog (#155/#153).

**Live-verify (pasted):**

- `curl https://license.caisson.sh/health` → `{"ok":true,"indexDigest":"42817dcc9a2e","indexEntries":45}`
- `curl -so/dev/null -w %{http_code} https://caisson.sh/marketplace` → `302` (CF-Access `site_gate`, expected — pre-launch).
- `curl https://admin.caisson.sh` → `307 -> https://admin.caisson.sh/login?next=%2F` (better-auth own login — **CF-Access gone**); `/login` → `200`.

**Admin OAuth flip — completed end to end (operator-gated, sign-in operator-verified):**

1. GitHub OAuth app "Caisson Admin" created (client id `Ov23li2yV6PG6Ll3oepd`; callback
   `https://admin.caisson.sh/api/auth/callback/github`).
2. **Dedicated `admin_auth` database** created on the Railway Postgres (`CREATE DATABASE admin_auth`) —
   better-auth's own tables (`user`/`session`/`account`/`verification`) live isolated from commerce
   (the config forbids `CAISSON_ADMIN_DB_URL` / the site auth DB to avoid the org-`account` collision).
3. Six `ADMIN_*` vars set on `caisson-admin`: `ADMIN_AUTH_DATABASE_URL` (internal host, `admin_auth`
   db, postgres role — better-auth needs table-DDL rights to migrate), `ADMIN_GITHUB_CLIENT_ID/SECRET`,
   `ADMIN_GITHUB_ALLOWED_USER_IDS=265439716` (GridWork-dev numeric id), `ADMIN_BETTER_AUTH_SECRET`
   (32-byte), `ADMIN_BETTER_AUTH_URL=https://admin.caisson.sh`.
4. **Migration gotcha (CAISSON-48):** the `preDeployCommand = bun apps/admin/src/lib/admin-deploy-migrate.ts`
   is a **no-op on the Next standalone image** (runtime stage copies `.next/standalone`, not `src/`) —
   first deploy served with no tables (`relation "verification" does not exist`). Mitigated by running
   the migration manually from the box against the `admin_auth` PUBLIC url (`cd apps/admin && bun
src/lib/admin-deploy-migrate.ts`) → `account`/`session`/`user`/`verification` created. Filed
   CAISSON-48 for the proper standalone-compatible fix.
5. Operator verified GitHub sign-in works.
6. **`terraform apply` removed the CF-Access `admin_gate`** — `Plan: 0 to add, 0 to change, 2 to
destroy` (the admin_gate access application + policy); `site_gate` refreshed, **untouched**.
   admin.caisson.sh is now gated solely by the GitHub-numeric-id allowlist.

**No Worker republish:** `registry/index.json` byte-unchanged by the wave; the driver batch's
`@caisson/analytics@0.1.0` ledger/index entry is manifest-only (npm tarball stays behind the manual
`confirm=publish` dispatch).

**Still pending (this session's final act):** the intel container (ADR-0286) box-deploy on gw-ms-a2 +
the gridwork-core `identity/security-surfaces.md` rows.

---

## 2026-07-07 — EXECUTED: triage-window wave deploy (site + license + admin; no Worker republish)

**Why:** PRs #147–#152 merged to `main` (head at deploy time: site from `11cb4c30`, license/admin
from `11cb4c30`/`1bc677a4` — #152 touched packages only). Consumed diffs: caisson-site ← #150
site Tier-1 (incl. the credits-advertised-as-free fix); caisson-license ← #151 comp-grant
allowlist (`assertGrantableEntitlementIds`); caisson-admin ← #151 durable Dockerfile fixes
(`ENV HOSTNAME=0.0.0.0` + `CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json` — the 502
class + the standalone-chdir index-path class both closed at the image layer).
`registry/index.json` byte-unchanged vs the deployed `51be4302` Worker — **no Worker republish**.

**Operator authorization:** deploys of license + admin explicitly approved this sitting ("approved
on the 2 deploys"); site rode the earlier merge-and-clean-state authorization.

**Live-verify (pasted):**

- caisson-site: `railway up` → `Deploy complete`; gate probe →
  `302 https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?kid=a999e511…`
  (pre-launch `site_gate` ON, expected)
- caisson-license: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`
- caisson-admin: `railway up --ci` → `Deploy complete`; boot log →
  `▲ Next.js 16.2.9` · `- Network: http://0.0.0.0:8080` · `[observability] OTel SDK started
(service=admin)`; edge probe → `302` (CF-Access `admin_gate` still ON pending ADR-0283)

**Context:** earlier the same day admin.caisson.sh 502'd — root cause: the `HOSTNAME=0.0.0.0`
Railway variable was lost (suspect: env-sync prune, Linear CAISSON-38), Next standalone bound to
the container hostname and Railway's proxy got refused, masked at the edge by the CF-Access 302.
Fixed live (`railway variables --set` + redeploy) before this wave; the Dockerfile ENV makes the
fix survive future env drift.

## 2026-07-07 — EXECUTED: research-response wave deploy (Worker republish + 4-service fleet redeploy)

**Operator authorization:** "approved on the full deploy sequence of the new code once clean state"
(fifth sitting) — executed after the merge queue drained clean at `main` @ `09ed1c89`.

**Services/SHAs:** registry Worker version `51be4302-9caa-452c-9ae5-ff152e68b2d4` (via
`registry/worker/deploy.sh`) + `caisson-license` · `caisson-site` · `caisson-docs` ·
`caisson-support-bot` redeployed via `railway up -y --service <name> --ci` (launch-runbook §2.6),
all from `main` @ `09ed1c89`. `caisson-admin` intentionally skipped — untouched by this wave.

**WHY (consumed-package diff — the five research-response wave PRs):**

- `4d85f28b` — #142 ui-pro first publish @0.1.0 (index 44 → **45 entries**, RESERVED graduation,
  `everything@0.2.2` repin) → Worker republish required.
- `15c50bd6` — #143 E1 demo mode incl. the dep-confusion fix (tokenless
  `@caisson:registry=https://registry.caisson.sh` scope mapping in the generated `.npmrc`).
- `6d0a5c56` — #144 Track S site wave (`/stack-fit`, MODULE_DB_POSTURE, mobile-nav fix,
  pre-launch wording softened) → `caisson-site`.
- `fb72fdd5` — #145 Track K price-agnostic support-SKU plumbing (structurally unpurchasable;
  `NULL_AMOUNT_IS_INTENTIONAL` docs-corpus filter) → `caisson-license` + `caisson-docs`.
- `09ed1c89` — #146 Track C named-regime crosswalks (ADR-0279 proof-level claim posture; CC7.2
  corrected to maps-to) → docs corpus consumers.

**Live-verify (pasted):**

```
$ curl -s https://registry.caisson.sh/index.json | python3 …
anon modules served: 15
ui-pro present: False
metas present: []
kernel present: True

$ curl -s https://license.caisson.sh/health
{"ok":true}

$ curl -s -o /dev/null -w "site: %{http_code} -> %{redirect_url}\n" https://caisson.sh
site: 302 -> https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?…
```

- `caisson-docs` boot log: `[service-docs] serving 246 chunks on :8080` (semantic index rebuilt on
  boot, OpenRouter qwen3-embedding-8b).
- `caisson-support-bot` boot log: container started, OTLP telemetry up — **no Discord CF-1015
  recurrence** this wave.
- All four `railway up` runs ended `Deploy complete`. Pre-launch gates stay ON (CF-Access
  `site_gate` verified live above; `PADDLE_ENV=sandbox` unchanged).
- Note: the anon index serves no per-entry `license` field; the floor proof is the id set itself
  (exactly the 15 Apache base modules — commercial ui-pro and the three dissolved metas absent).

---

## 2026-07-07 — EXECUTED: registry Worker republish for PR #138 (ADR-0271 bundle-only index)

**Operator authorization:** picker lock "Republish bundle-only now (Recommended)", 2026-07-07 third
sitting. Single service: the registry Worker only (no fleet diff — the change is index data + build
scripts; the license service reads entitlements, not the index shape).

**Service/SHA:** registry Worker version `aa27cb94-8fef-4c78-a35f-d0d7f2e257c0`, deployed via
`registry/worker/deploy.sh` from `main` @ `3d23da70` (PR #138). Index 47 → 44 entries: the three
dissolved edition meta-packages (`@caisson/ai-kit` · `@caisson/local-ai` · `@caisson/agent-dev`)
delisted via append-only ledger `delist` lines per ADR-0271.

**Gate evidence:** CI ALLGREEN on the PR head incl. `registry-index` byte-identity against the
44-entry rebuild; SHIP audits both PASS with zero P0/P1 (code review: under-grant computationally
disproven — every bundle loses exactly its meta id, base floor byte-identical; security: all catch
paths degrade to a FRESH base floor, signed-ids-not-expansion contract intact).

**Live-verify (pasted):**

```
$ curl -s https://registry.caisson.sh/index.json | python3 …
modules: 15
@caisson/ai-kit absent
@caisson/local-ai absent
@caisson/agent-dev absent
kernel present: True
```

Anonymous view = the 15-module free base floor, unchanged. The licensed view is a pure function of
the inlined CI-built index (deploy-entry esbuild-inlines `registry/index.json`) — byte-identity on
the merge commit is the proof the deployed bundle serves the 44-entry index.

---

## 2026-07-07 — EXECUTED: post-merge redeploy for PR #133–#136 + ADR-0270 legacy-grant drain

**Operator authorization:** picker answers "Run it now" (fleet redeploy) + "Run with the redeploy"
(drain), 2026-07-07 session. Pre-launch posture UNCHANGED: CF-Access `site_gate` ON (302 verified
below), `PADDLE_ENV=sandbox` on `caisson-license`.

**Services/SHAs:** registry Worker (version `4c6c61fa-d6ca-45b8-9c63-24ccd85ae2b3`) +
`caisson-license` + `caisson-site` deployed from `main` @ `c27a0a27` (covers PR #133 `70607f6f` ·
#134 `3ae944af` · #135 `b7e58a8d` · #136 `9a81dd7a`). `apps/admin` had no diff across the wave —
no admin redeploy. Order executed (verifier-first per the standing constraint): **Worker → drain →
license → site**.

**WHY (consumed-package diff):** #136 — emptied `LEGACY_ENTITLEMENT_ALIASES` + decoupled
`EDITION_BUNDLE_ID` fold (ADR-0270), entitledSince-filtered `resolveGate`, subscription-cycle
receipt split, renewal-refund un-extend (migration `0017_renewal_extension`); #133/#134 —
dual-door hero, honest-artifact bento, `/affiliates`, 20-page `/compare`, AEO robots/schema,
members-gate purge fix (`apps/site`); #135 ui-pro is in-repo only (publish HELD, ADR-0259 reserved
slug — nothing to serve).

**Drain (ADR-0270 §4):** read-only enumerate returned **zero** legacy edition grant rows (no real
buyers, as gated); the DO block in `services/license/scripts/drain-legacy-edition-grants.sql` then
ran as the superuser deploy role for the formal proof — NOTICE `drain complete: zero legacy
edition grant rows remain` (0 migrated, 0 duplicates across all four legacy→canonical pairs).

**Live-verify evidence (pasted):**

- Worker: `bunx wrangler deploy` → version `4c6c61fa-d6ca-45b8-9c63-24ccd85ae2b3`; `GET
/index.json` → `200`; `GET /modules/@caisson%2Fcompliance` → `404` anon (fail-closed); anon base
  set = 15 oss modules.
- `caisson-license`: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`; preDeployCommand applied `0017_renewal_extension` — `schema_version` row
  `17 | t` (checksum ok); RLS policy `renewal_extension_tenant_isolation | {public}` present.
- `caisson-site`: `railway up --ci` → `Deploy complete` (image
  `sha256:9f77c7e834b543c1512b3e6f08323f67110cc410accf24b6b5d088d89bcc847e`); `https://caisson.sh/`
  → `302 → gridworkdev.cloudflareaccess.com/.../login/caisson.sh` (pre-launch gate ON).

**Not done (by design, this act):** R2 tarball publish stays behind `confirm=publish` dispatch;
ui-pro first-publish HELD for the hardening + gallery wave (operator picker); CF-Access flip and
Paddle production remain launch-gate acts per `docs/ops/launch-runbook.md`.

## 2026-07-07 — staged #131+#132 redeploy EXECUTED: Worker + license + site + admin, expiry scheduler armed, admin re-provision

**Operator authorization:** "full deploy sequence approved run all" (2026-07-07 session resume).
Pre-launch posture UNCHANGED: CF-Access `site_gate` ON (302 verified below), `PADDLE_ENV=sandbox`
on `caisson-license` (checked via `railway variables` pre-deploy).

**Services/SHAs:** registry Worker (version `55475850-b76e-4b5a-b566-bd062109a57e`) + `caisson-license`

- `caisson-site` + `caisson-admin` redeployed from `main` @ `e2966348` (covers PR #131 `15ff1f32` +
  PR #132 `b8fe8731`). Deploy order honored the standing constraint: **Worker first** (the #131
  ADR-0269 claims widening), license re-mint after; site/admin unordered.

**WHY (consumed-package diff):** #131 — registry index 29-entry version-cut ledger incl.
`@caisson/compliance@0.5.0` `kind:"bundle"` at 104900 + ADR-0269 Developer-plan coverage in
`services/license`; #132 — commerce lifecycle emails + alias-folded renewal read-back
(`services/license`), six-bundle homepage/nav/modal + `/updates` + dashboard renewal display
(`apps/site`), pg-pool idle-error 502 guard (`apps/admin`).

**Also in this act (the "Next DEPLOY" tracker row):** migrations `0014`–`0016` were found ALREADY
applied (the 07-06/07 triple-merge preDeploy ran them) — a read-only CAISSON-16 drift audit
pre-deploy showed **v1–v16 all checksum-ok, zero drift, nothing pending**. The two real gaps were
closed: `CREDIT_EXPIRY_SCHEDULE="0 6 * * *"` set on `caisson-license` (pre-`railway up`, so one
deploy armed it) and the admin mutation surface re-provisioned with the explicit `admin_app`
grantee (the CAISSON-17 footgun avoided).

**Live-verify evidence (pasted):**

- Worker: `GET /modules/@caisson%2Fcompliance` → `404` anon (fail-closed) · `GET /index.json` →
  `200` · anon base set serves the #131 bumped versions (`@caisson/auth 0.3.1`, `@caisson/billing
0.5.0`, `@caisson/kernel 0.4.2`, …).
- `caisson-license`: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`.
- `caisson-site`: `Deploy complete`; `https://caisson.sh` → `302 →
gridworkdev.cloudflareaccess.com/.../login/caisson.sh` (pre-launch gate ON).
- `caisson-admin`: `Deploy complete`; `302 → .../login/admin.caisson.sh` (permanent operator gate).
- Post-provision DB check: `grant_consumption` policies =
  `[grant_consumption_admin_write {admin_write}, grant_consumption_tenant_isolation {public}]`;
  `pgboss.schedule` = `[{"name":"credits.expiry_tick","cron":"0 6 * * *"}]` — the expiry
  scheduler is live-armed.
- Provision script output: `applied: admin mutation provision` · `applied: role grants to
admin_app` · `roles: admin, admin_write, app`.

**Not done (by design, this act):** R2 tarball upload for the 29 new sidecar rows stays behind its
own gated `confirm=publish` dispatch; CF-Access flip, Paddle production — all remain operator-gated
launch acts per `docs/ops/launch-runbook.md`.

## 2026-07-06/07 — triple-merge deploy: six-bundle catalog live (gated), Worker-first claims rollout

**Operator authorization:** "once like on clean state want to deploy all new code to prod but still
gated not go live sequence" (2026-07-06 session). Pre-launch posture UNCHANGED: CF-Access
`site_gate` stays ON, `PADDLE_ENV=sandbox` stays on `caisson-license` (verified below), no go-live
step executed.

**Services/SHAs:** registry Worker + all 5 Railway services redeployed from `main` @ `08ee90dd`
(= PR #128 Kickoff E + PR #129 Kickoff F + PR #130 Kickoff D catalog program + the post-merge
reconcile). Deploy ORDER honored the standing constraint above: **Worker first** (version
`1630b709-a8af-4126-b3fc-5c57ac489b7c`), license service after — no token re-mint can now meet an
old verifier.

**WHY (consumed-package diff):** the catalog program rewired the whole commerce surface
(six-bundle pricebook + purchased-id token claims + alias-group renewals + the reworked site
display), E added the updates-window edge filter + credit expiry, F added CLI/emitters/WORM
drivers; `services/docs` regenerates its pricing corpus from the new bundle SOT.

**Live-verify evidence (pasted):**

- Registry Worker anon surface (the six-bundle index at the edge):
  `GET https://registry.caisson.sh/` → **15 anon modules** (ai-config, auth, billing, cli, email,
  jobs, kernel, license-verify, mcp-server, migrate, observability, rate-limit, registry-schema,
  tenancy-rls, ui) — **`credits` correctly ABSENT** (commercial per ADR-0258 §2);
  `GET /modules/@caisson%2Fcompliance` → `404` · `GET /modules/@caisson%2Feverything` → `404`
  (fail-closed, invisible) · `GET /index.json` → `200`.
- `caisson-license` → `curl https://license.caisson.sh/health` → `{"ok":true}` HTTP 200;
  deployment `0022d863` SUCCESS; `railway variables` → `PADDLE_ENV=sandbox`.
- `caisson-site` → `https://caisson.sh` → HTTP 302 →
  `https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?...` (pre-launch gate
  ON); deployment `eb173a16` SUCCESS.
- `caisson-admin` → HTTP 302 → `.../access/login/admin.caisson.sh?...` (permanent operator gate);
  deployment `c4893708` SUCCESS.
- `caisson-docs` → `/health` 502 during the ~40s boot-time corpus rebuild, then **HTTP 200**; logs:
  `[service-docs] semantic index built (OpenRouter qwen3-embedding-8b, 1024-dim)` ·
  `[service-docs] serving 227 chunks on :8080` (the regenerated bundle-pricing corpus); deployment
  `453f812c` SUCCESS.
- `caisson-support-bot` → deployment `2e296b8c` SUCCESS, Railway Online (no public hostname).

**Not done (by design, this act):** CF-Access flip, Paddle production credentials/catalog, Worker
npm-delivery R2 activation (`CAISSON_PUBLISH_DRY_RUN` untouched) — all remain operator-gated
launch acts per `docs/ops/launch-runbook.md`.

---

## 2026-07-05 — site-design-2 close-out: issuer-key rotation ×2, edge deny-set live, fleet redeploy

**Services:** `caisson-license`, registry Worker (rotation, both live-verified), `caisson-site`,
`caisson-docs` (redeployed 2026-07-05, current with `main`).

**SHAs (PR merges on `main`):**

- `f178f9a` — #117 `fix(license): rotate the production issuer keypair (ADR-0226 P0)`
- `90b6dc1` — #118 `fix(registry): dev-key worker fixtures and second key rotation`
- `8ab8ccc` — #120 `fix(site): re-audit visual findings — scroll fades, overflow root causes, contrast`
- `9ca1282` — #121 `feat(site): glossary batches 2-3 — all 32 ADR-0235 terms live`
- `a551702` — #122 `chore(tooling): visual-audit ledger reconcile, 82 findings closed`

**WHY (consumed-package diff):** `packages/license-issue` + `packages/license-verify` + the
registry-Worker baked verify key all changed twice in one sitting — PR #117's rotation shipped a
worker fixture that was ITSELF a live prod-signed token (caught in review), forcing a second
rotation (#118) before either could go live. Separately, `apps/site` shipped its glossary batch 2-3
content + visual-audit fixes (#120/#121), requiring a site+docs redeploy to serve them; and
`launch-runbook.md` §8's edge revocation deny-set (R2 bucket + `REVOCATIONS` Worker binding + the
authed PUT shim on `caisson-admin` + the `license_revocation` DDL) went from `edgePublish: "skipped"`
to armed.

**Live-verify evidence (as recorded in source docs — no raw transcript preserved):**

- Active issuer fingerprint **`a170f7a0ab89bab0`** confirmed baked into `caisson-license` +
  the registry Worker post-redeploy; old fingerprints `0ae7d2abb886ca3d` / `c0bfb8277a840d2e` retired
  (`infra/license-issuer/ISSUER_PUBLIC_KEY.md` retired-keys table, cited by
  `docs/ops/launch-runbook.md` §0).
- Edge deny-set: "a revoke now republishes to the edge and `edgePublish` reports `ok`/`failed`, no
  longer `skipped`" (`docs/ops/launch-runbook.md` §7, "Operator-gated DEPLOY — EXECUTED
  2026-07-05" paragraph).
- Visual-audit ledger reconciled against **fresh 48-route × 4-variant captures**: 82 closed · 125
  open · 14 accepted, 221/221 findings re-verified (`docs/state/decisions-and-forks.md`, "State
  addendum — 2026-07-04/05 execution" section, PR #122).
- Glossary: all 32 ADR-0235 terms live, llms.txt parity confirmed (same addendum section, PR #121).

**Not yet done (flagged, not silently dropped):** `OPENROUTER_API_KEY` / `DISCORD_TOKEN` /
`MIRROR_PUSH_TOKEN` rotations remain operator-owed and block the `caisson-oss` public flip
(`docs/ops/launch-runbook.md` §1.1 sequencing gate; `docs/archive/opportunity-backlog.md` residue
item 3).

---

## 2026-07-03/04 — deploy-closeout: fleet redeploy, registry npm install-proof, first live consume

**Services:** `caisson-site`, `caisson-license`, `caisson-docs`, `caisson-support-bot` (4 of the 5
Railway services redeployed), registry Worker (redeployed with new custom domain + R2 bindings).

**SHAs (PR merges on `main`, publish-pipeline fixes en route):**

- `9d02ef5` — #105 `fix(registry): bun pm pack rejects --filename with --destination, pass full path`
- `cea5dca` — #106 `fix(registry): stage all workspace bumps in the publish commit step`

**WHY (consumed-package diff):** the registry Worker gained the `registry.caisson.sh` custom domain
plus new `TARBALLS` + `REVOCATIONS` R2 bindings (self-hosted npm delivery, ADR-0223) — a redeploy
was required to activate them. `apps/site` needed the ask-AI widget + Turnstile env and PostHog
purchase-capture wiring; `services/docs` needed the expanded docs corpus re-embedded; the ADR-0203
Discord role-push path needed its grant token minted and both push sides' env set. The registry's
first live `changeset` publish/consume cycle then surfaced two pipeline bugs (`bun pm pack` rejecting
`--filename` alongside `--destination`, and the publish commit step missing some workspace version
bumps) — fixed in the same window (#105/#106) before the install-proof could go green.

**Live-verify evidence (as recorded in source docs):**

- "4 Railway services redeployed (site/license/docs/support-bot — ask-AI + Turnstile env, PostHog
  purchase capture, expanded docs corpus re-embedded)" (`docs/archive/opportunity-backlog.md`, snapshot
  paragraph, lines 17–19).
- "the registry Worker redeployed with `registry.caisson.sh` custom domain + TARBALLS + REVOCATIONS
  R2 bindings, the Paddle SANDBOX catalog verified reconciled (4 dropped products archived, 19 prices
  match), and the first live changeset consume run" (same doc, lines 20–23).
- Residue item (1) marked **DONE 2026-07-03/04** — "live `bun install` proof + first live consume
  ran (two pipeline bugs fixed en route, PRs #105/#106)" (`docs/archive/opportunity-backlog.md` line
  26).
- Mac-mini CI runner (org-transfer orphan) resolved same window — "scale set re-registered,
  `native-ext (macos)` green" (`docs/archive/opportunity-backlog.md` line 36, residue item 6).

---

## 2026-07-02/03 — launch-runbook §7 DEPLOY block: migrations 0006–0009, admin mutation surface, WORM, CF rate-limit, Paddle SANDBOX reprice

**Services:** `caisson-license`, `caisson-admin` (both redeployed from merged `main`); live Railway
Postgres (migrated); `caisson-worm` S3 bucket (WORM anchors written); Cloudflare edge (Terraform
applied).

**SHAs (the 4 PRs whose merge triggered this DEPLOY block, per `launch-runbook.md` §7):**

- `9485463` — #66 `feat/paddle-partial-refund` (ADR-0218)
- `0fb6398` — #67 `feat/live-seams-kms-onnx` (ADR-0221)
- `3ed9c8d` — #68 `feat/cf-front-rate-limit` (ADR-0219)
- `9011cb8` — #69 `feat/admin-mutation-surface` (ADR-0220)

**WHY (consumed-package diff):** ADR-0218 (Paddle per-line refund) added nullable `line_item_id`
columns to `entitlement_grant` + `credit_event`; ADR-0220 (admin mutation surface v1) added its own
schema — both shipped as new numbered migrations `0008`/`0009` that had to land on the live Postgres
**before** `caisson-license` booted the new code reading them. ADR-0219 (CF front rate-limit) needed
a Terraform apply against the live Cloudflare zone. ADR-0221 (live-seams KMS/ONNX proof) needed the
WORM store pointed at the real `caisson-worm` S3 Object-Lock bucket.

**Live-verify evidence:**

- **CAISSON-16** — "migration checksum drift at v3 (PR #69 edited a pinned `*_SCHEMA_SQL` in place)
  reconciled read-only, blessed as the sole drift, then migrations `0006`–`0009` applied to the live
  Railway PG (the ledger was at v1–v5 — `0006 account_member` had never reached prod)"
  (`docs/ops/launch-runbook.md` §7 executed-banner).
- **CAISSON-17** — admin mutation surface provisioned; "grantee gotcha — the first run granted
  `admin/admin_write/app` to `postgres` (CURRENT_USER default), not `admin_app`; fixed with an
  explicit grant, then a live grant→revoke round-trip PASSED (dual log rows + WORM anchors, typo'd
  account → 404)" (same banner).
- **CAISSON-18** — env-gated S3 store (PR #79) proven: "anchors in `caisson-worm` with Object-Lock
  retention to 2033. Flagged residual: the bucket's default lock mode is GOVERNANCE, this section
  said COMPLIANCE — operator to confirm posture" (same banner; posture later resolved GOVERNANCE
  pre-launch / COMPLIANCE-at-flip by ADR-0230).
- **CAISSON-15** — Terraform imported + applied (rate-limit + WAF rulesets, docs-api proxied);
  **"429s proven on `/query` with cf-ray"**; `license.caisson.sh` confirmed untouched grey-cloud
  (same banner).
- Both `caisson-license` + `caisson-admin` redeployed from merged `main` — "SUCCESS; license
  `/health` 200" (same banner).
- All four Linear issues (CAISSON-15/16/17/18) marked Done.
- Paddle SANDBOX edition prices re-pointed: "the 4 Paddle SANDBOX edition prices re-pointed
  (compliance 79900 per ADR-0227)" (`CLAUDE.md` cadence section, "execution wave + DEPLOY block"
  paragraph).

---

## 2026-07-02 — five-service Railway redeploy, registry Worker → 0.2.0, env activations, SigNoz volume cleanup

**Services:** all 5 Railway services (`caisson-site`, `caisson-license`, `caisson-admin`,
`caisson-docs`, `caisson-support-bot`) — 4/5 verified live at first pass; registry Worker.

**SHAs (the 2 PRs whose merge preceded this wave):**

- `2dc44cc` — #45 `fix/security-billing-hardening` (Strix pentest remediation, ADR-0204)
- `8e5eb4d` — #46 `chore/edition-tails-ops` (ADR-0205–0209)

**WHY (consumed-package diff):** PR #45 shipped the shared SSRF resolve-and-recheck guard, the
`X-Real-IP`-keyed rate-limiter, the fail-closed `apps/admin` CF-Access-JWT middleware (needs
`CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` set to activate), and the `lineItems`-carrying Paddle
fulfillment path. PR #46 shipped the Azure/Bedrock RentedTransport drivers, the `compliance` runtime
composition of `alerting`+`retention-runner`, the support-bot Linear Triage sink (needs
`LINEAR_API_KEY`/`LINEAR_TEAM_ID`/`LINEAR_TRIAGE_STATE_ID`), the `apps/admin` `/ops` Grafana Tempo
rebuild (needs `GRAFANA_URL`/`GRAFANA_QUERY_TOKEN`/`GRAFANA_TEMPO_DATASOURCE_UID`), and the
members-fold republish to registry index **0.2.0** (ledger 64 lines, 32 entries). None of this is
live until the fleet redeploys on the merged code and the new env vars are set.

**Live-verify evidence (as recorded — no raw transcript preserved):**

- "the 5 Railway services redeployed from merged `main` (4/5 verified live; `caisson-support-bot`
  recovering from a transient Discord CF-1015 egress-IP ban at first boot)" — the Discord bot's first
  boot after redeploy hit a transient Cloudflare error 1015 (rate-limited) egress ban from Discord's
  side; recovered on retry (`CLAUDE.md` cadence section, "Go-live tail merge + deploy wave" paragraph).
- "the registry Worker redeployed (0.2.0 index verified, zero drift)" — the public index matched the
  repo's 32-module manifest with zero drift (same paragraph; also `docs/build-state.md`'s
  edition-tails-ops section: "public base view: 15 Apache-2.0 modules @ 0.2.0, zero drift vs the
  repo's 32-module index — verified live").
- "`caisson-admin`'s CF-Access + Grafana env and `caisson-support-bot`'s Linear env set" (same
  paragraph) — admin gate verified live: "the admin gate is live (edge 302s to the Access login,
  verified)" (`docs/build-state.md`, Strix section).
- "the 3 orphaned SigNoz volumes deleted (Railway soft-delete, purge 2026-07-04)" — cleanup of the
  volumes left behind by the earlier ADR-0177 SigNoz→Grafana-Cloud provider switch (same paragraph).

---

## 2026-07-01 — Stage-2 Railway fleet cutover + DNS off Cloudflare Pages

**Services:** `caisson-site` (unified marketing + docs + buyer dashboard), `caisson-license`,
`caisson-admin`, `caisson-docs`, `caisson-support-bot`, 5-service self-hosted SigNoz stack (later
removed same day by the ADR-0177 provider-picker lock — see below). DNS cut over apex/www from
Cloudflare Pages to Railway.

**SHAs:**

- `747ea25..c6dbaa5` — merge range cited in `docs/build-state.md`'s "DEPLOY EXECUTED (2026-07-01)"
  banner (PR #33 `feat/dashboard-unified-and-p6-tail` folding Streams A–D, plus the immediately
  following `admin.caisson.sh` DNS + permanent CF-Access-gate commit).
- `747ea25` — Merge PR #33 `feat/dashboard-unified-and-p6-tail`.
- `c6dbaa5` — `feat(infra): admin.caisson.sh DNS + permanent operator CF-Access gate (ADR-0138/0140)`.

**WHY (consumed-package diff):** the four parallel Stage-2 streams (A obs-admin, B harvest-modules,
C edition-hardening, D base-adapters+org-accounts) all merged into one integration branch and then
`main` — this was the first deploy of `apps/admin`, the 6 new Stage-2 packages, and the dashboard
host/DB switch off Cloudflare Pages (ADR-0114/0115) onto one dynamic Next 16 `standalone` app on
Railway with Railway-managed Postgres. Nothing in this diff could go live without provisioning the
Railway services, the DB, and the DNS cutover in one act — hence a first-of-its-kind fleet-wide
DEPLOY rather than a single-service redeploy.

**Live-verify evidence (as recorded in `docs/build-state.md`'s "DEPLOY EXECUTED (2026-07-01)"
banner — no raw transcript preserved):**

- `caisson-site` → caisson.sh + www: **"200, CF-Access pre-launch gate on"**.
- `caisson-license` → license.caisson.sh: **"service `/health` 200; custom-domain cert
  auto-issuing"**.
- `caisson-admin` → admin.caisson.sh: **"200, PERMANENT operator CF-Access gate"**.
- `caisson-docs`, `caisson-support-bot` deployed; SigNoz 5-service stack provisioned
  (`railway deploy -t signoz`) — this stack was itself removed later the same day when the
  provider-picker locked Grafana Cloud as the sole OTLP sink (ADR-0177) and all 5 SigNoz Railway
  services were deleted.
- DNS cutover applied via Terraform: "apex/www Pages→Railway, license + admin added, Pages
  custom-domains detached."
- "admin PG role provisioned (`admin` NOLOGIN + `admin_app` non-super login)."
- Registry Worker redeployed: "serves rebuilt 27→32 index; anon base-set gated."
- D4 org accounts activated same session.
- Live DB verified: "migrated + verified (app role NOSUPERUSER/NOBYPASSRLS, 5 tenant tables
  FORCE-RLS, 4 better-auth tables, idempotent)" (`docs/build-state.md`, "STAGE-2 INTEGRATION +
  DEPLOY (2026-07-01)" paragraph — two live-fixed bugs on this branch: the Next-standalone
  `HOSTNAME=0.0.0.0` bind fix for a boot 502, and the Paddle-origin CSP fix).
