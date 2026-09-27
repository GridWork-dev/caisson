// What a published tarball must and must not contain, checked by publish-packages.ts on every pack
// (CI runs it with --dry-run, so a package whose `files` list drifts fails the PR, not the release).
//
// Tests, stories, fixtures and build config never ship. `templates/` is exempt: it is the
// generator's scaffold, and the projects it creates carry their own tests.
const NOT_SHIPPED =
  /(^|\/)(__golden__|__fixtures__|__snapshots__|\.turbo)\/|\.(test|stories)\.[^/]+$|(^|\/)tsconfig[^/]*\.json$/;

export interface PackedManifest {
  name: string;
  exports?: unknown;
  bin?: unknown;
}

/** Every path a package's `exports` and `bin` point at, without the leading `./`. */
function entryPoints(pkg: PackedManifest): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") found.push(value.replace(/^\.\//, ""));
    else if (value !== null && typeof value === "object")
      for (const inner of Object.values(value)) walk(inner);
  };
  walk(pkg.exports);
  walk(pkg.bin);
  return found;
}

const RELATIVE_SPECIFIER =
  /(?:\bfrom|\bimport)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;

/**
 * Relative import specifiers in compiled JavaScript that name no file extension. Node's ESM loader
 * cannot resolve them, so one in a shipped `dist` file breaks the package for Node consumers.
 */
export function extensionlessImports(source: string): string[] {
  // Comments are dropped first: tsc keeps them, and JSDoc names modules as `import("./x.ts")`.
  // ponytail: whole-line `//` comments only, so a `//` inside a string is never cut.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(RELATIVE_SPECIFIER)]
    .map((match) => match[1] ?? "")
    .filter((specifier) => !/\.(m?js|cjs|json|css)$/.test(specifier));
}

/**
 * Throws when the tarball ships a test or tooling file, or lacks a file its entry points name.
 * `entries` are tarball paths relative to the package root (no leading `package/`).
 */
export function checkPackageContents(
  pkg: PackedManifest,
  entries: readonly string[],
): void {
  const stray = entries.filter(
    (entry) => !entry.startsWith("templates/") && NOT_SHIPPED.test(entry),
  );
  if (stray.length > 0) {
    throw new Error(
      `${pkg.name}: tarball ships ${stray.length} test or tooling files, e.g. ${stray[0]}`,
    );
  }
  const missing = entryPoints(pkg).filter((target) =>
    target.endsWith("*")
      ? !entries.some((entry) => entry.startsWith(target.slice(0, -1)))
      : !entries.includes(target),
  );
  if (missing.length > 0) {
    throw new Error(
      `${pkg.name}: tarball is missing entry points ${missing.join(", ")}`,
    );
  }
}
