// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the credits wallet is a base service primitive
// shared across all editions that meter usage. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/credits",
  version: "0.0.0",
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: "Apache-2.0",
  dependencies: [
    "@caisson/kernel",
    "@caisson/registry-schema",
    "@caisson/tenancy-rls",
  ],
  description:
    "Integer credit wallet + append-only ledger + debit-before-spend gate (402, idempotent) — the metering floor for every edition (ADR-0007/0020).",
});
