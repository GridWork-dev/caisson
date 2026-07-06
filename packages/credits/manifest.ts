// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the credits wallet is a base service primitive
// shared across all editions that meter usage. Commercial since ADR-0249 G5 (decouple-then-flip):
// the cli's codegen debit is an injected port, so credits left the open Base set and sells at $149
// (ADR-0252). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/credits",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 14900,
  license: pkg.license,
  dependencies: [
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/registry-schema",
    "@caisson/tenancy-rls",
  ],
  description:
    "Integer credit wallet + append-only ledger + debit-before-spend gate (402, idempotent) — the metering floor for every edition (ADR-0007/0020).",
});
