# SWEEP — Stage-2 · Stream C (downstream impact, Act 5)

What else the diff touches; what's queued. All non-blocking (the gate is green as a unit).

## Downstream impact walked

- **Provider-enum consumers (C5).** `ProviderConfig["provider"]` fans out to one exhaustive consumer:
  `mcp-server/src/coach.ts` `DEFAULT_KEY_ENV`. It broke on the enum expansion and was fixed
  (`3508d5c`) — the full `turbo build` (cross-package tsc) caught it where per-package runs did not.
  Lesson recorded: run the whole-monorepo build after any shared-enum/shared-type change, not just the
  owning package.
- **`apiKeyEnv` optional (C7).** Made `apiKeyEnv` optional; walked every non-test reader
  (`providers.ts`, `config.ts` refine, `coach.ts` × 2). `coach.ts` `keyNames` now filters undefined;
  `coach.ts:208` already had a `?? default` fallback (type-safe). No other reader assumes non-optional.
- **ai-kit dependency graph (C7).** ai-kit gained a runtime `@caisson/field-crypto` dep; reconciled in
  `package.json` + `manifest.ts` dependencies + the ADR-0077 member pin map (`192c420`). `depcruise`
  confirms it stays down-only (no edition-depends-up, no new Gate-2 hole).
- **`ModelResolver` contract (C7).** Grew an optional `accountId` (widening — back-compatible); both
  `infer`/`inferStream` call sites thread it. `buildRegistryResolver`'s `(lane)=>…` is still assignable.
  Every existing test injecting a mock resolver is unaffected (40/40 ai-kit green).
- **Registry index / ledger.** B/C/D all add publishable modules; per the Stage-2 plan the index is
  **rebuilt ONCE at integration** (the known must-rebuild-index gotcha) — NOT touched in-stream. No
  new module was published here; only ai-kit's manifest deps changed (data the index build re-reads).

## Stale docs updated (C9)

`docs/state/readiness-and-backlog.md` edition act-trail-debt bullets → CLOSED; `packages/compliance/`
README+AGENTS EU-AI-Act "reserved slot" → struck. `docs/build-state.md` needed no correctness edit
(verified clean during recon). ADR catalog `docs/adr-index.md` carries the 0160–0162 block.

## Queued follow-ups (not in-stream; named, non-blocking)

- **C2 optional test hygiene** — streaming output-guard/PII-restore branch tests + a gateway-level
  soft-cap-non-blocking assertion (~80 LOC). The literal C2 ask is done; these are coverage nice-to-haves.
- **C7 write half (deferred by ADR-0162)** — the buyer-facing encrypt-on-write key-submission surface
  (P3-24-gated) + the credit-vs-BYOK pricebook policy. Bedrock per-tenant BYOK (multi-part cred).
- **C5 follow-ups (ADR-0160 deferred)** — local-ai `RentedTransport` drivers for the new providers;
  embedder drivers; the C8 live-transport exercise (operator-sequenced DEPLOY).
- **C4 GA-promotion** — the local inspector (a read-only, localhost-only `Bun.serve` view, not the
  Next.js surface earlier drafts assumed) has since SHIPPED per
  `outputs/specs/deferred-respec/SPEC-agent-dev-inspector.md` / ADR-0243 (ADR-0082 §4 governs only
  the edition's labeled-roadmap _site copy_, never this technical deferral); a worked buyer-wired
  `Embedder` example is the remaining doc-only embedding-lane close.
- **`docs/build-state.md`** — the P2/P3/P4 rows may be upgraded from "partial" toward "shipped" for the
  now-wired surfaces at the integration reconcile (a status-catalog edit, integration-owned).

## Integration-session hand-off

Merge order A→B→C→D. Deliberately-shared files this stream touched that integration reconciles:
`docs/adr-index.md` (0160–0162 block, append-only), `docs/state/readiness-and-backlog.md`,
`tooling/eslint-config/boundaries.js` (2 new confined SDKs), `bun.lock` (re-resolve once),
`registry/{ledger,index}.json` (rebuild once — NOT hand-merged). No cross-stream ADR-number collision
(C = 0160–0169). No live deploy from this stream.
