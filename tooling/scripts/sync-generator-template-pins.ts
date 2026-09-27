// The version PR runs this after Changesets and before packing. Only trusted local
// workspace manifests supply versions; no template carries its own version truth.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const TEMPLATES = [
  "packages/cli/templates/framework/next/package.json",
] as const;
const Template = z
  .object({
    dependencies: z.record(z.string(), z.string()),
  })
  .passthrough();
const Workspace = z
  .object({
    name: z.string(),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  })
  .passthrough();

export function syncGeneratorTemplatePins(root: string): string[] {
  // Plan every file before writing: a missing/mismatched workspace cannot leave
  // one template partially refreshed while another remains stale.
  const updates = TEMPLATES.map((relative) => {
    const path = join(root, relative);
    const original = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(original);
    const template = Template.parse(parsed);
    let pins = 0;
    let changed = false;
    for (const name of Object.keys(template.dependencies)) {
      if (!name.startsWith("@caisson-sh/")) continue;
      if (!/^@caisson-sh\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`Invalid workspace dependency: ${name}`);
      }
      const slug = name.slice("@caisson-sh/".length);
      const workspace = Workspace.parse(
        JSON.parse(
          readFileSync(join(root, "packages", slug, "package.json"), "utf8"),
        ),
      );
      if (workspace.name !== name) {
        throw new Error(
          `Workspace name mismatch for ${name}: ${workspace.name}`,
        );
      }
      const pin = `^${workspace.version}`;
      changed ||= template.dependencies[name] !== pin;
      template.dependencies[name] = pin;
      pins += 1;
    }
    if (pins === 0) throw new Error(`No workspace pins in ${relative}`);
    // Template.parse puts declared keys first; write the fields back in the file's own order,
    // which is the order the formatter's package.json sorting expects.
    const ordered = Object.fromEntries(
      Object.keys(parsed as object).map((key) => [key, template[key]]),
    );
    return {
      path,
      relative,
      content: changed ? `${JSON.stringify(ordered, null, 2)}\n` : original,
      changed,
    };
  });
  for (const update of updates) {
    if (update.changed) writeFileSync(update.path, update.content);
  }
  return updates
    .filter((update) => update.changed)
    .map((update) => update.relative);
}

if (import.meta.main) {
  const changed = syncGeneratorTemplatePins(join(import.meta.dir, "..", ".."));
  process.stdout.write(
    `[version-pr] refreshed ${changed.length} generator template(s)\n`,
  );
}
