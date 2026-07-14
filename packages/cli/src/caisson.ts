// The second `caisson` bin (ADR-0345 Fork F). Agent-facing companion to `create-caisson`:
//   caisson describe [name] --json   — free, no auth; reads the committed base manifest.
//   caisson doctor  [dir] [--json]    — the static verify doctor; a thin client of the buyer MCP
//                                       `check_usage` tool (added in the Fork-F doctor increment).
// Bins may print to stdout/stderr (the no-console floor is for library code); errors fail closed
// with a non-zero exit.
import { loadBaseManifest } from "@caisson/ds-manifest";
import { describeCommand } from "./describe.ts";

export const CAISSON_HELP = `\
caisson — agent-facing companion to create-caisson

Usage:
  caisson describe --json           Print the full @caisson/ui component manifest as JSON
  caisson describe <name> --json    Print one component's metadata as JSON (case-insensitive)
  caisson --help                    Show this help

describe reads the committed Apache-base manifest — no Caisson account required.
`;

if (import.meta.main) {
  const [sub, ...rest] = process.argv.slice(2);
  try {
    if (sub === "describe") {
      process.stdout.write(
        `${describeCommand(rest, { manifest: loadBaseManifest() })}\n`,
      );
    } else if (sub === undefined || sub === "--help" || sub === "-h") {
      process.stdout.write(CAISSON_HELP);
    } else {
      throw new Error(`unknown command ${JSON.stringify(sub)}`);
    }
  } catch (e) {
    process.stderr.write(`caisson: ${(e as Error).message}\n`);
    process.exit(1);
  }
}
