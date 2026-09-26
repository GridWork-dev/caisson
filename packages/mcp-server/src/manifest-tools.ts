// Agent-ready design-system tools (ADR-0330/ADR-0345), registered through the SAME ADR-0216
// `registerTool` seam the coach uses, and visible to every authenticated caller:
//   - `list_components`/`describe_component`/`get_tokens` — read tools over the base kit.
//   - `check_usage` — the static doctor (`@caisson-sh/ds-manifest` `checkUsage`).
//   - `describe_pro_component` — pro component metadata, registered ONLY when a pro manifest is
//     supplied.
//
// The three read handlers are shared PURE functions (`listComponents`/`describeComponent`/
// `getTokens`) so the local stdio discovery server (`discovery-stdio.ts`) serves the exact same data
// over the base manifest — one data layer, two fronts. This module imports NOTHING from `server.ts`
// (it declares the minimal `ManifestToolRegistrar` slice it needs); `McpServer` is structurally
// assignable to it, so `server.ts` wires it one-directionally with no import cycle.
import { z } from "zod";
import { NotFoundError, parseStrict, strictObject } from "@caisson-sh/kernel";
import {
  checkUsage,
  type Component,
  type ComponentManifest,
  type ContrastFunctional,
  type ContrastTheme,
} from "@caisson-sh/ds-manifest";

/**
 * The full design-token payload `get_tokens` serves as JSON. Structurally the `@caisson-sh/ui/tokens`
 * objects (themes + functional + fonts) — NOT a third bespoke format (SPEC/plan P11): when the DTCG
 * `tokens.json` export lands this swaps its serializer to that shape. Keyed by the same structural
 * theme/functional types the contrast checker uses, so `@caisson-sh/ui`'s real tokens assign directly.
 */
export interface DesignTokens {
  themes: { dark: ContrastTheme; light: ContrastTheme };
  functional: { dark: ContrastFunctional; light: ContrastFunctional };
  fonts: { sans: string; mono: string };
}

/**
 * The minimal slice of the ADR-0216 server seam these tools drive — just tool registration.
 * `McpServer` (from `server.ts`) is structurally assignable to this, so this module never imports
 * the server (no dependency cycle). Authentication is the seam's job, so a handler ctx is `{ args }`.
 */
export interface ManifestToolRegistrar {
  registerTool(registration: {
    name: string;
    description: string;
    version: string;
    audit: { logArgs: boolean };
    handler: (ctx: { args: unknown }) => Promise<unknown>;
  }): void;
  /** The resource-registration half of the seam. `McpServer` is structurally assignable to this —
   *  a resource handler needs neither session nor args here (these read handlers are pure over the
   *  manifest). */
  registerResource(registration: {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    handler: () => Promise<unknown>;
  }): void;
}

export interface ManifestToolsOptions {
  /** The committed base component manifest (`@caisson-sh/ds-manifest` `loadBaseManifest()`). */
  readonly baseManifest: ComponentManifest;
  /** The design tokens `get_tokens` serves (the `@caisson-sh/ui/tokens` objects). */
  readonly tokens: DesignTokens;
  /** The pro component manifest. When present, `describe_pro_component` is registered. */
  readonly proManifest?: ComponentManifest;
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
 * Register the design-system tools on `server` through the ADR-0216 seam: the three base read
 * tools, `check_usage`, and — only when `options.proManifest` is supplied —
 * `describe_pro_component`. Every one is visible to every authenticated caller.
 */
export function registerManifestTools(
  server: ManifestToolRegistrar,
  options: ManifestToolsOptions,
): void {
  server.registerTool({
    name: "list_components",
    description:
      "List the open @caisson-sh/ui components (name, one-line summary, typed variant props).",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async () => listComponents(options.baseManifest),
  });

  server.registerTool({
    name: "describe_component",
    description:
      "Full metadata for one open @caisson-sh/ui component: props, variants, token deps, a11y + recipe notes.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ args }) => {
      const { name } = parseStrict(describeArgs, args);
      return describeComponent(options.baseManifest, name);
    },
  });

  server.registerTool({
    name: "get_tokens",
    description:
      "The kit's design tokens (themes, functional colours, fonts) as JSON for agent theming.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async () => getTokens(options.tokens),
  });

  server.registerTool({
    name: "check_usage",
    description:
      "Static doctor: check source against the kit for unknown imports, token misuse, invalid variants, aria gaps, version skew, and contrast.",
    version: "1.0.0",
    // Source is not a secret, but it is the caller's private code — do not log it verbatim.
    audit: { logArgs: false },
    handler: async ({ args }) => ({
      findings: checkUsage(options.baseManifest, args),
    }),
  });

  if (options.proManifest !== undefined) {
    const proManifest = options.proManifest;
    server.registerTool({
      name: "describe_pro_component",
      description: "Full metadata for one @caisson-sh/ui-pro component.",
      version: "1.0.0",
      audit: { logArgs: true },
      handler: async ({ args }) => {
        const { name } = parseStrict(describeArgs, args);
        return describeComponent(proManifest, name);
      },
    });
  }

  // --- Design-system RESOURCES: an additional protocol front over the SAME pure read
  //     functions the tools use — one data layer, two fronts. Few stable URIs, not one-per-component
  //     dynamic ones. ---

  server.registerResource({
    uri: "caisson://design-system/components",
    name: "Design-system components",
    description:
      "The open @caisson-sh/ui component roster (names, summaries, typed variant props) as JSON.",
    mimeType: "application/json",
    handler: async () => listComponents(options.baseManifest),
  });

  server.registerResource({
    uri: "caisson://design-system/tokens",
    name: "Design-system tokens",
    description:
      "The @caisson-sh/ui design tokens (themes, functional colours, fonts) as JSON for agent theming.",
    mimeType: "application/json",
    handler: async () => getTokens(options.tokens),
  });

  if (options.proManifest !== undefined) {
    const proManifest = options.proManifest;
    server.registerResource({
      uri: "caisson://design-system/pro-components",
      name: "Pro design-system components",
      description: "The @caisson-sh/ui-pro component roster as JSON.",
      mimeType: "application/json",
      handler: async () => listComponents(proManifest),
    });
  }
}
