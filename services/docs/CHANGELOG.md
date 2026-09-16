# @caisson/service-docs

## 0.0.16

### Patch Changes

- 1e2f79a: Health probe paths now answer ahead of the edge origin gate. The platform healthcheck reaches each container internally and cannot carry the edge-injected origin-secret header, so arming the gate as the first check made every one of the four gated services fail its own readiness probe and froze the whole deploy path. The exemption is keyed on exact string equality against each service's configured `healthcheckPath`, never a prefix, so a trailing slash, a longer path, a differing case and a traversal segment all stay behind the gate; a per-service test pins the constant against the deployment manifest so a drift in either cannot silently re-freeze deploys.

  Because the probe path is now reachable without the secret, the responses shrink to liveness for unauthenticated callers. The docs service withholds its corpus chunk count, and the license service and the operator control-plane withhold their registry index digest and entry count, unless the caller presents a valid origin secret. Traffic arriving through the edge carries that header, so the registry index parity probe keeps reading the digest from both services; only a caller reaching a raw platform origin directly is reduced to a bare status.

- 7e11672: Upgrade runtime OS layers on pinned bases and gate fixable HIGH/CRITICAL runtime OS findings while reporting application and raw-base residuals.
- 7d39669: Report the serving revision on every deployed service.

  Each service now answers with an `x-caisson-revision` response header naming the commit its
  running image was built from, so "which code is actually live" is one request instead of an
  inference from how a route behaves.

  The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
  entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
  build that did not come through that path reports `unknown` rather than guessing.

  The header is deliberately not gated behind origin verification: it has to stay readable exactly
  when that gate is the thing misbehaving, which is the case it exists to diagnose.

- Updated dependencies [045b21e]
- Updated dependencies [f02b193]
- Updated dependencies [87b07c6]
- Updated dependencies [9cb7681]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/local-store@1.1.2
  - @caisson/observability@0.3.9
  - @caisson/kernel@0.10.0
  - @caisson/rate-limit@0.2.1

## 0.0.15

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
- Updated dependencies [2405d9e]
  - @caisson/kernel@0.9.0
  - @caisson/local-store@1.1.1
  - @caisson/observability@0.3.8
  - @caisson/rate-limit@0.2.0

## 0.0.14

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [42d9710]
- Updated dependencies [7d74f8f]
  - @caisson/observability@0.3.7
  - @caisson/local-store@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/rate-limit@0.1.10

## 0.0.13

### Patch Changes

- e917c52: Plain price questions now retrieve the right price. Asking "how much is the Compliance bundle" or "what does it cost to renew Compliance" used to return no priced answer at all — the generated catalog headings read "Compliance — $1,649", which shares no word with "how much" or "cost", and the keyword floor has no synonyms. Each bundle now carries a one-line answer in the buyer's own words, including the renewal figure.

  Answering in the buyer's words was not sufficient on its own. Every bundle's member list travelled in the same block as its price, and the longest lists were pushed down the ranking by their own length, so a question about one bundle could still be answered with a different bundle's price. Each bundle's price and its member list are now separate blocks, and the retrieval checks pin the expected figure rather than merely the page, so a question answered with the wrong bundle's number fails.

  The retrieval checks also build the corpus the way the running service does, with the generated pricing content included; they previously omitted it, which is why these failures reached production with the suite green.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/local-store@1.0.6
  - @caisson/observability@0.3.6
  - @caisson/rate-limit@0.1.9

## 0.0.12

### Patch Changes

- 108a358: Documentation-assistant pricing data updated for the repriced Compliance bundle and the three new compliance modules.
- Updated dependencies [a00a9ef]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
- Updated dependencies [96aa01d]
  - @caisson/observability@0.3.5
  - @caisson/kernel@0.6.0
  - @caisson/rate-limit@0.1.8
  - @caisson/local-store@1.0.5

## 0.0.11

### Patch Changes

- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/local-store@1.0.4
  - @caisson/observability@0.3.4
  - @caisson/rate-limit@0.1.7

## 0.0.10

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/local-store@1.0.3
  - @caisson/observability@0.3.3
  - @caisson/rate-limit@0.1.6

## 0.0.9

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/local-store@1.0.2
  - @caisson/observability@0.3.2
  - @caisson/rate-limit@0.1.5

## 0.0.8

### Patch Changes

- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- Updated dependencies [e5e4311]
- Updated dependencies [d1b4afa]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/observability@0.3.1
  - @caisson/local-store@1.0.1
  - @caisson/rate-limit@0.1.4

## 0.0.7

### Patch Changes

- 7bc8e71: The docs service's embedding cache now actually persists on its mounted volume: the container
  entrypoint hands the volume to the runtime user before dropping privileges (volumes mount
  root-owned), and cache read/save failures are logged with their error code instead of failing
  silently.
- be359ee: The docs service now keeps a content-hash embedding cache on its persistent volume: a redeploy
  with an unchanged corpus makes zero embedding calls instead of re-embedding every chunk, and
  only changed content is embedded when docs are updated.
- 8009260: Boot no longer blocks on embedding the docs corpus before the server starts listening: the port
  binds immediately and answers a `{"ok":false,"warming":true}` 503 on every route until the real
  index is ready, then swaps in the live handler in place. A degraded or rate-limited embedding
  provider can no longer stretch that warmup window past a few minutes either — the whole
  embedding phase now has a hard deadline (independent of corpus size or any single chunk's
  in-flight retry/backoff), past which every remaining chunk falls back to the text-search floor
  instead of blocking startup, with a log line naming how many chunks got a real embedding versus
  how many fell back. Private package only; no publishable release.
- 8009260: `POST /query` now recognizes an authorized caller (a valid Bearer token) and charges it
  against a separate, larger rate-limit budget instead of the small anonymous per-IP one.
  Many distinct real end-users funneled through a single authorized caller's shared egress
  IP (for example, an entire Discord community proxied through one bot) no longer squeeze
  into the same tight bucket meant to cap an unauthenticated flood. Every request is still
  rate-limited before any expensive work runs — a valid token never exempts a caller from
  the gate, it only selects which budget applies. Private package only; no publishable
  release.
- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- f0ab087: The generated bundle-pricing docs now name every member module's id, price, and a one-line
  description alongside each bundle, not just a bare price list — the RAG corpus can answer "what's
  in bundle X" from one chunk, sourced from the same pricebook facts as before.
- 4c141b0: Export the license and docs service request-body schemas for security schema fuzzing, and add a local admin auth harness so authed pages can be exercised without OAuth. No runtime behavior change.
- 329150a: The docs service's embed-phase boot deadline is now tunable via `DOCS_EMBED_PHASE_DEADLINE_MS`
  (bounded 1s-30min; invalid values fall back to the 3-minute default). The docs corpus outgrew
  the default: only the first ~80 chunks were getting real embeddings per boot, which skewed the
  vector leg of retrieval toward the alphabetically-first pages regardless of the question asked.
  The Railway healthcheck timeout was raised alongside it so a long warmup is never mistaken for
  a failed deploy.
- Updated dependencies [2b65cf3]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [0dd715a]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/local-store@1.0.0
  - @caisson/observability@0.3.0
  - @caisson/rate-limit@0.1.3

## 0.0.6

### Patch Changes

- @caisson/rate-limit@0.1.2

## 0.0.5

### Patch Changes

- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [4d7eb71]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/local-store@0.2.4
  - @caisson/observability@0.2.4
  - @caisson/rate-limit@0.1.1

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/local-store@0.2.3
  - @caisson/observability@0.2.3

## 0.0.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/local-store@0.2.2
  - @caisson/observability@0.2.2

## 0.0.2

### Patch Changes

- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [623d07c]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/local-store@0.2.1
  - @caisson/observability@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/observability@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/local-store@0.2.0
