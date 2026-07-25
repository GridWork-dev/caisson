// Registry manifest (ADR-0020). Loaded by the monorepo's build-standards check; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared compliance primitive, not a base
// service or an edition (edition membership is added by the Compliance edition at integration, not
// self-declared here — mirrors field-crypto). Paid + LicenseRef-Caisson-Commercial (ADR-0135).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/alerting",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  // Standalone $149, locked by ADR-0137 and enforced through PRICE_AUTHORITY.
  priceCents: 14900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/email"],
  golden: null,
  description:
    "SOC2 CC7.2 multi-channel alerting pipeline: dedup -> rate-cap+digest -> IANA-tz quiet-hours (critical override) -> multi-channel delivery (email/webhook/Slack/Telegram) -> structured audit log.",
});
