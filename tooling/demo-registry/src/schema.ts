// @caisson-sh/demo-registry — the Zod-typed entry contract. Validated at module load
// (see registry.ts) so a typo'd id/tier/duplicate entry fails fast in `bun test`, not silently in
// the admin UI. This schema covers the DESCRIPTIVE metadata only (id/name/package/tier/description/
// variant labels) — the live `render()` closure is a runtime-only field (a React element factory has
// no meaningful Zod shape) composed alongside it in registry.ts's `CatalogEntry`.
import type { ReactNode } from "react";
import { z } from "zod";

/** The three license tiers this catalog spans. */
export const LICENSE_TIERS = [
  "apache-base",
  "ui-pro",
  "per-package-ui",
] as const;
export const licenseTierSchema = z.enum(LICENSE_TIERS);
export type LicenseTier = z.infer<typeof licenseTierSchema>;

export const catalogEntryMetaSchema = z
  .object({
    /** Stable id, "<pkg-slug>.<component-kebab>" (e.g. "ui.button", "ui-pro.data-table-pro"). */
    id: z.string().min(1),
    /** Display name (e.g. "Button"). */
    name: z.string().min(1),
    /** The owning package, e.g. "@caisson-sh/ui". */
    package: z.string().min(1),
    tier: licenseTierSchema,
    description: z.string().min(1),
    /** Labels for the prop/state variants the live demo renders together (informational — the
     *  demo itself lays them out; this is not a click-to-switch index). */
    variants: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CatalogEntryMeta = z.infer<typeof catalogEntryMetaSchema>;

/** A registry entry: the Zod-validated metadata plus the runtime-only demo pieces. `render` is
 *  OPTIONAL — omitted for the rare entry where a live render isn't cheap/safe to construct
 *  standalone (e.g. would need a real tenant DB connection); the catalog then falls back to
 *  `description` + `sampleProps`. Defined here (not registry.ts) so the per-tier entry files can
 *  import it without a circular dependency on the registry that composes them. */
export interface CatalogEntry extends CatalogEntryMeta {
  /** A representative sample props/data object — documentation + a fallback when `render` is
   *  omitted. Free-form (each component's prop shape is its own), so this is intentionally
   *  `Record<string, unknown>` rather than re-deriving 51 component prop unions here. */
  sampleProps?: Record<string, unknown>;
  /** The live demo. */
  render?: () => ReactNode;
}
