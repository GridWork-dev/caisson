// Injection-safe prompt templating (ADR-0061). A prompt is an ordered message array whose contents
// carry `{{name}}` placeholders; a typed `.strict()` variable schema (per prompt version) declares
// every variable. Rendering is the ONLY way untrusted input enters a prompt, so it is the security
// boundary:
//
//   1. The raw vars are validated against the version's strict schema — an unknown var is REJECTED
//      (no smuggling extra slots), a missing var FAILS, types are checked.
//   2. Substitution is SINGLE-PASS and NON-RECURSIVE: `String.replace` scans the template once and
//      never re-scans an inserted value, so a value that itself contains `{{persona}}` is not
//      re-expanded.
//   3. Each inserted value is escaped — `{`→`\{`, `}`→`\}` — so a value can never FORM or RE-OPEN a
//      placeholder for any downstream renderer, and structurally a value only fills an existing
//      message's content slot: it can never add a message or forge a role.
//
// The render contract is pinned by the golden fixture `src/__golden__/render.json` (ADR-0013).
import { z } from "zod";
import { parseStrict, ValidationError } from "@caisson-sh/kernel";

/** The chat roles a prompt message may carry. */
export const PROMPT_ROLES = ["system", "user", "assistant"] as const;
export type PromptRole = (typeof PROMPT_ROLES)[number];

/**
 * The content cap (ADR-0061 render boundary): shared by every template message AND every
 * string `rawVars` value, so one oversized variable can never defeat the template's own cap
 * by inflating the rendered output past it.
 */
export const MAX_CONTENT_LENGTH = 100_000;

/** One message in a prompt template; `content` may carry `{{name}}` placeholders. */
export const promptMessageSchema = z
  .object({
    role: z.enum(PROMPT_ROLES),
    content: z.string().max(MAX_CONTENT_LENGTH),
  })
  .strict();
export type PromptMessage = z.infer<typeof promptMessageSchema>;

/** A non-empty ordered message array — the template body of a prompt version. */
export const promptMessagesSchema = z.array(promptMessageSchema).min(1);

/** A rendered message: same shape as a template message, but with placeholders resolved. */
export type RenderedMessage = PromptMessage;

/** Scalar types a declared variable may take. All render to a string at the escaping boundary. */
export const VAR_TYPES = ["string", "number", "boolean"] as const;
export type VarType = (typeof VAR_TYPES)[number];

/** A variable name must be an identifier so it maps 1:1 to a `{{name}}` placeholder. */
export const VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A prompt version's variable declaration: a map of identifier → scalar type. Serializable (stored
 * as jsonb), and compiled to a strict Zod object by `buildVarSchema` at render time.
 */
export const varSpecSchema = z.record(
  z.string().regex(VAR_NAME_RE),
  z.enum(VAR_TYPES),
);
export type VarSpec = z.infer<typeof varSpecSchema>;

/** `{{name}}` placeholder — no internal whitespace, identifier names only (deterministic). */
const PLACEHOLDER_RE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

function zodForType(t: VarType): z.ZodTypeAny {
  switch (t) {
    case "string":
      // Bound each string var value to the same cap as template content — otherwise one
      // oversized value defeats the template's own content cap at interpolation time.
      return z.string().max(MAX_CONTENT_LENGTH);
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
  }
}

/**
 * Compile a `VarSpec` into a strict Zod object: every declared variable required, unknown variables
 * rejected. This is the typed `.strict()` schema untrusted render input is validated against.
 */
export function buildVarSchema(spec: VarSpec): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, t] of Object.entries(spec)) {
    if (!VAR_NAME_RE.test(name)) {
      throw new ValidationError("Invalid prompt variable name", { name });
    }
    shape[name] = zodForType(t);
  }
  return z.object(shape).strict();
}

/**
 * Neutralize the template delimiter in an interpolated value so it can never form or re-open a
 * `{{name}}` placeholder. Substitution is single-pass (the value is never re-scanned), so this is
 * the sole injection boundary; we escape both brace characters per the ADR-0061 render contract.
 */
function escapeValue(value: string): string {
  return value.replace(/[{}]/g, (c) => `\\${c}`);
}

/** Resolve every `{{name}}` in a template string against already-validated string vars (fail-closed). */
function renderContent(template: string, vars: Record<string, string>): string {
  const rendered = template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      // A placeholder with no bound variable is a template/schema mismatch — never emit it raw.
      throw new ValidationError("Unbound prompt variable", { name });
    }
    return escapeValue(value);
  });
  // Escaping can inflate a value (every `{`/`}` doubles), and several per-cap-bounded values can
  // still sum past the cap in one template — re-check the rendered total, not just each input.
  if (rendered.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      "Rendered prompt content exceeds the content cap",
      {
        length: rendered.length,
        max: MAX_CONTENT_LENGTH,
      },
    );
  }
  return rendered;
}

/**
 * Render a prompt template to a concrete message array. `rawVars` is validated against the version's
 * strict variable schema, each value is coerced to a string and escaped, then placeholders are
 * resolved in a single non-recursive pass. The result has exactly the template's messages and roles
 * — a variable can only fill a content slot, never add a message or forge a role.
 */
export function renderPrompt(
  messages: readonly PromptMessage[],
  spec: VarSpec,
  rawVars: unknown,
): RenderedMessage[] {
  const schema = buildVarSchema(spec);
  // zod 4 infers a raw-shape object as `Record<string, unknown>`; the schema still guarantees
  // string | number | boolean per zodForType at runtime, so the String() coercion below is total.
  const parsed: Record<string, unknown> = parseStrict(schema, rawVars);
  const stringVars: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    stringVars[name] = typeof value === "string" ? value : String(value);
  }
  return messages.map((m) => ({
    role: m.role,
    content: renderContent(m.content, stringVars),
  }));
}
