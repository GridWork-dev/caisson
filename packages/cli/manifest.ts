// Registry manifest (ADR-0020). `kind: "base"` — the create-caisson generator is foundational
// tooling (it COMPOSES editions; it is not itself an edition, a compliance primitive, or a per-app
// template). Open Base under the open-core model (ADR-0094/0097 + the license-based registry gating
// ADR-0136): the generator ships with EVERY buyer's repo, so it joins the open Apache-2.0 set
// alongside @caisson/migrate + @caisson/license-verify — free `oss` tier, no `priceCents` (the
// license⟺tier rule requires oss carry no price). The open Base must resolve against open deps only
// (ADR-0094): kernel·migrate·registry-schema·jobs·tenancy-rls are all Apache-2.0. The codegen credit
// debit is an INJECTED port (GenerationDeps.debit, ADR-0249 G5) — the commercial @caisson/credits is
// a dev-only test fixture, never a runtime dep.
//
// `caisson run approve|deny|status` (ADR-0360 S3, `run.ts`) adds `@caisson/jobs` + `@caisson/tenancy-
// rls` as REAL runtime deps: the verbs talk to the buyer's own Postgres DIRECTLY (raw SQL against
// `agent_run_state`/`trajectory_event` — the PLAN-gate transport decision, never an MCP round-trip)
// rather than importing the commercial `@caisson/agent-trajectory`'s store factories, which the
// open↔commercial boundary (`checkOpenCommercialBoundary`) forbids an oss-tier package from doing.
// The SQL shapes are a deliberate, small, hand-kept mirror of agent-trajectory's canonical CAS/append
// logic (same table/column names, same semantics) — duplicated, not re-implemented from scratch, and
// covered by its own test suite so drift is caught, not silent.
import pkg from "./package.json";
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/cli",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  license: pkg.license,
  dependencies: [
    "@caisson/ds-manifest",
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/registry-schema",
    "@caisson/tenancy-rls",
  ],
  golden: "src/__golden__",
  description:
    "create-caisson generator: registry-allowlist-gated repo composition + codegen-credit debit-before-spend seam.",
});
