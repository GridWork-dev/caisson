// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "primitive"` — @caisson/agent-trajectory is the
// engine-neutral trajectory contract (append-only run/step/tool/usage event log + deterministic
// projection), a governed observation substrate, not a base service or an edition. A primitive does
// not self-declare edition membership; a bundle adds it to its `members` pin map at integration,
// exactly like tool-exec.
//
// Commercial under open-core (ADR-0094/0097): the runtime observation layer is NOT among the
// enumerated open Base packages, so it ships LicenseRef-Caisson-Commercial and the license<->tier
// rule forces `paid`. `priceCents` mirrors the pre-launch placeholder anchor (4900) the other
// commercial primitives carry; FINAL pricing is the still-open Pricing fork (SD-6/ADR-0012), out of
// scope here — it need only be a positive integer (ADR-0007). Deps are DOWN-ONLY (ADR-0003):
// @caisson/kernel (parseStrict + the typed error model), @caisson/tenancy-rls (S3, ADR-0360 U-3 —
// the PG-backed TrajectoryStore/RunStateStore need it at RUNTIME: each `append`/CAS call opens its
// own short-lived `withTenant` transaction; see store.pg.ts's file header for why a pre-scoped
// executor deadlocks PGlite across a long-lived run), and @caisson/field-crypto (S5, ADR-0361 — the
// encRef wrap of `parked_state`: field-crypto is a Base-kernel-only primitive itself, so this stays
// a lateral primitive→primitive dependency, never "up", exactly like tenancy-rls and precedented by
// ai-meter/ai-kit's own field-crypto deps). `golden: null` — the package emits no golden-able
// artifact; its teeth are the schema/append-only/replay/CAS/encrypted-at-rest tests.
//
// PUBLISH (S5, ADR-0361/0362): `sellable: false` is REMOVED here — the encRef wrap of `parked_state`
// (this same slice) was the named precondition (ADR-0361) blocking sale, so the package is sellable
// as of this version. It carries NO standalone SKU (bundle-only, the identical treatment already
// given to sibling primitives `agent-kernel`/`agent-runner`, also `priceCents: 4900`) — but it is
// deliberately NOT yet added to `packages/agentic-dev/manifest.ts`'s `members` map. `foldEditionMembers`
// (`packages/cli/src/meter.ts`) writes member pins VERBATIM into a buyer's generated scaffold, so a
// member pin must name the wrap-bearing sellable version specifically, not merely a real published
// one — this version isn't ledgered yet, and pinning the prior "0.2.0" would ship the pre-encRef,
// plaintext-parked_state tarball. Bundle membership rides a small post-consume follow-up pinned at
// the then-published, encRef-bearing version (ride-after-consume discipline). `priceCents` stays
// UNCHANGED at the placeholder anchor: `checkPriceCoverage` (`tooling/standards-gate`) exempts any
// module still at exactly this anchor from needing a PRICE_AUTHORITY row, so this is not a
// locked/new price — no number was invented for this slice; FINAL per-module pricing remains the
// same still-open Pricing fork noted above.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-trajectory",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: [
    "@caisson/field-crypto",
    "@caisson/kernel",
    "@caisson/tenancy-rls",
  ],
  golden: null,
  description:
    "Engine-neutral trajectory contract: an append-only, replayable event log (runs, steps, model calls, tool proposals/approvals, usage, checkpoints) with digest-ref payload discipline (sensitive bodies referenced by sha256 digest, never inlined) and a deterministic projection over shuffled arrival.",
});
