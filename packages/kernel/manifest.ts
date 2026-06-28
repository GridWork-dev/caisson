// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the governance kernel is the zero-dependency
// foundation; every other base and edition package depends on it. Paid + LicenseRef-Caisson-Commercial
// (ADR-0023/0050).
//
// `priceCents` is a PLACEHOLDER pending the still-open Pricing lock (ADR-0012 anchors only) — it must
// be a positive integer (ADR-0007), not a final number. `dependencies: []` — kernel has no @caisson/*
// workspace runtime dependencies (the only external dep is `zod`). DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/kernel",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [],
  description:
    "Governance kernel: typed config loader, CaissonError hierarchy (ADR-0019), security primitives (timingSafeEqual/randomUUID), and the standards gate (ADR-0016).",
});
