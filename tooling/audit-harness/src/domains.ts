// Derived audit-domain partition (ADR-0233 / SPEC audit-harness-v2, Fork A). REPLACES the hand-grown
// `AUDIT_DOMAINS` list. A DOMAIN is a WHERE — a tree partition. Every repo path belongs to exactly
// ONE domain; the WHAT (the audit lens) is the orthogonal DIMENSION axis (./dimensions.ts). Domains
// are DERIVED mechanically — one per tree unit — so "did we cover everything?" is a gate, not luck:
// see coverage-gate.test.ts.
//
// Pure derivation over the filesystem: it reads directory names + each `packages/*/package.json`
// `license` field. No model call, no dispatch (AGENTS.md boundary). `deriveDomains()` THROWS on an
// unclassifiable unit (a stray `packages/*` dir with no `package.json`) — you cannot start a run with
// an unclaimed dir, which is the v1 under-scan made structurally impossible.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Repo root — three levels up from tooling/audit-harness/src. */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/**
 * Surface class — two sub-axes: distribution (does a buyer get the source?) × audience (is the
 * output buyer-facing?). Read from `docs/state/public-surface.md` + package `license` fields, never
 * re-derived. Drives the sparse dimension-applicability matrix (./dimensions.ts).
 */
export type SurfaceClass =
  | "oss-source" // Apache-2.0 public-mirror set — buyer + world get the source
  | "sold-source" // commercial, buyer receives the source (editions, à-la-carte, generator output)
  | "buyer-runtime" // internal source, buyer-facing OUTPUT (site, docs, license service)
  | "internal-only"; // never buyer-visible

export interface Domain {
  /** stable id = the tree path of the unit, e.g. "packages/kernel", "apps/admin", "workflows". */
  id: string;
  /**
   * The path prefixes this domain OWNS — used by `domainForPath` for the coverage partition.
   * Longest-matching-root wins, so a nested carve-out (packages/cli/templates) beats its parent
   * (packages/cli) without needing exclude-globs. Empty = synthetic (no on-disk tree, e.g. the
   * oss-mirror export view — Fork D).
   */
  roots: string[];
  /** derivation globs → `enumerateSurface` (./surface.ts) resolves these to a concrete file list. */
  globs: string[];
  class: SurfaceClass;
}

/**
 * Dirs never enumerated as a tree unit (build / vendor / scratch). A REVIEWED constant — every
 * addition is a visible diff and a review line-item, per the SPEC coverage-gate risk note: an
 * over-broad ignore silently re-opens the under-scan.
 */
export const IGNORE_UNIT = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".next",
  "coverage",
]);

/** Direct child directories of `abs`, ignoring build/vendor + dotfiles. Sorted, empty if absent. */
function readDirs(abs: string): string[] {
  try {
    return readdirSync(abs, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          !IGNORE_UNIT.has(e.name) &&
          !e.name.startsWith("."),
      )
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Classify one `packages/<name>` unit from its `package.json` `license`. Apache-2.0 → oss-source,
 * anything else → sold-source. THROWS when the dir has no readable package.json — an
 * unclassifiable tree unit is the under-scan, made loud.
 */
function classifyPackage(root: string, name: string): SurfaceClass {
  let raw: string;
  try {
    raw = readFileSync(join(root, "packages", name, "package.json"), "utf8");
  } catch {
    throw new Error(
      `deriveDomains: packages/${name} has no readable package.json — cannot classify its surface ` +
        `(an unclaimed tree unit). Add a package.json with a license, or add "${name}" to IGNORE_UNIT ` +
        `with review.`,
    );
  }
  const license = (JSON.parse(raw) as { license?: string }).license;
  return license === "Apache-2.0" ? "oss-source" : "sold-source";
}

/** A per-dir domain whose root owns everything under `<container>/<name>`. */
function unitDomain(
  container: string,
  name: string,
  cls: SurfaceClass,
): Domain {
  return {
    id: `${container}/${name}`,
    roots: [`${container}/${name}`],
    globs: [`${container}/${name}/**`],
    class: cls,
  };
}

/**
 * Derive the complete domain partition for the repo at `root`. One domain per tree unit —
 * `packages/*`, `apps/*`, `services/*`, `tooling/*`, `infra/*`, `tools/*`, committed
 * package-manager patches, the workflows dir, the generator's
 * emitted templates, the docs-content prose aggregate, repo scripts, the root-docs aggregate, and
 * the synthetic oss-mirror export view. ≈67 domains, none hand-typed.
 *
 * THROWS if any `packages/*` unit cannot be classified (no package.json) — the coverage gate.
 */
export function deriveDomains(root: string = REPO_ROOT): Domain[] {
  const domains: Domain[] = [];

  // packages/* — class from each package.json license (throws if unclassifiable). packages/cli/templates
  // is carved into its own generator-templates domain below; longest-root match keeps cli from owning it.
  for (const name of readDirs(join(root, "packages"))) {
    domains.push(unitDomain("packages", name, classifyPackage(root, name)));
  }

  // apps/* — admin is the operator control-plane (internal); every other app is a served, buyer-facing runtime.
  for (const name of readDirs(join(root, "apps"))) {
    domains.push(
      unitDomain(
        "apps",
        name,
        name === "admin" ? "internal-only" : "buyer-runtime",
      ),
    );
  }

  // services/* — internal source, buyer-facing output (docs site, license API, support bot).
  for (const name of readDirs(join(root, "services"))) {
    domains.push(unitDomain("services", name, "buyer-runtime"));
  }

  // tooling/* + infra/* + tools/* — internal-only by construction (never buyer-visible). tools/
  // is the operator's own engineering scripts (e.g. tools/security, the pentest/scan stack that
  // sources ~/.gridwork/caisson.env) — a first-class domain, not a silent escape from the old scan.
  for (const container of ["tooling", "infra", "tools"] as const) {
    for (const name of readDirs(join(root, container))) {
      domains.push(unitDomain(container, name, "internal-only"));
    }
    // Loose files at the container root (e.g. a one-file script under tools/) — the per-dir unit
    // derivation above never sees them; swept by a container-root domain. Longest-root match keeps
    // each unit's own domain owning its subtree.
    domains.push({
      id: `${container}-root`,
      roots: [container],
      globs: [`${container}/*`],
      class: "internal-only",
    });
  }

  // Bun's committed dependency patches are executable package-manager inputs. They are
  // internal-only, but remain inside the audit partition instead of disappearing into an ignore.
  domains.push({
    id: "patches",
    roots: ["patches"],
    globs: ["patches/**"],
    class: "internal-only",
  });

  // Deployment entrypoints and their generated service census are executable
  // release infrastructure. Keep them inside the audit partition rather than
  // treating a new top-level tree as process exhaust.
  domains.push({
    id: "deploy-pipeline",
    roots: ["deploy"],
    globs: ["deploy/**"],
    class: "internal-only",
  });

  // The .github CI execution surface — one domain over every workflow and local action.
  domains.push({
    id: "workflows",
    roots: [".github/workflows", ".github/actions"],
    globs: [
      ".github/workflows/*.yml",
      ".github/workflows/*.yaml",
      ".github/actions/**",
    ],
    class: "internal-only",
  });

  // Repo-local Codex skills are executable governance and validation code, not process exhaust.
  domains.push({
    id: "agent-skills",
    roots: [".agents/skills"],
    globs: [".agents/skills/**"],
    class: "internal-only",
  });

  // create-caisson EMITTED buyer output — distinct from the cli source; the buyer reads it.
  domains.push({
    id: "generator-templates",
    roots: ["packages/cli/templates"],
    globs: ["packages/cli/templates/**"],
    class: "sold-source",
  });

  // Prose aggregate — internal docs/specs/knowledge. Site MDX stays under apps/site (its home) to keep
  // the partition non-overlapping; apps/site is buyer-runtime, so its MDX still gets the docs-vs-code lens.
  domains.push({
    id: "docs-content",
    roots: ["docs", "specs", "knowledge"],
    globs: ["docs/**", "specs/**", "knowledge/**"],
    class: "internal-only",
  });

  // Repo scripts (incl. export-public-mirror + mirror-assets).
  domains.push({
    id: "scripts",
    roots: ["scripts"],
    globs: ["scripts/**"],
    class: "internal-only",
  });

  // Root-level process docs — the sot-check docs-surface allowlist (root slimmed 2026-07-11:
  // PRODUCT/DESIGN/plan/SUMMARY moved under docs/, AGENTS.md is a symlink to CLAUDE.md). The repo
  // is private (the oss MIRROR ships its own README via the exporter, Fork D / the oss-mirror
  // domain), so these are never buyer-visible — internal-only.
  domains.push({
    id: "root-docs",
    roots: ["README.md", "CLAUDE.md", "AGENTS.md"],
    globs: ["README.md", "CLAUDE.md", "AGENTS.md"],
    class: "internal-only",
  });

  // Root-level policy inputs that alter agent worktree exposure or the design-token gate. These
  // are audit-relevant configuration, not generic build/lint config, so keep them in the derived
  // partition instead of adding them to coverage-gate's reviewed ignore list.
  domains.push({
    id: "root-config",
    roots: ["orca.yaml", "tokens.config.json"],
    globs: ["orca.yaml", "tokens.config.json"],
    class: "internal-only",
  });

  // Fork D — the exporter's OUTPUT view of the 16 Apache packages as it lands on public GitHub
  // (npm scope rename, dropped tests, restamped licenses). Synthetic: no in-repo root;
  // the driver runs scripts/export-public-mirror.ts and audits the produced diff, so a dangling
  // internal specifier the source view cannot see gets caught.
  domains.push({
    id: "oss-mirror",
    roots: [],
    globs: [],
    class: "oss-source",
  });

  return domains;
}

/** The derived domain-id universe (for the reconcile membership guard). Deterministic, sorted. */
export function domainIds(root: string = REPO_ROOT): Set<string> {
  return new Set(deriveDomains(root).map((d) => d.id));
}

/**
 * The single domain that OWNS `path` — the one whose root is the longest prefix of `path`. Null when
 * no domain claims it. Longest-match resolves nested carve-outs (packages/cli/templates beats
 * packages/cli) so every path has exactly one owner without exclude-globs.
 */
export function domainForPath(path: string, domains: Domain[]): Domain | null {
  let best: Domain | null = null;
  let bestLen = -1;
  for (const d of domains) {
    for (const r of d.roots) {
      if ((path === r || path.startsWith(`${r}/`)) && r.length > bestLen) {
        best = d;
        bestLen = r.length;
      }
    }
  }
  return best;
}
