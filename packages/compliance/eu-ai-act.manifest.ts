// Registry manifest for the EU AI Act framework primitive (ADR-0057). The high-risk system
// obligations control pack (clean-room, own-authored — Title III Chapters 2-3, crosswalked to the
// regulation's article identifiers) lives in `src/frameworks/eu-ai-act.ts`, golden-pinned alongside
// the SOC2-TSC/HIPAA-Security packs in the package's one `src/__golden__` dir (T18); this file is
// the registry-side declaration of that same module.
//
// It is a `primitive` content pack scoped to the Compliance edition (`editions: ["compliance"]`,
// composed DOWN by the edition, never depending "up" on it, ADR-0003), so it carries no runtime
// dependencies of its own. `priceCents` stays a placeholder (the schema requires a positive integer
// for any paid module, ADR-0007) pending the open Pricing lock (ADR-0012). NO SCF ingest of any
// kind (TM-J): the catalog is clean-room own-authored, never an external-catalog transform.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/eu-ai-act",
  version: "0.0.0",
  kind: "primitive",
  editions: ["compliance"],
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [],
  golden: "src/__golden__",
  description:
    "EU AI Act high-risk system obligations coverage pack (Regulation (EU) 2024/1689, Title III Chapters 2-3): own-authored canonical controls for risk management, data governance, technical documentation, transparency, human oversight, accuracy/robustness/cybersecurity, and the provider's quality-management, conformity-assessment, registration, post-market-monitoring, and incident-reporting duties — crosswalked to the regulation's article identifiers (ADR-0057, clean-room).",
});
