import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import ts from "typescript";

import {
  parseComponentManifest,
  type Component,
  type ComponentManifest,
  type ComponentProp,
} from "@caisson-sh/ds-manifest";

export interface PrimaryComponentExport {
  name: string;
  modulePath: string;
  sourcePath: string;
}

export const SECONDARY_COMPONENT_EXPORTS = [
  "LedgerRow",
  "ToastRegion",
] as const;

interface ExtractedProp {
  manifest: ComponentProp;
  variants: readonly string[];
}

const RAW_COLOR_LITERAL =
  /(?:#[0-9a-f]{3,8}\b|(?:oklch|oklab|rgba?|hsla?)\s*\()/i;

function fail(message: string): never {
  throw new Error(`component manifest: ${message}`);
}

function kebabToPascal(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

function createUiProgram(uiRoot: string): ts.Program {
  const configPath = resolve(uiRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error !== undefined) fail(formatDiagnostics([config.error]));

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    uiRoot,
    { noEmit: true },
    configPath,
  );
  if (parsed.errors.length > 0) fail(formatDiagnostics(parsed.errors));

  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
}

function moduleExports(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): readonly ts.Symbol[] {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (symbol === undefined)
    fail(`cannot resolve module ${sourceFile.fileName}`);
  return checker.getExportsOfModule(symbol);
}

function documentation(symbol: ts.Symbol, checker: ts.TypeChecker): string {
  return ts
    .displayPartsToString(symbol.getDocumentationComment(checker))
    .trim();
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function componentSummary(
  componentName: string,
  componentSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): string {
  const docs = documentation(componentSymbol, checker);
  if (docs.length === 0) fail(`${componentName} has no component JSDoc`);
  const firstParagraph = docs.split(/\n\s*\n/, 1)[0];
  if (firstParagraph === undefined) fail(`${componentName} has no summary`);
  return oneLine(firstParagraph).replace(
    new RegExp(`^${componentName}\\s+[—-]\\s+`),
    "",
  );
}

function typeText(
  checker: ts.TypeChecker,
  property: ts.Symbol,
  declaration: ts.Declaration,
): string {
  return checker.typeToString(
    checker.getTypeOfSymbolAtLocation(property, declaration),
    declaration,
    ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  );
}

function stringLiteralVariants(type: ts.Type): readonly string[] {
  const members = type.isUnion() ? type.types : [type];
  const meaningful = members.filter(
    (member) =>
      (member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never)) === 0,
  );
  if (
    meaningful.length === 0 ||
    meaningful.some((member) => !member.isStringLiteral())
  )
    return [];

  return [
    ...new Set(
      meaningful.map((member) => {
        if (!member.isStringLiteral()) fail("unreachable non-string variant");
        return member.value;
      }),
    ),
  ].sort();
}

function extractProps(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  propsSymbol: ts.Symbol,
): readonly ExtractedProp[] {
  const propsType = checker.getDeclaredTypeOfSymbol(propsSymbol);

  return checker
    .getPropertiesOfType(propsType)
    .flatMap((property): ExtractedProp[] => {
      const declaration = property
        .getDeclarations()
        ?.find((candidate) => candidate.getSourceFile() === sourceFile);
      if (declaration === undefined) return [];

      const doc = oneLine(documentation(property, checker));
      const manifest: ComponentProp = {
        name: property.name,
        type: typeText(checker, property, declaration),
        optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
        ...(doc.length > 0 ? { doc } : {}),
      };
      return [
        {
          manifest,
          variants: stringLiteralVariants(
            checker.getTypeOfSymbolAtLocation(property, declaration),
          ),
        },
      ];
    })
    .sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );
}

function explicitA11yNotes(
  componentSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): string[] {
  return componentSymbol.getJsDocTags(checker).flatMap((tag): string[] => {
    if (tag.name !== "a11y" || tag.text === undefined) return [];
    const note = oneLine(ts.displayPartsToString(tag.text));
    return note.length === 0 ? [] : [note];
  });
}

function cssTokenCatalog(uiRoot: string): ReadonlySet<string> {
  const css = readFileSync(resolve(uiRoot, "styles/tokens.css"), "utf8");
  return new Set(
    [...css.matchAll(/^\s*(--cs-[a-z0-9-]+)\s*:/gm)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    ),
  );
}

function tokenDependencies(
  sourcePath: string,
  tokenCatalog: ReadonlySet<string>,
): string[] {
  const cssPath = sourcePath.replace(/\.tsx$/, ".css");
  if (!existsSync(cssPath)) return [];
  const css = readFileSync(cssPath, "utf8");
  if (hasRawColorLiteral(css))
    fail(`${basename(cssPath)} contains a raw color literal`);
  const localDefinitions = new Set(
    [...css.matchAll(/^\s*(--cs-[a-z0-9-]+)\s*:/gm)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    ),
  );
  const references = new Map<string, boolean>();
  for (const match of css.matchAll(/var\(\s*(--cs-[a-z0-9-]+)(\s*,)?/g)) {
    const token = match[1];
    if (token === undefined) continue;
    const hasFallback = match[2] !== undefined;
    references.set(token, (references.get(token) ?? true) && hasFallback);
  }

  const dependencies: string[] = [];
  for (const [token, everyUseHasFallback] of references) {
    if (localDefinitions.has(token)) continue;
    if (tokenCatalog.has(token)) {
      dependencies.push(token);
      continue;
    }
    if (!everyUseHasFallback)
      fail(`${basename(cssPath)} reads unknown required token ${token}`);
  }
  return dependencies.sort();
}

function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  )
    return name.text;
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  )
    return name.expression.text;
  return undefined;
}

function collectStaticSpreadKeys(
  expression: ts.Expression,
  names: Set<string>,
): void {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    collectStaticSpreadKeys(expression.expression, names);
    return;
  }
  if (ts.isConditionalExpression(expression)) {
    collectStaticSpreadKeys(expression.whenTrue, names);
    collectStaticSpreadKeys(expression.whenFalse, names);
    return;
  }
  if (!ts.isObjectLiteralExpression(expression)) return;

  for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) {
      collectStaticSpreadKeys(property.expression, names);
      continue;
    }
    const name = staticPropertyName(property.name);
    if (name !== undefined) names.add(name);
  }
}

function jsxAttributeNames(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node)) names.add(node.name.getText(sourceFile));
    if (ts.isJsxSpreadAttribute(node))
      collectStaticSpreadKeys(node.expression, names);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function hasJsxAttribute(
  sourceFile: ts.SourceFile,
  predicate: (name: string) => boolean,
): boolean {
  return [...jsxAttributeNames(sourceFile)].some(predicate);
}

function explicitJsxA11yNote(sourceFile: ts.SourceFile): string[] {
  const attributes = [...jsxAttributeNames(sourceFile)].filter(
    (name) => name.startsWith("aria-") || name === "role",
  );
  if (attributes.length === 0) return [];
  return [
    `Rendered markup explicitly wires ${attributes
      .sort()
      .map((name) => `\`${name}\``)
      .join(", ")}.`,
  ];
}

export function hasRawColorLiteral(css: string): boolean {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return RAW_COLOR_LITERAL.test(withoutComments);
}

function recipeRules(sourceFile: ts.SourceFile, sourcePath: string): string[] {
  const source = sourceFile.getFullText();
  const rules = new Set<string>();
  if (hasJsxAttribute(sourceFile, (name) => name === "style"))
    rules.add("typed-dynamic-style-seam");
  else rules.add("no-inline-style");
  const cssPath = sourcePath.replace(/\.tsx$/, ".css");
  if (
    existsSync(cssPath) &&
    source.includes(`import "./${basename(cssPath)}"`)
  ) {
    const css = readFileSync(cssPath, "utf8");
    rules.add(
      hasRawColorLiteral(css) ? "co-located-css" : "co-located-css-tokens-only",
    );
  }
  if (hasJsxAttribute(sourceFile, (name) => name.startsWith("data-")))
    rules.add("data-star-variants-no-js-branching");
  if (/\bforwardRef(?:<|\()/.test(source)) rules.add("forwardref-bem-naming");
  else rules.add("bem-naming");
  if (/from\s+["']radix-ui["']/.test(source))
    rules.add("radix-behavior-for-polymorphism");
  if (/^\s*["']use client["'];/m.test(source))
    rules.add("client-only-when-stateful");
  else rules.add("server-safe-by-default");
  return [...rules].sort();
}

function readPackageIdentity(uiRoot: string): {
  pkg: string;
  version: string;
} {
  const input: unknown = JSON.parse(
    readFileSync(resolve(uiRoot, "package.json"), "utf8"),
  );
  if (typeof input !== "object" || input === null)
    fail("package.json is not an object");
  const record = input as Record<string, unknown>;
  if (record.name !== "@caisson-sh/ui" && record.name !== "@caisson-sh/ui")
    fail("package.json name is not @caisson-sh/ui or @caisson-sh/ui");
  if (typeof record.version !== "string" || record.version.length === 0)
    fail("package.json version is missing");
  // The public mirror renames the npm scope, but manifests retain the canonical product id.
  return { pkg: "@caisson-sh/ui", version: record.version };
}

export function discoverPrimaryComponentExports(
  uiRoot: string,
): PrimaryComponentExport[] {
  const barrelPath = resolve(uiRoot, "src/components/index.ts");
  const barrel = ts.createSourceFile(
    barrelPath,
    readFileSync(barrelPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const discovered: PrimaryComponentExport[] = [];
  const secondary = new Set<string>();

  for (const statement of barrel.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.isTypeOnly ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith("./") ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    )
      continue;

    const modulePath = statement.moduleSpecifier.text;
    const expectedName = kebabToPascal(basename(modulePath));
    const primary = statement.exportClause.elements.find(
      (element) => !element.isTypeOnly && element.name.text === expectedName,
    );
    for (const element of statement.exportClause.elements) {
      if (
        !element.isTypeOnly &&
        element.name.text !== expectedName &&
        /^[A-Z][A-Za-z0-9]*$/.test(element.name.text)
      )
        secondary.add(element.name.text);
    }
    if (primary === undefined) continue;

    const sourcePath = resolve(
      uiRoot,
      `src/components/${modulePath.slice(2)}.tsx`,
    );
    if (!existsSync(sourcePath))
      fail(`${expectedName} source does not exist at ${sourcePath}`);
    discovered.push({ name: expectedName, modulePath, sourcePath });
  }

  discovered.sort((left, right) => left.name.localeCompare(right.name));
  const names = discovered.map(({ name }) => name);
  if (new Set(names).size !== names.length)
    fail("barrel contains duplicate primary component exports");
  const expectedSecondary = [...SECONDARY_COMPONENT_EXPORTS].sort();
  const actualSecondary = [...secondary].sort();
  if (JSON.stringify(actualSecondary) !== JSON.stringify(expectedSecondary))
    fail(
      `secondary component exports changed: expected ${expectedSecondary.join(", ")}, found ${actualSecondary.join(", ") || "none"}`,
    );
  return discovered;
}

function extractComponent(
  checker: ts.TypeChecker,
  program: ts.Program,
  primary: PrimaryComponentExport,
  tokenCatalog: ReadonlySet<string>,
): Component {
  const sourceFile = program.getSourceFile(primary.sourcePath);
  if (sourceFile === undefined) fail(`program omitted ${primary.sourcePath}`);
  const exports = moduleExports(checker, sourceFile);
  const componentSymbol = exports.find(({ name }) => name === primary.name);
  if (componentSymbol === undefined)
    fail(`${primary.name} is not exported by ${primary.sourcePath}`);
  const propsSymbol = exports.find(
    ({ name }) => name === `${primary.name}Props`,
  );
  if (propsSymbol === undefined)
    fail(`${primary.name}Props is not exported by ${primary.sourcePath}`);

  const extractedProps = extractProps(checker, sourceFile, propsSymbol);
  const variants = Object.fromEntries(
    extractedProps
      .filter(({ variants: values }) => values.length > 0)
      .map(({ manifest: { name }, variants: values }) => [name, [...values]]),
  );
  const props = extractedProps.map(({ manifest }) => manifest);

  return {
    name: primary.name,
    summary: componentSummary(primary.name, componentSymbol, checker),
    props,
    variants,
    tokenDeps: tokenDependencies(primary.sourcePath, tokenCatalog),
    a11yNotes: [
      ...new Set([
        ...explicitA11yNotes(componentSymbol, checker),
        ...explicitJsxA11yNote(sourceFile),
      ]),
    ],
    recipeRules: recipeRules(sourceFile, primary.sourcePath),
    hasDataStar: hasJsxAttribute(sourceFile, (name) =>
      name.startsWith("data-"),
    ),
  };
}

export function buildComponentManifest(uiRoot: string): ComponentManifest {
  const program = createUiProgram(uiRoot);
  const checker = program.getTypeChecker();
  const tokenCatalog = cssTokenCatalog(uiRoot);
  const manifest = {
    schemaVersion: 1,
    generatedFor: readPackageIdentity(uiRoot),
    components: discoverPrimaryComponentExports(uiRoot).map((primary) =>
      extractComponent(checker, program, primary, tokenCatalog),
    ),
  };
  return parseComponentManifest(manifest);
}

export function renderComponentManifest(manifest: unknown): string {
  return `${JSON.stringify(parseComponentManifest(manifest), null, 2)}\n`;
}

export function assertManifestCurrent(
  committed: string,
  generated: string,
): void {
  if (committed !== generated)
    throw new Error(
      "component manifest drift: run `bun run --filter @caisson-sh/ui gen:manifest` and commit the generated file",
    );
}
