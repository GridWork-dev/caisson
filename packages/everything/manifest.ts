// Registry manifest (ADR-0020/0021/0257/0258). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the Everything bundle (ADR-0257),
// the whole commercial catalog in one purchase. `bundle` (the legacy ADR-0012 "buy everything"
// sentinel) aliases to `everything` at the single resolve-time alias point.
//
// EXPLICIT FULL-CATALOG RULE (ADR-0258 §3): this `members` map IS the full-catalog rule that replaces
// the derived `fullCatalogMembers()` scan in @caisson/registry-schema. Content = every sellable
// commercial SKU including @caisson/ui-pro; the open Apache base ships free via the registry Worker's
// free-view floor (union), so it is deliberately NOT re-listed here. Three commercial packages are
// EXCLUDED by rule: @caisson/brand (private, never sold — the license-issue-pattern brand kit),
// @caisson/license-issue (private — the issuer signing key must never reach a buyer tarball, ADR-0110),
// and @caisson/audit-harness (private, seller-internal, no manifest — never published, so a member pin
// to it could never resolve against the ledger).
// @caisson/ui-pro is IN and pinned at its real published version since its first publish (0.1.0,
// 2026-07-07 — the 0.0.0 pre-publish sentinel is history). `priceCents: 205900` is the locked bundle
// price ($2,059, ADR-0258 §3: 0.75 * Sum(personas), below-sum); positive integer (ADR-0007). A bundle
// carries no composition code, so `dependencies` is empty and this map is the sole membership truth.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/everything",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 205900,
  license: pkg.license,
  // The explicit full-catalog membership (ADR-0258 §3): the bundle self + every sellable commercial
  // SKU + ui-pro, every pin a real published version.
  members: {
    "@caisson/everything": "0.2.2",
    "@caisson/agent-dev": "0.4.0",
    "@caisson/agent-kernel": "0.4.0",
    "@caisson/agent-runner": "0.1.4",
    // The four sibling persona-bundle metas are themselves sellable SKUs and are IN — the
    // description sells them by name, and an Everything buyer must be entitled to install them.
    "@caisson/agentic-dev": "0.2.1",
    "@caisson/ai-evals": "0.3.1",
    "@caisson/ai-kit": "0.4.0",
    "@caisson/ai-meter": "0.3.4",
    "@caisson/ai-production": "0.2.1",
    "@caisson/alerting": "0.1.5",
    "@caisson/audit-worm": "0.3.0",
    "@caisson/billing-orchestration": "0.2.1",
    "@caisson/compliance": "0.5.0",
    "@caisson/compliance-core": "0.2.1",
    "@caisson/credits": "0.4.1",
    "@caisson/field-crypto": "0.3.0",
    "@caisson/frameworks-pack": "0.2.0",
    "@caisson/guardrails": "0.4.2",
    "@caisson/local-ai": "0.2.5",
    "@caisson/local-first": "0.2.1",
    "@caisson/local-inference": "0.1.1",
    "@caisson/local-privacy": "0.1.1",
    "@caisson/local-store": "0.2.4",
    "@caisson/local-sync": "0.1.1",
    "@caisson/org-controls": "0.2.1",
    "@caisson/platform-reads": "0.1.6",
    "@caisson/pricebook": "0.5.0",
    "@caisson/prompt-registry": "0.2.5",
    "@caisson/provenance": "0.2.1",
    "@caisson/retention-runner": "0.1.6",
    "@caisson/signing-primitive": "0.2.0",
    "@caisson/tool-exec": "0.1.5",
    "@caisson/ui-pro": "0.1.0",
  },
  description:
    "Everything bundle: the whole Caisson commercial catalog in one purchase — Compliance, AI-Production, Local-first, Agentic-Dev, and Provenance plus every standalone module (org-controls, billing-orchestration, ui-pro), at a below-sum price. The open Apache base ships free.",
});
