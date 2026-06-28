// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the typed token floor is a base design primitive
// with no @caisson/* runtime dependencies. Paid + LicenseRef-Caisson-Commercial (ADR-0023/0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/ui",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [],
  description:
    "Typed OKLCH token floor (ADR-0042 design foundation: palette + type scale) — OKLCH token objects → generated tokens.css (Wardfile gen-script pattern).",
});
