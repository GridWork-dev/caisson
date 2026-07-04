// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` (ADR-0067) — the shared sqlite-vec + FTS5 + RRF
// hybrid-retrieval primitive both the local-ai and agent-dev editions compose DOWN-ONLY (never
// imports an edition, ADR-0022 / ADR-0003). Paid + LicenseRef-Caisson-Commercial (ADR-0050).
// `priceCents` is the current pre-launch anchor (4900); final pricing is a separate, still-open
// decision. The relative import keeps `@caisson/registry` out of the runtime dep set: the sole
// declared workspace dependency is `@caisson/kernel` (sqlite-vec is the external native ext).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-store",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Local hybrid retrieval: sqlite-vec (vec0) + FTS5 + RRF (RRF_K=60) with an always-available FTS path and FTS-only degrade, plus the file-per-tenant isolation floor; embedding is an injected seam, consumed edition→base (local-ai, agent-dev).",
});
