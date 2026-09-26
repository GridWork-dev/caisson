// The pure addressing half of the registry (ADR-0061): the slug vocabulary every registry input
// bounds its fields with, plus `name@selector` parsing. It lives apart from registry.ts for one
// structural reason — registry.ts value-imports `./schema.ts`, whose `buildTenantPolicySql` edge
// pulls `@caisson-sh/tenancy-rls` and the `pg` driver into the module graph. Nothing here reaches a
// database, a driver, or a Node builtin, so this module (and render.ts) is what the `./browser`
// entry is made of (ADR-0396).
//
// Names and behaviour are unchanged by the extraction: registry.ts imports the field schemas and
// the parser from here, so there is exactly one slug definition and exactly one parser.
import { parseStrict } from "@caisson-sh/kernel";
import { z } from "zod";

/** A prompt name / alias slug — bounded, lowercase, no `@` (the addressing delimiter). */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** The account field on every registry input (bounded for the row's own column + readable errors). */
export const accountId = z.string().min(1).max(200);

/** A prompt name or alias field. */
export const slug = z.string().regex(SLUG_RE).max(128);

/** A parsed prompt reference: `name` (current), `name@<n>` (version), or `name@<alias>`. */
export type PromptRef =
  | { readonly name: string; readonly kind: "current" }
  | {
      readonly name: string;
      readonly kind: "version";
      readonly version: number;
    }
  | { readonly name: string; readonly kind: "alias"; readonly alias: string };

/**
 * Parse a `name@selector` reference. No `@` resolves the current tip; a numeric selector is a
 * version; anything else is an alias. The name + selector are slug-bounded (no injection surface).
 */
export function parsePromptRef(ref: string): PromptRef {
  const at = ref.indexOf("@");
  const name = at === -1 ? ref : ref.slice(0, at);
  parseStrict(slug, name);
  if (at === -1) return { name, kind: "current" };
  const selector = ref.slice(at + 1);
  if (/^[0-9]+$/.test(selector)) {
    return { name, kind: "version", version: Number.parseInt(selector, 10) };
  }
  parseStrict(slug, selector);
  return { name, kind: "alias", alias: selector };
}
