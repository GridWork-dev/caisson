// Registry manifest (ADR-0020/0021/0257). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the Local-first persona bundle
// (ADR-0257), the new-vocabulary successor to the legacy `local-ai` edition (which stays valid forever;
// `local-ai` aliases to `local-first`). A bundle carries NO composition code — only the frozen
// `members` pin map (ADR-0077/0071) — so `dependencies` stays empty. Members = the local-ai edition's
// modules including the full 3-way carve (@caisson/local-sync / @caisson/local-inference /
// @caisson/local-privacy, ADR-0258 §1). `priceCents: 62900` is the locked bundle price ($629, ADR-0258
// §1: 0.75 * 845 sum, below-sum); positive integer (ADR-0007). The pre-publish carve pins carry the
// dev-sentinel version their source packages hold; the members-fold republish resolves them.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-first",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 62900,
  license: pkg.license,
  members: {
    "@caisson/local-first": "0.2.1",
    "@caisson/kernel": "0.4.2",
    "@caisson/local-store": "0.2.4",
    "@caisson/license-verify": "0.3.0",
    "@caisson/field-crypto": "0.3.0",
    "@caisson/local-privacy": "0.1.1",
    "@caisson/local-inference": "0.1.1",
    "@caisson/local-sync": "0.1.1",
  },
  description:
    "Local-first bundle: @caisson/local-store hybrid retrieval (sqlite-vec + FTS5 RRF), @caisson/local-sync two-way sync, @caisson/local-inference on-device inference, @caisson/local-privacy zero-egress gate, @caisson/license-verify offline Ed25519, and @caisson/field-crypto at-rest — offline, file-per-tenant, no lock-in.",
});
