/**
 * The static usage doctor — pure, deterministic, no renderer. Given an adopter's source files and the
 * committed component manifest, it reports the mechanical mistakes a coding agent makes when it
 * adopts the kit without a human reading docs: a hallucinated component import, a stale kit version,
 * a hard-coded colour instead of a token, an invalid `data-*` variant value, a hand-rolled control
 * that skips the aria-wiring `FormField` does for free, and — when the adopter hands over their
 * customised theme — a WCAG contrast regression (reusing the kit's own contrast gate, `contrast.ts`,
 * never a second copy of it). Every check is text/AST-free regex analysis over untrusted adopter
 * input: no exec, no fs, no network — so the same function is safe to run behind an MCP tool.
 */
import { z } from "zod";
import type { Component, ComponentManifest } from "./schema.ts";
import {
  checkContrast,
  type ContrastFunctional,
  type ContrastTheme,
} from "./contrast.ts";

export type Severity = "error" | "warning";

export interface Finding {
  /** Stable machine id of the rule that fired (e.g. `"unknown-component"`). */
  rule: string;
  severity: Severity;
  /** The adopter file the finding is anchored to. */
  file: string;
  /** 1-indexed line, when the finding points at a specific spot. */
  loc?: { line: number };
  message: string;
}

// Untrusted adopter input — bounded + `.strict()` so a check behind an MCP tool cannot be used to
// smuggle an unknown field or an unbounded payload (repo security floor). The manifest and token
// objects are NOT here: they are trusted, caller-supplied (already schema-validated on the way in).
const doctorFileSchema = z
  .object({
    path: z.string().min(1).max(512),
    contents: z.string().max(200_000),
  })
  .strict();

const doctorThemeSchema = z
  .object({
    mode: z.string().min(1).max(32),
    file: z.string().min(1).max(512),
    /** A full theme + functional-token object shaped like `@caisson-sh/ui`'s (validated structurally
     *  by the contrast checker, which reads only the keys it needs). */
    theme: z.record(z.string(), z.string()),
    fn: z.record(z.string(), z.string()),
  })
  .strict();

export const doctorUsageSchema = z
  .object({
    files: z.array(doctorFileSchema).max(500),
    /** The adopter's customised themes, when they want the contrast gate run over their palette. */
    themes: z.array(doctorThemeSchema).max(50).optional(),
  })
  .strict();

export type DoctorFile = z.infer<typeof doctorFileSchema>;
export type DoctorUsage = z.infer<typeof doctorUsageSchema>;

/** 1-indexed line number of a byte offset in `contents`. */
function lineAt(contents: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < contents.length; i++) {
    if (contents[i] === "\n") line++;
  }
  return line;
}

// --- individual checks (each pure over one file, appending to `out`) --------------------------

// A named import of a kit component whose PascalCase name is not a known component — a typo or a
// component the agent hallucinated. Components are exported from the `@caisson-sh/ui/components` subpath
// (the root `@caisson-sh/ui` barrel is tokens+theme only, ADR-0099), so the specifier must match both
// the real consumer path and the bare barrel. ponytail: heuristic — only PascalCase specifiers are
// treated as components, so a helper/hook/type import (`cn`, `useTheme`) is never falsely flagged.
const UI_IMPORT_RE =
  /import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([\s\S]*?)\}\s*from\s*["']@caisson-sh\/ui(?:\/components)?["']/g;

function checkImports(
  file: DoctorFile,
  known: ReadonlySet<string>,
  out: Finding[],
): void {
  for (const m of file.contents.matchAll(UI_IMPORT_RE)) {
    if (/^import\s+type\b/.test(m[0])) continue; // type-only import is not a runtime usage
    const line = lineAt(file.contents, m.index ?? 0);
    for (const raw of (m[1] ?? "").split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name === undefined || name === "") continue;
      if (/^[A-Z]/.test(name) && !known.has(name)) {
        out.push({
          rule: "unknown-component",
          severity: "error",
          file: file.path,
          loc: { line },
          message: `"${name}" is imported from @caisson-sh/ui but is not a component in the manifest.`,
        });
      }
    }
  }
}

const PKG_UI_DEP_RE = /"@caisson-sh\/ui"\s*:\s*"([^"]+)"/;
const SEMVER_RE = /(\d+\.\d+\.\d+)/;

// An adopter package.json pinning a different `@caisson-sh/ui` than the manifest was generated for — the
// manifest they are being checked against may not describe the version they actually installed.
function checkVersionSkew(
  file: DoctorFile,
  manifest: ComponentManifest,
  out: Finding[],
): void {
  if (!file.path.endsWith("package.json")) return;
  const dep = PKG_UI_DEP_RE.exec(file.contents);
  if (dep === null) return;
  const declared = SEMVER_RE.exec(dep[1] ?? "")?.[1];
  if (declared === undefined || declared === manifest.generatedFor.version)
    return;
  out.push({
    rule: "version-skew",
    severity: "warning",
    file: file.path,
    loc: { line: lineAt(file.contents, dep.index) },
    message: `package.json pins @caisson-sh/ui ${declared}, but this manifest was generated for ${manifest.generatedFor.version} — regenerate or align the versions.`,
  });
}

// A hard-coded colour (hex or oklch literal) instead of a `--cs-*` token. ponytail: flags every
// colour literal in every file — an adopter theme-definition file legitimately holds colour literals,
// so this is a warning, and the contrast gate (below), not this check, is what validates a theme.
const COLOR_LITERAL_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|oklch\s*\(/g;
// Assigning a `--cs-*` token (CSS `--cs-x:` or a JS `"--cs-x":` object key) — overriding a kit
// token outside the theme API. Reading one (`var(--cs-x)`) has no `:` after the name → never flagged.
const TOKEN_OVERRIDE_RE = /--cs-[a-z0-9-]+["']?\s*:/g;

function checkTokenMisuse(file: DoctorFile, out: Finding[]): void {
  for (const m of file.contents.matchAll(COLOR_LITERAL_RE)) {
    out.push({
      rule: "raw-color-literal",
      severity: "warning",
      file: file.path,
      loc: { line: lineAt(file.contents, m.index ?? 0) },
      message: `hard-coded colour "${m[0].trim()}" — use a --cs-* token or the theme API instead.`,
    });
  }
  for (const m of file.contents.matchAll(TOKEN_OVERRIDE_RE)) {
    out.push({
      rule: "token-override",
      severity: "warning",
      file: file.path,
      loc: { line: lineAt(file.contents, m.index ?? 0) },
      message: `"${m[0].replace(/["']?\s*:$/, "")}" is overridden outside the theme API — set kit tokens through the generated theme, not ad hoc.`,
    });
  }
}

const DATA_ATTR_RE = /data-([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/g;

// A `data-<prop>="<value>"` whose value is not in the manifest's variant set for that prop. ponytail:
// `variantMap` is aggregated across ALL components (not scoped to the specific element), so this
// catches an invalid variant value globally, not per-component — the upgrade is per-element scoping.
function checkVariants(
  file: DoctorFile,
  variantMap: ReadonlyMap<string, ReadonlySet<string>>,
  out: Finding[],
): void {
  for (const m of file.contents.matchAll(DATA_ATTR_RE)) {
    const attr = m[1] ?? "";
    const value = m[2] ?? "";
    const allowed = variantMap.get(attr);
    if (allowed === undefined || allowed.has(value)) continue;
    out.push({
      rule: "invalid-variant",
      severity: "error",
      file: file.path,
      loc: { line: lineAt(file.contents, m.index ?? 0) },
      message: `data-${attr}="${value}" is not a valid ${attr} — allowed: ${[...allowed].sort().join(", ")}.`,
    });
  }
}

// An element flagged `aria-invalid` (truthy) with no `aria-describedby` — the exact wiring FormField
// does automatically, hand-rolled and left half-done. ponytail: single-tag regex (no nested `>`),
// only the `="true"`/`={true}` forms — the common mistake; not a full a11y linter.
const OPEN_TAG_RE = /<[a-zA-Z][a-zA-Z0-9.]*\b[^>]*>/g;
const ARIA_INVALID_TRUTHY_RE =
  /\baria-invalid\s*=\s*(?:["']?true["']?|\{true\})/;

function checkAriaWiring(file: DoctorFile, out: Finding[]): void {
  for (const m of file.contents.matchAll(OPEN_TAG_RE)) {
    const tag = m[0];
    if (!ARIA_INVALID_TRUTHY_RE.test(tag)) continue;
    if (/\baria-describedby\b/.test(tag)) continue;
    out.push({
      rule: "missing-aria-describedby",
      severity: "error",
      file: file.path,
      loc: { line: lineAt(file.contents, m.index ?? 0) },
      message:
        "aria-invalid is set without aria-describedby — use FormField (it wires the error/aria association) or add aria-describedby.",
    });
  }
}

function checkThemes(themes: DoctorUsage["themes"], out: Finding[]): void {
  if (themes === undefined) return;
  for (const t of themes) {
    let violations;
    try {
      violations = checkContrast(
        t.theme as unknown as ContrastTheme,
        t.fn as unknown as ContrastFunctional,
        t.mode,
      );
    } catch {
      continue; // a malformed/partial theme cannot be contrast-checked — skip, never crash
    }
    for (const v of violations) {
      out.push({
        rule: "contrast",
        severity: "error",
        file: t.file,
        message: `contrast ${v.ratio.toFixed(2)}:1 (needs ${v.min}:1) for ${v.use} — ${v.fg} on ${v.bg} in ${v.mode} mode.`,
      });
    }
  }
}

/** Build the `prop -> allowed values` map aggregated across every component's typed variant sets. */
function buildVariantMap(
  components: readonly Component[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of components) {
    for (const [prop, values] of Object.entries(c.variants)) {
      const set = map.get(prop) ?? new Set<string>();
      for (const v of values) set.add(v);
      map.set(prop, set);
    }
  }
  return map;
}

/**
 * Run every static check over the adopter's files (and optional themes) against `manifest`. Returns
 * every finding, deterministically ordered (per-file in source order, checks in a fixed sequence);
 * an empty array means the usage is clean. `usage` is untrusted and validated `.strict()` here.
 */
export function checkUsage(
  manifest: ComponentManifest,
  usage: unknown,
): Finding[] {
  const parsed = doctorUsageSchema.parse(usage);
  const known = new Set(manifest.components.map((c) => c.name));
  const variantMap = buildVariantMap(manifest.components);
  const out: Finding[] = [];
  for (const file of parsed.files) {
    checkImports(file, known, out);
    checkVersionSkew(file, manifest, out);
    checkTokenMisuse(file, out);
    checkVariants(file, variantMap, out);
    checkAriaWiring(file, out);
  }
  checkThemes(parsed.themes, out);
  return out;
}
