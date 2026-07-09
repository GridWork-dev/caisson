# KICKOFF — Track: Code & wiring (fast-follows → P6 commerce → publish-readiness)

> Run this as the first message of a fresh Claude session in a worktree off clean `main`
> (`track/code-wiring`, e.g. `~/lab/caisson-code`). Spec-first: every item below is **ADR-locked** —
> no new forks to decide, only build. Disjoint from the design track (`services/*` +
> `packages/{migrate,cli,billing,credits,…}` + `tooling/` + `registry/`, vs the design track's
> `packages/ui` + `apps/site` + `apps/studio`), so the two run as parallel worktree streams.

---

## Mission

Land the pending engineering — the locked fast-follows, the P6 commerce spine, and publish-readiness —
as a sequence of **atomic, individually-verified PRs**. Tags vary per item (`external-system`,
`security`, `billing`, `infra`); fire the conditional audits per the SPEC of each.

## Read first

- `docs/state/readiness-and-backlog.md` — the work-item register (W1–W8) + live-test/config matrices
- `docs/build-state.md` — what's built vs partial vs pending (the SOT)
- `docs/state/decisions-and-forks.md` — the locked decisions (incl. the 2026-06-28 + 2026-06-29 rounds)
- `knowledge/decisions/ADR-0089` (X-2 billing) + `outputs/specs/billing-x2/` · `ADR-0090/0091` (migrate) ·
  `ADR-0092` (npx bin) · `ADR-0093` (local-CLI free) · `ADR-0094` (open-core Base) · `ADR-0095` (GTM offer)

## Triage — buckets, sequence, dependencies

### Bucket A — fast-follows (ready now, no external infra, no fork)

| Item                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                     | ADR  | Notes                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **W2 `@caisson/migrate` extract**     | New base pkg `packages/migrate/`: hoist the IO assembler + runner (`SelectedPackage`, `readPackageMigrations`, `assembleSelected`, `emitMigrationFileSet`, `MigrationApplier`, `runMigrations`) out of `packages/cli/src/migrate/assemble.ts`; define a local emit-file type (no depend-up on cli); rewire `cli` to import `@caisson/migrate`; manifest + Apache-2/commercial license per W1; tests move. | 0090 | Pure mechanism is already in `@caisson/kernel`; this is the IO/runner half. ~150–250 LOC moved + new pkg scaffold. Standards-gate conformance is the gotcha. |
| **W2b compose-time migration-bundle** | CLI build/pre-publish step copying each module's `src/migrations/*.sql` → `packages/cli/migrations-bundle/<name>/` (mirrors the proven `templates/` pattern; `packageDir()` wired).                                                                                                                                                                                                                       | 0091 | May relocate under `@caisson/migrate`. Empty no-op today.                                                                                                    |
| **W1 open-core re-licensing**         | `tooling/standards-gate` license check: allow **Apache-2.0** on the 10 base pkgs + enforce the open↔commercial **no-depend-up** boundary; set `license` in the 10 base `manifest.ts` + `package.json` → `Apache-2.0`; add Apache-2.0 `LICENSE` files; update `apps/site` licensing copy (coordinate w/ design track).                                                                                     | 0094 | **Tag: `security`** (licensing/boundary). The standards-gate currently _enforces_ commercial-only — this is the core change; test it.                        |

### Bucket B — P6 commerce spine (the value; build in this order)

| Item                                      | Scope                                                                                                                                                                                                                  | ADR        | Depends on                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| **`@caisson/pricebook`**                  | New base pkg: `stripePriceId → creditsPerCycle` (plan-book) + `codegenRunCredits` (action-book) + `centsToCredits` reusing ai-meter's `microUsdPerCredit`. Integer units.                                              | 0089/0095  | — (numbers deferred; ship the mechanism with placeholder/config) |
| **`services/license`**                    | Build the empty scaffold: Ed25519 license issuer + MoR Stripe `invoice.paid` webhook (HMAC raw-body) → **idempotent credit grant** (on the Stripe invoice id) via the cycle→grant mapper (**annual** cycle, ADR-0095). | 0089/0009  | `@caisson/pricebook`                                             |
| **Entitlement-on-purchase resolver**      | Wire the ADR-0071 registry-derived entitlement expansion (edition/bundle → member-module slug set) into the purchase/license flow + the entitlement store.                                                             | 0071/0076  | `services/license`                                               |
| **Registry Worker entitlement filtering** | The LIVE worker serves the static index unfiltered; add per-account entitlement filtering (the one genuine code loose end).                                                                                            | 0047       | the resolver                                                     |
| **MCP per-account rate-limit (T21b)**     | PG token-bucket alongside the entitlement store; `debit-before-spend` stays the primary control.                                                                                                                       | board (P6) | the entitlement store                                            |
| **Buyer dashboard + seller cockpit**      | Entitlements, credit balance, license key, `.npmrc` token (buyer); sales/grants/registry state (seller).                                                                                                               | 0009       | the commerce backend                                             |

### Bucket C — P6 support + docs

| Item                       | Scope                                                                                                                       | ADR  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| **`services/support-bot`** | Discord bot + Python LLM dispatch + codebase RAG + hosted inference on cloud runners.                                       | 0009 |
| **`services/docs`**        | **Standalone** AI-native docs service (separate from `apps/site` Fumadocs) feeding the bot RAG + buyer agents + `llms.txt`. | 0096 |

### Bucket D — publish-readiness (for GA)

| Item                         | Scope                                                                                                                                                                                                                           | ADR        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Publishability flip**      | 24 pkgs private→public publish (today all private + dry-run); resolve `@caisson/registry` coherence + the changeset/T3 gate as one readiness pass; **set per-pkg license correctly (Apache-2 base / commercial editions, W1).** | 0092/board |
| **`create-caisson` npx bin** | `bin → ./dist/cli.js` + `#!/usr/bin/env node` + tsc-emit build step; smoke `npx create-caisson` against the packed tarball.                                                                                                     | 0092       |
| **Registry index backfill**  | Publish the base + compliance/local-ai modules (only 7 of ~24 in the live index today) through the gated flow.                                                                                                                  | 0069       |

### Bucket E — GTM/product

| Item                                | Scope                                                                                                          | ADR  | Note                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| **W3 Free EU-AI-Act sample**        | A minimal `create-caisson`-emitted EU-AI-Act evidence-path sample (WORM + hash-chain + signed pack), Apache-2. | 0095 | rides the open Base                                        |
| **W4 Enterprise "Contact us" tier** | `apps/site` SKU-surface addition (CTA, no price).                                                              | 0095 | **coordinate with the design track** (touches `apps/site`) |

### Bucket F — live-test readiness (W8, operator supplies creds)

Make the by-design seams flip-ready + write a **runbook**: Stripe live checkout + webhook (needs the
X-2 code from Bucket B first) · Compliance-edition-live (Neon + better-auth + field-crypto secrets) ·
S3 Object-Lock WORM · local-ai ONNX + hosted inference. Document exact env, command, expected result
per seam; note what's still un-built (e.g. `awsKmsClient()` body, live MCP transport). The operator
provisions accounts; the code + runbook are ready for the flip.

## Recommended sequence

**A (fast-follows) → B (commerce spine) → D (publish-readiness) → C (support/docs) → E/F.** A is small
and unblocks nothing-blocked; B is the value (real checkout); D gates GA; C/E/F follow. Each item is its
own atomic PR with goal-backward VERIFY. (If the operator picks this track _second_, A can still run
in parallel with the design track as disjoint fast-follows.)

## Locked — no forks here

Every item is ADR-locked (0089–0096 + founding). The only operator-owned remainders are **deferred by
decision**: exact pricing numbers + grandfathering (P6/checkout, ADR-0095) and the CF Access go-live
flip (a launch act). Do not relitigate.

## Exit criteria

Per-item: atomic PR, green `bun run check` + the conditional audits (security/billing/external-system/
infra per tag), goal-backward VERIFY against the item's spec. Track-level: a real purchase grants
access + license + annual credit cycle; the registry serves an entitlement-filtered index; the base is
Apache-2 + the gate enforces the boundary; the seams have a flip-ready runbook.
