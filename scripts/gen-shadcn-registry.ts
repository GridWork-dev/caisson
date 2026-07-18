#!/usr/bin/env bun
/**
 * gen-shadcn-registry.ts — build the shadcn registry.json for the PUBLIC mirror (Kickoff T
 * task 13 / ADR-0343). The public mirror repo (caisson-sh/caisson-oss) doubles as a shadcn
 * GitHub-source registry: `bunx shadcn@latest add caisson-sh/caisson-oss/button` copies the
 * Apache-2.0 kit component (its .tsx + co-located .css) straight into a buyer's app — the
 * discoverability funnel toward the commercial editions. The ADR-0097 license-gated registry
 * service is a DIFFERENT distribution channel and is untouched by this.
 *
 * Consumed by scripts/export-public-mirror.ts, which writes the result to the mirror root at
 * export time — generated per export, never committed, so it can never drift from the source
 * tree it describes (same posture as MIRROR-MANIFEST.json).
 *
 * Item derivation (mirrors the DS-surface plan's rule: the BARREL is the authoritative set):
 *   - components = the value exports of packages/ui/src/components/index.ts;
 *   - each item's files = the component module + a sibling-import closure (non-barrel sibling
 *     modules fold INTO the item's files; barrel siblings become registryDependencies) + every
 *     co-located .css of a file in that closure;
 *   - every item depends on the `caisson-tokens` theme item — copied components read only
 *     `var(--cs-*)` custom properties (the recipe, ADR-0099), so without the tokens css they
 *     render unstyled;
 *   - npm deps are parsed from bare import specifiers and versioned from packages/ui's own
 *     package.json (react/react-dom excluded — peers a shadcn consumer already has);
 *   - every registry:ui file carries an explicit `@ui/<basename>` target (CAISSON-126) — without
 *     it, shadcn's default-target inference only strips the leading `packages/<pkg>/` segment and
 *     joins the rest onto the ui alias dir, landing components at
 *     `src/components/ui/src/components/<name>.tsx` instead of flat. `@ui/` is the alias
 *     placeholder shadcn resolves against the consumer's own components.json ui alias
 *     (shadcn@4.7.0+); source components live in one flat directory (readdirSync, no subdirs)
 *     so per-item basenames are structurally unique and can't collide.
 *
 * Standalone check: `bun scripts/gen-shadcn-registry.ts` prints a summary and fails loudly on
 * any broken invariant (missing file, unresolvable sibling import, implausibly small barrel).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const COMPONENTS_REL = "packages/ui/src/components";
const TOKENS_CSS_REL = "packages/ui/styles/tokens.css";
const THEME_ITEM = "caisson-tokens";

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
}

export interface ShadcnRegistry {
  $schema: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/** Value-exported component modules from the barrel, in export order (deduped). A `export
 *  type {...}` line is type-only and never mints an item. */
export function parseBarrelModules(barrelSource: string): string[] {
  const mods: string[] = [];
  for (const m of barrelSource.matchAll(
    /^export\s+\{[^}]*\}\s+from\s+"\.\/([a-z0-9-]+)";/gm,
  )) {
    const line = m[0];
    if (line.startsWith("export type")) continue;
    const mod = m[1]!;
    if (!mods.includes(mod)) mods.push(mod);
  }
  return mods;
}

/** Sibling module imports (`from "./x"`) of one component source, css excluded. */
function siblingImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/from\s+"\.\/([a-z0-9-]+)"/g)) {
    if (!out.includes(m[1]!)) out.push(m[1]!);
  }
  return out;
}

/** Bare (npm) import specifiers of one component source. */
function bareImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(
    /from\s+"(@?[a-z0-9-]+(?:\/[a-z0-9-]+)?)"/g,
  )) {
    const spec = m[1]!;
    if (!out.includes(spec)) out.push(spec);
  }
  return out;
}

export function buildShadcnRegistry(repoRoot: string): ShadcnRegistry {
  const componentsDir = join(repoRoot, COMPONENTS_REL);
  const barrelPath = join(componentsDir, "index.ts");
  const barrel = readFileSync(barrelPath, "utf8");
  const barrelMods = parseBarrelModules(barrel);
  if (barrelMods.length < 30) {
    throw new Error(
      `gen-shadcn-registry: barrel parse found only ${String(barrelMods.length)} components — parser rot or a kit restructure; refuse to emit a shrunken registry`,
    );
  }
  const barrelSet = new Set(barrelMods);
  const present = new Set(readdirSync(componentsDir));

  const uiPkg = JSON.parse(
    readFileSync(join(repoRoot, "packages/ui/package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  // Merge peers in: packages/ui declares lucide-react as a PEER dependency, and the barrel's
  // icon component (plus everything that pulls it) imports it — a dependencies-only lookup
  // dropped it from every generated item (SHIP-audit P1). react/react-dom are excluded at the
  // import-scan level, so their peer rows here are inert.
  const uiDeps: Record<string, string> = {
    ...(uiPkg.peerDependencies ?? {}),
    ...(uiPkg.dependencies ?? {}),
  };

  if (!existsSync(join(repoRoot, TOKENS_CSS_REL))) {
    throw new Error(
      `gen-shadcn-registry: ${TOKENS_CSS_REL} missing — every item depends on the tokens theme file`,
    );
  }

  const items: RegistryItem[] = [
    {
      name: THEME_ITEM,
      type: "registry:ui",
      title: "Caisson design tokens",
      description:
        "The generated --cs-* custom-property sheet every Caisson component reads (light + dark by cascade). Import it once, app-wide.",
      files: [
        {
          path: TOKENS_CSS_REL,
          type: "registry:file",
          target: "styles/caisson-tokens.css",
        },
      ],
    },
  ];

  for (const mod of barrelMods) {
    // Sibling-import closure: barrel siblings → registryDependencies; non-barrel siblings
    // (internal helpers like theme-init) → folded into this item's own files.
    const closure: string[] = [];
    const regDeps = new Set<string>([THEME_ITEM]);
    const npmDeps = new Set<string>();
    const queue = [mod];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (closure.includes(cur)) continue;
      closure.push(cur);
      const tsxName = `${cur}.tsx`;
      const tsName = `${cur}.ts`;
      const fileName = present.has(tsxName)
        ? tsxName
        : present.has(tsName)
          ? tsName
          : null;
      if (fileName === null) {
        throw new Error(
          `gen-shadcn-registry: ${mod} imports sibling "./${cur}" but neither ${tsxName} nor ${tsName} exists`,
        );
      }
      const source = readFileSync(join(componentsDir, fileName), "utf8");
      for (const sib of siblingImports(source)) {
        if (sib === cur) continue;
        if (barrelSet.has(sib) && sib !== mod) regDeps.add(sib);
        else if (!barrelSet.has(sib)) queue.push(sib);
      }
      for (const spec of bareImports(source)) {
        if (spec === "react" || spec === "react-dom") continue;
        const bare = spec.startsWith("@")
          ? spec.split("/").slice(0, 2).join("/")
          : spec.split("/")[0]!;
        const version = uiDeps[bare];
        if (version === undefined) continue;
        if (
          version.startsWith("catalog:") ||
          version.startsWith("workspace:")
        ) {
          // A bun-internal specifier is meaningless to a shadcn consumer — emitting it verbatim
          // ships a broken item, skipping it silently ships a missing dep. Fail loud; map the
          // package to a real range here when this ever fires.
          throw new Error(
            `gen-shadcn-registry: ${mod} imports "${bare}" whose packages/ui specifier is "${version}" — not emittable in a registry; map it to a concrete semver range`,
          );
        }
        npmDeps.add(`${bare}@${version}`);
      }
    }

    const files: RegistryFile[] = [];
    const seenTargets = new Set<string>();
    for (const cur of closure) {
      const tsx = present.has(`${cur}.tsx`) ? `${cur}.tsx` : `${cur}.ts`;
      const tsxTarget = `@ui/${tsx}`;
      if (seenTargets.has(tsxTarget)) {
        throw new Error(
          `gen-shadcn-registry: item "${mod}" has two files targeting ${tsxTarget} — disambiguate`,
        );
      }
      seenTargets.add(tsxTarget);
      files.push({
        path: `${COMPONENTS_REL}/${tsx}`,
        type: "registry:ui",
        target: tsxTarget,
      });
      if (present.has(`${cur}.css`)) {
        const cssTarget = `@ui/${cur}.css`;
        if (seenTargets.has(cssTarget)) {
          throw new Error(
            `gen-shadcn-registry: item "${mod}" has two files targeting ${cssTarget} — disambiguate`,
          );
        }
        seenTargets.add(cssTarget);
        files.push({
          path: `${COMPONENTS_REL}/${cur}.css`,
          type: "registry:ui",
          target: cssTarget,
        });
      }
    }

    items.push({
      name: mod,
      type: "registry:ui",
      title: mod
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      description: `Caisson ${mod} — native-first kit component (Apache-2.0 base tier); variants ride data-* attributes styled by the co-located CSS.`,
      ...(npmDeps.size > 0 ? { dependencies: [...npmDeps].sort() } : {}),
      registryDependencies: [...regDeps].sort(),
      files,
    });
  }

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "caisson",
    homepage: "https://caisson.sh",
    items,
  };
}

if (import.meta.main) {
  const registry = buildShadcnRegistry(resolve(import.meta.dir, ".."));
  const componentItems = registry.items.length - 1;
  console.log(
    `shadcn registry: ${String(componentItems)} component items + ${THEME_ITEM}`,
  );
  console.log(
    registry.items
      .map((i) => `  ${i.name} (${String(i.files.length)} files)`)
      .join("\n"),
  );
}
