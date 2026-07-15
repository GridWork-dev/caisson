// Agent-ready design-system tools (ADR-0330/ADR-0345), registered through the SAME ADR-0216
// `registerTool` seam the coach uses. Three BASE read tools (`list_components`/`describe_component`/
// `get_tokens`, `requiredEntitlement: null`) let any authenticated buyer discover the open kit; two
// GATED tools ride the runtime-entitlement gate the seam already enforces timing-safe:
//   - `check_usage` — the static doctor (`@caisson/ds-manifest` `checkUsage`), gated on a DEDICATED
//     doctor/verify entitlement slug so the verify capability sells independently of any component
//     edition (ADR-0345 Fork F lock).
//   - `describe_pro_component` — pro-tier component metadata, registered ONLY when a pro manifest is
//     supplied and gated on the pro-component entitlement, so an unentitled caller gets the seam's
//     invisible 404, never a partial pro-shaped response (SPEC entitlement boundary, CR-09).
//
// The three read handlers are shared PURE functions (`listComponents`/`describeComponent`/
// `getTokens`) so the local stdio discovery server (`discovery-stdio.ts`) serves the exact same data
// over the base manifest — one data layer, two fronts. This module imports NOTHING from `server.ts`
// (it declares the minimal `ManifestToolRegistrar` slice it needs); `McpServer` is structurally
// assignable to it, so `server.ts` wires it one-directionally with no import cycle.
import { z } from "zod";
import { NotFoundError, parseStrict, strictObject } from "@caisson/kernel";
import {
  checkUsage,
  type Component,
  type ComponentManifest,
  type ContrastFunctional,
  type ContrastTheme,
} from "@caisson/ds-manifest";

/** The dedicated doctor/verify entitlement slug (ADR-0345). Overridable via options so the operator
 *  can map it to whatever sellable SKU pricing lands on — the doctor gates on THIS, not an edition. */
export const DEFAULT_DOCTOR_ENTITLEMENT = "ds-doctor";
/** The real commercial pro surface's slug (`@caisson/ui-pro`, ADR-0259) — the gate for pro metadata. */
export const DEFAULT_PRO_ENTITLEMENT = "@caisson/ui-pro";

/**
 * The full design-token payload `get_tokens` serves as JSON. Structurally the `@caisson/ui/tokens`
 * objects (themes + functional + fonts) — NOT a third bespoke format (SPEC/plan P11): when the DTCG
 * `tokens.json` export lands this swaps its serializer to that shape. Keyed by the same structural
 * theme/functional types the contrast checker uses, so `@caisson/ui`'s real tokens assign directly.
 */
export interface DesignTokens {
  themes: { dark: ContrastTheme; light: ContrastTheme };
  functional: { dark: ContrastFunctional; light: ContrastFunctional };
  fonts: { sans: string; mono: string };
}

/**
 * The minimal slice of the ADR-0216 server seam these tools drive — just tool registration.
 * `McpServer` (from `server.ts`) is structurally assignable to this, so this module never imports
 * the server (no dependency cycle). Entitlement gating is the seam's job, so a handler ctx is `{ args }`.
 */
export interface ManifestToolRegistrar {
  registerTool(registration: {
    name: string;
    requiredEntitlement: string | null;
    description: string;
    version: string;
    audit: { logArgs: boolean };
    handler: (ctx: { args: unknown }) => Promise<unknown>;
  }): void;
}

export interface ManifestToolsOptions {
  /** The committed Apache-base component manifest (`@caisson/ds-manifest` `loadBaseManifest()`). */
  readonly baseManifest: ComponentManifest;
  /** The design tokens `get_tokens` serves (the `@caisson/ui/tokens` objects). */
  readonly tokens: DesignTokens;
  /** Slug gating `check_usage`. Default `"ds-doctor"` (ADR-0345 — a dedicated doctor slug). */
  readonly doctorEntitlement?: string;
  /** The pro component manifest. When present, `describe_pro_component` is registered (gated). */
  readonly proManifest?: ComponentManifest;
  /** Slug gating `describe_pro_component`. Default `"@caisson/ui-pro"`. */
  readonly proEntitlement?: string;
}

// --- shared pure read handlers (also used by the local stdio discovery server) ---------------

/** The component roster: name + one-liner + which props carry typed variants + the data-* flag. */
export function listComponents(manifest: ComponentManifest): {
  pkg: string;
  version: string;
  schemaVersion: number;
  components: {
    name: string;
    summary: string;
    variantProps: string[];
    hasDataStar: boolean;
  }[];
} {
  return {
    pkg: manifest.generatedFor.pkg,
    version: manifest.generatedFor.version,
    schemaVersion: manifest.schemaVersion,
    components: manifest.components.map((c) => ({
      name: c.name,
      summary: c.summary,
      variantProps: Object.keys(c.variants).sort(),
      hasDataStar: c.hasDataStar,
    })),
  };
}

/** One component's full metadata by name (case-insensitive). Throws `NotFoundError` if the name is
 *  not in `manifest` — for the discovery server pinned to the base manifest, that is the entire
 *  strict-subset guarantee: a name it does not hold (e.g. a pro component) is simply unknown. */
export function describeComponent(
  manifest: ComponentManifest,
  name: string,
): Component {
  const found = manifest.components.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (found === undefined) {
    throw new NotFoundError(`Unknown component: ${name}`);
  }
  return found;
}

/** The design tokens as JSON, flagged provisional pending the DTCG `tokens.json` export (plan P11). */
export function getTokens(
  tokens: DesignTokens,
): DesignTokens & { note: string } {
  return {
    ...tokens,
    note: "Provisional token export; migrates to the DTCG tokens.json shape when that export lands.",
  };
}

const describeArgs = strictObject({ name: z.string().min(1).max(128) });

/**
 * Register the design-system tools on `server` through the ADR-0216 seam. The three base read tools
 * are visible to every authenticated buyer; `check_usage` is gated on the doctor slug; and — only
 * when `options.proManifest` is supplied — `describe_pro_component` is gated on the pro slug. Each
 * gated tool is invisible (404) to a caller lacking its entitlement (the seam's constant-time gate).
 */
export function registerManifestTools(
  server: ManifestToolRegistrar,
  options: ManifestToolsOptions,
): void {
  const doctorEntitlement =
    options.doctorEntitlement ?? DEFAULT_DOCTOR_ENTITLEMENT;
  const proEntitlement = options.proEntitlement ?? DEFAULT_PRO_ENTITLEMENT;

  server.registerTool({
    name: "list_components",
    requiredEntitlement: null,
    description:
      "List the open @caisson/ui components (name, one-line summary, typed variant props).",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async () => listComponents(options.baseManifest),
  });

  server.registerTool({
    name: "describe_component",
    requiredEntitlement: null,
    description:
      "Full metadata for one open @caisson/ui component: props, variants, token deps, a11y + recipe notes.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ args }) => {
      const { name } = parseStrict(describeArgs, args);
      return describeComponent(options.baseManifest, name);
    },
  });

  server.registerTool({
    name: "get_tokens",
    requiredEntitlement: null,
    description:
      "The kit's design tokens (themes, functional colours, fonts) as JSON for agent theming.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async () => getTokens(options.tokens),
  });

  server.registerTool({
    name: "check_usage",
    requiredEntitlement: doctorEntitlement,
    description:
      "Static doctor: check buyer source against the kit for unknown imports, token misuse, invalid variants, aria gaps, version skew, and contrast.",
    version: "1.0.0",
    // Buyer source is not a secret, but it is the buyer's private code — do not log it verbatim.
    audit: { logArgs: false },
    handler: async ({ args }) => ({
      findings: checkUsage(options.baseManifest, args),
    }),
  });

  if (options.proManifest !== undefined) {
    const proManifest = options.proManifest;
    server.registerTool({
      name: "describe_pro_component",
      requiredEntitlement: proEntitlement,
      description:
        "Full metadata for one @caisson/ui-pro component. Entitlement-gated — invisible to callers without the pro tier.",
      version: "1.0.0",
      audit: { logArgs: true },
      handler: async ({ args }) => {
        const { name } = parseStrict(describeArgs, args);
        return describeComponent(proManifest, name);
      },
    });
  }
}
