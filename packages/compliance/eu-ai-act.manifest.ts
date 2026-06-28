// Registry manifest for the RESERVED EU AI Act framework slot (ADR-0057). A NAMED SLOT module: it
// reserves the `@caisson/eu-ai-act` module id and records that the slot exists, but ships NO control
// content yet — `golden: null` (no catalog fixture) because there is nothing golden-able until the
// high-risk obligations are authored as canonical controls in a later task. The framework reservation
// itself (Annex IV outline, clean-room note) lives in `src/frameworks/eu-ai-act.ts`; this file is the
// registry-side declaration of the same reservation.
//
// It is a `primitive` content pack scoped to the Compliance edition (`editions: ["compliance"]`,
// composed DOWN by the edition, never depending "up" on it, ADR-0003), so it carries no dependencies
// while it is empty. `priceCents` is a forced placeholder (the schema requires a positive integer for
// any paid module, ADR-0007) — repriced when content is authored and the open Pricing lock (ADR-0012)
// closes. NO SCF ingest of any kind (TM-J): content is clean-room own-authored when the slot fills.
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
  golden: null,
  description:
    "RESERVED slot for the EU AI Act high-risk system obligations (Annex IV) — named and reserved, no authored control content or catalog golden yet (ADR-0057). Filled clean-room in a later task; never an SCF ingest.",
});
