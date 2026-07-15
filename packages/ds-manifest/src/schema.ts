/**
 * Component-manifest schema — the typed shape a design-system kit's build-time generator emits
 * and every consumer (CLI, MCP tools, the local discovery server) reads back. `.strict()` at every
 * level so an unrecognized field fails loudly instead of silently passing through to a caller that
 * expected a known shape.
 */
import { z } from "zod";

const componentPropSchema = z
  .object({
    name: z.string().min(1),
    /** A string rendering of the prop's TS type, e.g. `"primary" | "ghost"` or `boolean`. */
    type: z.string().min(1),
    optional: z.boolean(),
    /** The prop's JSDoc comment, when the source carries one. */
    doc: z.string().optional(),
  })
  .strict();

const componentSchema = z
  .object({
    name: z.string().min(1),
    /** One-line description of what the component is for. */
    summary: z.string().min(1),
    props: z.array(componentPropSchema),
    /** Prop name -> its allowed string-literal values, for props whose type is a union of string
     *  literals (e.g. a `variant`/`size` union). A prop with no such union is simply absent here. */
    variants: z.record(z.string(), z.array(z.string())),
    /** The `--cs-*` CSS custom properties the component's co-located stylesheet reads. */
    tokenDeps: z.array(z.string()),
    a11yNotes: z.array(z.string()),
    /** Which of the kit's shared component-recipe rules this component follows. */
    recipeRules: z.array(z.string()),
    /** Whether the component exposes any `data-*` variant attribute (a coverage note — the
     *  authoritative variant source is `variants` above, derived from TS prop types, not this
     *  flag: some components carry typed variants with no `data-*` attribute at all). */
    hasDataStar: z.boolean(),
  })
  .strict();

export const componentManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    /** Which package + version this manifest was generated for. */
    generatedFor: z
      .object({
        pkg: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    components: z.array(componentSchema),
  })
  .strict();

export type ComponentProp = z.infer<typeof componentPropSchema>;
export type Component = z.infer<typeof componentSchema>;
export type ComponentManifest = z.infer<typeof componentManifestSchema>;

/** Validate + parse an unknown value into a `ComponentManifest`; throws a `ZodError` on any
 *  shape mismatch, including an unrecognized field at any level (`.strict()` above). */
export function parseComponentManifest(input: unknown): ComponentManifest {
  return componentManifestSchema.parse(input);
}
