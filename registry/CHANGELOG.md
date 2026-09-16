# @caisson/registry

## 0.0.26

### Patch Changes

- Updated dependencies [7d39669]
- Updated dependencies [cd694f1]
  - @caisson/license-verify@0.3.10
  - @caisson/registry-schema@0.5.12
  - @caisson/pricebook@0.8.5

## 0.0.25

### Patch Changes

- e190797: Routine non-major dependency refresh. `better-auth` and its Kysely adapter move
  `1.6.25` to `1.6.26` in the site; Storybook `10.5.0` to `10.5.6` and Vite `8.1.4`
  to `8.2.0` in the UI kit; `wrangler` `4.106.0` to `4.119.0` in the registry
  worker. Everything but the better-auth pair is a devDependency. No API or
  behaviour change in any of the three packages.
- c10e3b6: Delist the published-never-sold agent-usage module: an append-only ledger delist row removes it from every index rebuild; publish history and tarball provenance are retained. The worker filter allowlist for unbundled non-sellable modules is now empty.
- c577330: Deployment documentation now matches the deployed reality. The `apps/site` service
  env block is regenerated from the live variable list — names only, verified for exact
  parity in both directions — and the stale scaffold comments that described live
  infrastructure as not-yet-created are removed from the demos service config, the
  registry Worker config, and the Railway deploy workflow. No runtime behaviour changes
  in these packages.
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/pricebook@0.8.4
  - @caisson/registry-schema@0.5.11
  - @caisson/license-verify@0.3.9

## 0.0.24

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10
  - @caisson/pricebook@0.8.3

## 0.0.23

### Patch Changes

- 98bf1f3: Routine non-major dependency refresh: the OpenTelemetry SDK/instrumentation line moves to its
  current minor, Playwright takes a patch, and the Storybook, Vite, wrangler, noble-curves, and
  better-auth pins stay at their prior versions because the newer releases have not yet cleared the
  seven-day release-age floor. No API or behavior changes in any package.
- 0497277: Publishing a release now redeploys the module registry edge as part of the same run and verifies it against the released catalog, so a newly published version is installable the moment the release completes instead of after a separate manual step.
  - @caisson/license-verify@0.3.8
  - @caisson/pricebook@0.8.2
  - @caisson/registry-schema@0.5.9

## 0.0.22

### Patch Changes

- Updated dependencies [e917c52]
  - @caisson/registry-schema@0.5.9
  - @caisson/pricebook@0.8.1
  - @caisson/license-verify@0.3.7

## 0.0.21

### Patch Changes

- e6ee01a: The index parity probe now retries a leg before declaring it unreachable. A single transient fetch failure previously rendered as UNREACHABLE, which is indistinguishable from a real outage in a report that feeds launch acceptance; a leg is only called unmeasured after every attempt fails.
- 108a358: Test coverage refreshed for the expanded bundle catalog; no runtime changes.
- 108ce16: Prune the last stranded registry version: agent-trajectory 0.3.0 advertised a downloadable
  archive that was never uploaded to the registry's storage. Its PR #312 carve-out ("until the
  next consume repoints the pins") expired when #315/#317 repointed the agentic-dev and
  everything bundle pins to agent-trajectory 0.3.4. Delisted append-only: publish history is
  preserved, the version no longer appears in the served catalog, and every currently
  installable version is unaffected.
- Updated dependencies [25fd03c]
- Updated dependencies [108a358]
- Updated dependencies [96aa01d]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
- Updated dependencies [fe2dfac]
  - @caisson/registry-schema@0.5.8
  - @caisson/pricebook@0.8.0
  - @caisson/license-verify@0.3.6

## 0.0.20

### Patch Changes

- eabb89f: Prune 60 superseded historical versions whose downloadable archives were never uploaded to the
  registry's storage. These intermediate versions were replaced by newer releases before any
  publish run could ship their files, so they advertised entries that could not be downloaded.
  Each is now delisted append-only: the publish history is preserved, the versions no longer
  appear in the served catalog, and every currently installable version is unaffected.
- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7
  - @caisson/pricebook@0.7.2

## 0.0.19

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/license-verify@0.3.5
  - @caisson/pricebook@0.7.1
  - @caisson/registry-schema@0.5.6

## 0.0.18

### Patch Changes

- 7574a00: Release-integrity refinement: a recorded artifact's build-resolution stamp now annotates a
  real checksum mismatch instead of gating the verification — routine internal version bumps
  no longer flag artifacts whose bytes are unchanged. No behavioral change to what can be
  published.
- Updated dependencies [2bda239]
  - @caisson/pricebook@0.7.0

## 0.0.17

### Patch Changes

- 2229209: Release integrity hardening: every recorded package artifact now carries the dependency
  resolution it was built under, so a resolution change between releases is reported as a
  precise "republish this package" notice instead of a checksum mismatch. The agent loop's
  credit-budget guard is restated in fail-closed form, and stale documentation comments in
  the registry schema and the agent-trajectory manifest are corrected. No behavioral
  changes to published APIs.
- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5
  - @caisson/pricebook@0.6.1

## 0.0.16

### Patch Changes

- Updated dependencies [6f0af8a]
  - @caisson/pricebook@0.6.0
  - @caisson/license-verify@0.3.4

## 0.0.15

### Patch Changes

- Updated dependencies [5d03808]
  - @caisson/registry-schema@0.5.4
  - @caisson/pricebook@0.5.6
  - @caisson/license-verify@0.3.3

## 0.0.14

### Patch Changes

- Updated dependencies [f40653b]
  - @caisson/registry-schema@0.5.3
  - @caisson/pricebook@0.5.5

## 0.0.13

### Patch Changes

- 25b82e6: The version-publish step now re-verifies every previously recorded package tarball reproduces its advertised bytes, closing a gap where a single-shot release could skip that check entirely. A new maintenance tool backfills older package versions into object storage when their tarball was never uploaded, resolving each historical version from its source history and refusing to upload anything that does not byte-match the advertised checksum. The backfill tool is also more resilient now: a transient upload failure on one package no longer aborts the whole run, and it checks all required storage credentials up front with a clear error instead of failing partway through.
- 3fdc6a8: The published module catalog can now retire an individual version without touching the rest of that module's history: a superseded release whose downloadable package is no longer available is quietly excluded from what the registry advertises, while every other version of that module keeps installing normally. A new command-line tool applies this in bulk from a plain list of module-and-version pairs, defaults to previewing what would change before writing anything, refuses to retire a version that is still the one buyers currently install, and skips a pair automatically if it was already handled on an earlier run. A maintenance tool that re-uploaded older package archives to storage has been removed; retiring an unavailable version from the catalog is now the supported way to resolve one.

## 0.0.12

### Patch Changes

- 7871ae4: Two additive parity guards for the tarball delivery pipeline: a scheduled probe now verifies every advertised registry tarball byte-for-byte against object storage (fail-closed on missing, unreachable, or drifted objects), and version PRs fail early when a dependency bump would silently change a sibling package's published bytes at an unchanged version.

## 0.0.11

### Patch Changes

- 9664593: Re-record the platform-reads tarball sidecar row a second time: the packed bytes embed resolved
  workspace dev-dependency versions, so the service-license bump in the previous consume changed the
  pack at an unchanged platform-reads version and staled the row again. Recorded from a pristine
  checkout of the tagged commit; the systemic dev-dependency-resolution churn is tracked for an
  upstream fix.

## 0.0.10

### Patch Changes

- 5a09b01: Re-record the platform-reads tarball sidecar row from a pristine checkout after the consume runner
  recorded bytes the committed tree cannot reproduce, and tighten the everything-bundle delivery
  invariant to every sellable module — an indexed but unsellable module deliberately rides outside
  every bundle until its publish gate.
- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2
  - @caisson/pricebook@0.5.4

## 0.0.9

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1
  - @caisson/pricebook@0.5.3

## 0.0.8

### Patch Changes

- a8d8f5e: Add a dedicated unauthenticated health route to the registry read Worker: GET /health returns a 200 with the registry schema version and is never cached, giving uptime monitors a stable check target that reads no data.
  - @caisson/license-verify@0.3.2
  - @caisson/pricebook@0.5.2
  - @caisson/registry-schema@0.5.0

## 0.0.7

### Patch Changes

- 53f71a2: Releases are now commit-addressable: the publish step checks out the exact release tag, verifies the catalog (ledger, index, and recorded per-tarball hashes) against the tagged source tree, and re-packs every tarball requiring byte-equality with the recorded hashes before anything uploads. Version bumps and catalog updates land only through a reviewable version PR — publishing never mutates source, and a re-run never overwrites an already-published version.
- f600196: CI evidence pack: the quality workflow now assembles gate outputs, index byte-identity proof, and test summaries into one hashed, versioned artifact.
- 317bad5: Add an index-parity probe script that compares the registry index shipped in the repo
  against the copies served by the deployed registry and the license service, printing a
  per-copy table and exiting non-zero when any reachable copy serves a stale or unexpected
  entry. Private package only; no publishable release.
- 2b65cf3: Adds a regression test pinning the registry's anonymous catalog response to exactly the
  open-source base set — packages with an Apache-2.0 license and no commercial bundle
  membership — derived from the committed catalog index rather than a hardcoded id list, so
  a legitimate new open package doesn't false-positive the test while a commercial-package
  leak still fails loudly. Private package only; no publishable release.
- 60e65ef: The index-parity probe (`registry/scripts/index-parity-probe.ts`) now also compares the
  admin service's baked index against the repo reference, using the same strong digest
  check as the license leg — completing the three-way parity check now that the admin
  control-plane's own sign-in has made `/healthz` externally reachable without the edge
  gate the leg previously required. Private package only; no publishable release.
- f5a21c1: Rate-limited registry responses now carry a `Retry-After` header alongside the 429 status, so npm and bun back off and retry instead of failing the install. The edge rate limit is also resized to accommodate a full bundle install burst without tripping.
- 2b65cf3: The registry read Worker now app-level rate-limits anonymous traffic via the native
  Cloudflare Workers Rate Limiting binding: three independent per-IP budgets
  — catalog reads (300/60s), npm packument reads (120/60s), and tarball bytes (60/60s) —
  each checked before its route class's entitlement gate. A missing binding (not yet
  provisioned) or a limiter error fails OPEN; only a genuine bucket-empty deny returns 429.
  Private package only; no publishable release — the wrangler.toml binding config is
  inert until the operator provisions the three `[[ratelimits]]` namespaces at DEPLOY.
- Updated dependencies [3d23da7]
- Updated dependencies [9a81dd7]
- Updated dependencies [9a81dd7]
- Updated dependencies [317bad5]
- Updated dependencies [8253e76]
- Updated dependencies [2b65cf3]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [4d85f28]
  - @caisson/registry-schema@0.5.0
  - @caisson/pricebook@0.5.1
  - @caisson/license-verify@0.3.1

## 0.0.6

### Patch Changes

- Updated dependencies [8170382]
  - @caisson/registry-schema@0.4.0

## 0.0.5

### Patch Changes

- 7aee6cc: The registry Worker gains its one write surface: an authed `PUT /revocations/deny-set.json`
  publisher endpoint for the license-revocation deny-set. Bearer-gated behind a worker secret
  (timing-safe digest compare), strict-schema validated against the exact shape the edge reader
  parses, size-capped, and the stored artifact is a canonical deduped re-serialization — never raw
  request bytes. The route serves 404 until both the secret and the bucket binding are provisioned;
  all responses carry the standard security headers.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [90b6dc1]
- Updated dependencies [850b844]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/license-verify@0.3.0
  - @caisson/registry-schema@0.3.0

## 0.0.4

### Patch Changes

- @caisson/license-verify@0.2.3

## 0.0.3

### Patch Changes

- 4fc006c: Admin paid-purchase revoke. service-license: `revokePurchaseAdmin` composes the
  existing source-scoped revoke helpers with the bounded clawback (`creditsGrantedBySource -
creditsClawedForSource`) under `withAdminWrite` in one transaction, a new `purchase_revoke`
  `admin_action_log` action + CHECK migration, and a `license-revocation-store` feeding the registry's edge deny-set. admin: a paid-revoke mutation card with an impact-preview read (active sources +
  projected claw) plus type-to-confirm, and the `/api/admin/entitlement/revoke-purchase` (+
  `/preview`) routes. registry: the Worker deny-set check (`revocation-list.ts`), wired
  fail-open into `entitlement-filter.ts`/`deploy-entry.ts` so a fetch/parse failure never blocks an
  install.
  - @caisson/license-verify@0.2.2

## 0.0.2

### Patch Changes

- ea52d1f: Add `@caisson/agent-runner` (new, ADR-0186): the sandboxed governed agent runner completing
  the Agentic-Dev "run agents safely" story. Spawns a headless agent CLI as a detached subprocess
  in an isolated worktree with a from-scratch scrubbed env — never spreads `process.env`; fixed
  non-secret passthrough allowlist + only the target provider's key + isolated HOME/config dir
  (ship-blocking leak-guard test, unit + end-to-end through a real spawn). Provider-agnostic
  config `{ binary, baseUrlEnv, authEnv, model, args }` with a worked Claude-CLI profile
  (`--strict-mcp-config`, no credentialed MCP); durable `.jsonl` transcript surviving launcher
  exit; run registry `spawn`/`tail`/`status`/`kill`/`list`/`finalReport` with `.strict()`-validated
  meta reads and a structured report (tool calls, files touched, final result) parsed from the
  transcript. Registered in the `apps/agent-dev` demo composition (`runAgentRunnerDemo`), and
  folded into the Agentic-Dev edition's `members` pin map + dependencies (ADR-0186 F5 edition-only
  SKU, the ADR-0178 tool-exec form).
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
  - @caisson/registry-schema@0.2.1
  - @caisson/license-verify@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [9483a36]
  - @caisson/registry-schema@0.2.0
  - @caisson/license-verify@0.2.0
