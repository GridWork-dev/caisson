// @caisson-sh/demo-registry — public surface. Private/unpublished: apps/admin's catalog consumes this
// now; apps/site's `/ui` gallery repoints to it later (a separate, out-of-scope wiring change).
export {
  licenseTierSchema,
  catalogEntryMetaSchema,
  LICENSE_TIERS,
} from "./schema.ts";
export type { LicenseTier, CatalogEntryMeta, CatalogEntry } from "./schema.ts";
export { CATALOG_ENTRIES, entriesByTier, listPackages } from "./registry.ts";
