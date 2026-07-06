---
updated: 2026-07-05
status: live
---

# Refactor / split opportunities — ranked, repo-grounded

Status: **R1 + R2 EXECUTED 2026-07-05** (PR #119 hygiene wave — Apache-2.0 `@caisson/rate-limit`
now owns the token-bucket limiter + the per-account PG store/hook; `services/docs` +
`services/license` import it down and `apps/base/src/app.ts` imports `@caisson/rate-limit`, the
app→commercial-service up-dep is gone). **R4's env-gate half was already fixed** (`936f54f`); the
analytics _port_ stays owned by `adapter-expansion.md`. **R3 remains open and price-lock-gated**
(now against the ADR-0227 $799 anchor) — queued in the SOT-expansion kickoff, do NOT auto-start.
Authored 2026-06-30. A ranked survey of where
the package structure should move: split a god-package, extract a shared concern to base, decouple an
up-dependency, clean the open↔commercial boundary. Grounded in code-on-disk at `main`, not vibes —
every row cites a path (`file:line` where load-bearing).

**Spec-gate (binding).** Every row here MOVES code, so every row is spec-gated per the root `CLAUDE.md`
cadence ("No product code before the spec/ADR it implements is locked"). Nothing lands without its own
per-item SPEC + ADR lock. Rows that also re-open a **locked price** (R3) additionally need an operator
lock, not just an engineering SPEC.

Method: `packages/*/src` + `services/*/src` reads, `package.json` `license`/`dependencies` off disk,
cross-package import grep, `docs/build-state.md` LOC/test/verdict truth. Cross-links:
`docs/state/package-catalog.md` (per-package inventory), `docs/state/public-surface-minimization.md`
(what to stop shipping / narrow), `docs/state/harvest-program.md` (net-new sellable surface),
`docs/state/adapter-expansion.md` (driver/port buildout). This page owns _restructuring existing code_;
those own _adding_ and _narrowing_.

## The open↔commercial split is a hard constraint on every extraction

Read from disk (`packages/*/package.json` `license`, not any embedded list): the **15 Apache-2.0 base
packages** are `kernel · auth · tenancy-rls · billing · credits · ai-config · email · jobs · mcp-server ·
ui · registry-schema · observability · cli · migrate · license-verify` (`observability` added
post-ADR-0094; `cli · migrate · license-verify` flipped commercial→Apache-2.0 by ADR-0136). Everything
else — editions, `field-crypto`, `audit-worm`, `compliance`, `pricebook`, `platform-reads`,
`license-issue`, and all three `services/*` — is `LicenseRef-Caisson-Commercial` (ADR-0094 open-core,
ADR-0097 registry split, ADR-0136 further widened the open set). `tooling/standards-gate/src/checks.ts:30-35`
is the authority (`OPEN_LICENSE`/`COMMERCIAL_LICENSE`) and enforces the no-depend-up boundary. **An
extraction must not move a commercial concern into an Apache-2.0 package unless the concern is
genuinely generic infra** (then it _becomes_ Apache-2.0), and must never make an open package depend up
on a commercial one.

**Precedents to follow** (this pattern is already proven three times — extract shared concern → own
package → consumers import DOWN, never copy):

- `registry-schema` split from the commercial registry service (ADR-0097) — open `@caisson/registry-schema`, re-exported by the commercial `@caisson/registry`.
- `migrate` extracted from `cli` (ADR-0090) — `packages/migrate`; `cli` + `compliance` import it, never copy it.
- `platform-reads` extracted (commit `d6a618c`) — `packages/platform-reads`.

## Ranked opportunities

| Rank   | Opportunity                                                                                              | Type                                  | Files                                                                                                                       | Value                                                                                                                                          | Effort | Spec-gated?             |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- |
| **R1** | Hoist the per-IP token-bucket rate-limiter into a shared base package                                    | extract-to-base                       | `services/docs/src/rate-limit.ts` + `services/license/src/rate-limit.ts` (near-identical)                                   | Hygiene — kills a ~165-line copy-paste; one owner; third surface (the site) is one flood away                                                  | **S**  | Yes                     |
| **R2** | Decouple the open base reference app from the commercial license service (per-account ADR-0112 throttle) | extract-to-base · decouple · boundary | `services/license/src/{rate-limit-store,rate-limit-hook}.ts` → base; `apps/base/src/app.ts:13`, `apps/base/package.json:25` | Boundary — restores open/commercial purity; removes an app→commercial-service up-dep; any base embedder gets throttling with no commercial dep | **M**  | Yes                     |
| **R3** | Split the `compliance` god-package into framework-catalog / evidence-assembly / signing                  | split                                 | `packages/compliance/src/{frameworks/*, evidence/*}` (16 src / 2871 loc)                                                    | **Product** — unlocks a-la-carte framework packs (P7 "compliance vertical packs") + a standalone evidence-signing primitive; speculative       | **L**  | Yes **+ price re-lock** |
| **R4** | Give web analytics a port (currently hardcoded, no seam)                                                 | boundary · extract-port               | `apps/site/app/layout.tsx:61` (`data-domain` hardcoded)                                                                     | Hygiene + a live bug — already owned by `adapter-expansion.md` §1D / ADR-0122                                                                  | S      | Yes (tracked elsewhere) |

**Considered and rejected** (below the table) — the thin-package _merge_ and the `ai-kit` _absorb_: both are anti-recommendations. Thin ≠ mergeable when the seam is the product.

---

## R1 — Extract the per-IP token-bucket limiter to base _(hygiene, do first)_

`services/docs/src/rate-limit.ts` and `services/license/src/rate-limit.ts` are a **near-verbatim
duplicate**: identical `TokenBucketLimiter` class (same `#prune` FIFO-evict, same `check` window
logic), identical `clientIp(req)` XFF parse, identical `loadRateLimitConfig` env shape — they differ
only in bucket names (`query`/`static` vs `webhook`/`issue`) and env-var prefixes (`DOCS_RL_*` vs
`LICENSE_RL_*`). This is not inferred; the license copy **self-documents the debt** at
`services/license/src/rate-limit.ts:11-13`:

> "This is a deliberate near-duplicate of services/docs/src/rate-limit.ts … the task scoped a local
> copy over premature extraction; **if a third surface needs this, lift it into a shared `@caisson/*`
> helper then.**"

The third surface is already visible — `apps/site/app/api/waitlist/route.ts` reads `x-forwarded-for`
by hand, and the whole point of the Railway grey-origin limiter is that every public unauth surface
needs it. **Extract now:** a new **Apache-2.0** `@caisson/rate-limit` (the limiter is generic infra —
no commercial secret; it belongs with `kernel`-class primitives). Parameterize the bucket names so
each service keeps its own `BucketConfig`; the two services import `TokenBucketLimiter` + `clientIp`
down. Round-trip/port-conformance test per the `adapter-expansion.md` convention. **Effort S** — the
code is already identical; this is a move, not a rewrite. Pure hygiene, highest confidence.

## R2 — Decouple `apps/base` from the commercial `service-license` _(boundary, converges with R1)_

`apps/base` — the **open** base-substrate reference app (`@caisson/app-base`) — imports the concrete
per-account MCP throttle from the **commercial** `@caisson/service-license`:
`apps/base/src/app.ts:13` `import { createRateLimitHook } from "@caisson/service-license"`, backed by
`apps/base/package.json:25` `"@caisson/service-license": "workspace:*"`. This is an app→commercial-service
**up-dependency** in the tree that is supposed to demonstrate the _open_ base composition end-to-end.

The concern doesn't belong in a service at all. `mcp-server` (Apache-2.0) already owns the **port**
(`checkRateLimit`, ADR-0112, kept DB-free on purpose). The concrete PG store + hook
(`services/license/src/rate-limit-store.ts`, `rate-limit-hook.ts`) import **only `@caisson/kernel` +
`@caisson/tenancy-rls`** (`rate-limit-hook.ts:13-14`) — both Apache-2.0 base. So the ADR-0112 store is
a **base concern currently marooned in a commercial service**. Hoist it into a base package and
`apps/base` composes pure base again; the commercial `services/license` re-imports it down (same shape
as `registry` re-exporting `registry-schema`).

**Converges with R1:** both the generic per-IP `TokenBucketLimiter` (R1) and the per-account PG store
(R2) are the same domain — land them as **one Apache-2.0 `@caisson/rate-limit`** package (in-memory
per-IP limiter + PG-backed per-account store), owned separately from the `mcp-server` port. That single
package clears the docs↔license dup _and_ the app→service up-dep in one seam. **Effort M** (a real move

- re-point three consumers + keep `mcp-server` DB-free). Boundary/open-core integrity.

## R3 — Split the `compliance` god-package _(product value, but price-locked — do NOT auto-start)_

`packages/compliance` is the largest edition at **16 src / 2871 loc** and bundles three separable
concerns behind one barrel (`packages/compliance/src/index.ts`):

1. **Framework catalog** — `frameworks/soc2-tsc.ts` (270) + `hipaa-security.ts` (267) + `eu-ai-act.ts`
   (299) = ~836 loc of control definitions. These are _data packs_, independently versionable, and the
   P7 roadmap already names "compliance vertical packs" as a future SKU family (`build-state.md` P7).
2. **Evidence assembly** — `evidence/{collector,collectors/*,pack-format,generate.ts}` (`generate.ts`
   alone 438 loc): the flag-never-guess control→evidence pack builder + byte-stable ZIP.
3. **Signing** — `evidence/sign.ts` (293 loc): **per-tenant Ed25519 + RFC-3161** detached signature,
   explicitly _distinct from the Caisson license key_ (`sign.ts:8-11`). A self-contained provenance
   primitive that a non-compliance buyer might want a-la-carte.

(Plus `with-tenant-crypto.ts` composition, `migrate/assemble.ts`, `observe.ts`, and the un-wired
`oscal-export.ts` seam — 429 loc, T15.)

**Why it's product, not hygiene:** the per-module sale (LOCKED price matrix: `compliance` = $299 as
one module) currently forces "buy the whole edition" for what are three sellable surfaces. Splitting
framework-packs and the evidence-signing primitive into their own SKUs is genuine new a-la-carte
surface. **Why it's ranked below R1/R2 and flagged do-not-auto-start:** it re-opens a *locked* price
(the $299 `compliance` module in ADR-0129) and the edition-sum math (`compliance $299 | field-crypto
$199 | audit-worm $149 | alerting $149 | retention-runner $199`), so it needs an **operator price lock

- superseding ADR**, not just an engineering SPEC. It's the biggest upside and the most speculative;
  gate it behind an explicit product decision. **Effort L.**

> **Compliance edition price footnote (open sub-flag, carried from the pricing SOT):** the $749
> Compliance edition is the Q4 "full below-sum" lock (~25% off its 5-module sum $995), but **2 of
> those 5 modules — `alerting` + `retention-runner` — are zero-code post-go-live harvest**
> (`harvest-program.md` / ADR-0135). The **launch** Compliance catalog therefore shows only 3
> modules = **$647 sum**, so $749 currently sits **~$102 ABOVE** the launch sum; held per the
> as-if-built storefront (ADR-0130, all 5 shown available). An R3 split would further fragment this
> math — another reason it is price-lock-gated. Relevant here because any compliance re-carve touches
> the same locked numbers.

## R4 — Analytics has no port (hardcoded)

The env-gate half is **DONE**: `apps/site/components/plausible-init.tsx` reads
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` and no-ops (no init, no network) when unset — no hardcoded
`data-domain` remains anywhere in `layout.tsx` (fixed same-day as this row was written,
commit `936f54f`; this row went stale, not the code). What's still open is the bigger ask:
a real analytics **port** so PostHog/GA4 are swappable, not just Plausible. **Owned** by
`docs/state/adapter-expansion.md` §1D → ADR-0122 (roadmap, not built). Listed here only for
completeness; execute it there, not from this page.

---

## Considered and rejected

**MERGE the four thin base seams — NO.** `ai-config` (49 loc, `build-state.md:108`), `tenancy-rls`
(75, `:105`), `jobs` (73, `:111`), `email` (82, `:112`) are all thin, but **thin by design** — each is
a single-responsibility DI **port** whose whole job is to be a swappable seam, and each has its own
independent driver-expansion lane in `adapter-expansion.md` (`email`→SMTP/SES ADR-0119, `jobs`→pg-boss
ADR-0124, `ai-config`→Bedrock/Azure/Ollama ADR-0125). Merging them would (a) couple independently-
versioned ports, (b) break ADR-0003 composability — a buyer composes `email` without `jobs` — and (c)
blur the Apache-2.0 base granularity that `tooling/standards-gate` enforces. The line count is the
_point_, not a defect. Leave them alone.

**ABSORB / dissolve `ai-kit` (358 loc, "thinnest edition root") — NO.** `ai-kit` is an **edition root**,
not a utility: it's the composition surface sold as the "AI Production Kit" $599 SKU (ADR-0059),
gatewaying `ai-meter` + `ai-evals` + `guardrails` + `prompt-registry`. The composition _is_ the product;
dissolving it would erase a sold edition. Its `src/gateway.ts` (22.8 KB, one dense file) is a god-_file_
inside a thin package — an optional internal split into pipeline stages is available but is pure
low-value hygiene; the **package** boundary is correct. Do not touch the SKU; file-split is optional.

## Cross-links

- `docs/state/package-catalog.md` — the per-package inventory these opportunities re-shape.
- `docs/state/public-surface-minimization.md` — the complementary "stop shipping / narrow the surface" track (R1/R2 shrink surface; that doc owns the export-narrowing side).
- `docs/state/harvest-program.md` — net-new sellable surface (the R3 framework-pack idea rhymes with the harvest's new Compliance modules; keep them distinct — harvest _adds_, R3 _re-carves existing code_).
- `docs/state/adapter-expansion.md` — the driver/port buildout; R4 lives there in full (§1D).
- `docs/build-state.md` — the LOC/test/verdict source every row cites.

## Binding

This page ranks _restructuring_ opportunities; it locks no decisions. R1/R2 need an engineering SPEC +
ADR before code (hygiene/boundary, no product change). R3 needs an **operator price lock + superseding
ADR** on top. R4 is executed from `adapter-expansion.md`. Re-rank freely as work lands; a change to
_what_ is split or _why_ requires a new ADR, not an edit here.
