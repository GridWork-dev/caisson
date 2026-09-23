// The version PR runs this after Changesets and before packing. Only trusted local
// workspace manifests supply versions; neither template carries its own version truth.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const TEMPLATES = [
  "packages/cli/templates/framework/next/package.json",
  "packages/cli/templates/eu-ai-act-sample/package.json",
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
  // Plan both files before writing: a missing/mismatched workspace cannot leave
  // the first template partially refreshed while the second remains stale.
  const updates = TEMPLATES.map((relative) => {
    const path = join(root, relative);
    const original = readFileSync(path, "utf8");
    const template = Template.parse(JSON.parse(original));
    let pins = 0;
    let changed = false;
    for (const name of Object.keys(template.dependencies)) {
      if (!name.startsWith("@caisson/")) continue;
      if (!/^@caisson\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`Invalid workspace dependency: ${name}`);
      }
      const slug = name.slice("@caisson/".length);
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
    return {
      path,
      relative,
      content: changed ? `${JSON.stringify(template, null, 2)}\n` : original,
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
