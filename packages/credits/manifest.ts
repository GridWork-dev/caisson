// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the credits wallet is a base service primitive
// shared across all editions that meter usage. Paid + LicenseRef-Caisson-Commercial (ADR-0023/0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/credits",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [
    "@caisson/kernel",
    "@caisson/registry",
    "@caisson/tenancy-rls",
  ],
  description:
    "Integer credit wallet + append-only ledger + debit-before-spend gate (402, idempotent) — the metering floor for every edition (ADR-0007/0020).",
});
