// `caisson describe [name] --json` (ADR-0345 Fork F / SPEC Scope 2). The FREE half of the second
// `caisson` bin: deterministic, no auth, same data layer as the MCP tools — it reads the committed
// Apache-base manifest from `@caisson-sh/ds-manifest`. `describe --json` prints the whole manifest;
// `describe <name> --json` prints one component (case-insensitive). JSON is the only v1 output.
import type { ComponentManifest } from "@caisson-sh/ds-manifest";

/**
 * Render the `describe` command's stdout for the given argv (the tokens AFTER the `describe`
 * subcommand). Pure: takes the manifest as a dep, returns the string to print — the bin does the IO.
 * Throws on an unknown flag, a missing `--json`, or an unknown component name (fail-closed).
 */
export function describeCommand(
  argv: readonly string[],
  deps: { manifest: ComponentManifest },
): string {
  let name: string | undefined;
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (!arg.startsWith("-") && name === undefined) {
      name = arg;
    } else {
      throw new Error(`describe: unknown argument ${JSON.stringify(arg)}`);
    }
  }
  if (!json) {
    throw new Error("describe requires --json (the only supported output).");
  }
  if (name === undefined) {
    return JSON.stringify(deps.manifest, null, 2);
  }
  const found = deps.manifest.components.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (found === undefined) {
    throw new Error(`describe: unknown component ${JSON.stringify(name)}`);
  }
  return JSON.stringify(found, null, 2);
}
