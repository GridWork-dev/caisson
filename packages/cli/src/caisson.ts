// The second `caisson` bin (ADR-0345 Fork F). Agent-facing companion to `create-caisson`:
//   caisson describe [name] --json   — free, no auth; reads the committed base manifest.
//   caisson doctor  [dir] [--json]    — the static verify doctor; a thin client of the buyer MCP
//                                       `check_usage` tool (the licensed verify increment).
// Bins may print to stdout/stderr (the no-console floor is for library code); errors fail closed
// with a non-zero exit.
import { loadBaseManifest } from "@caisson/ds-manifest";
import { describeCommand } from "./describe.ts";
import { runDoctorCli } from "./doctor.ts";

export const CAISSON_HELP = `\
caisson — agent-facing companion to create-caisson

Usage:
  caisson describe --json           Print the full @caisson/ui component manifest as JSON
  caisson describe <name> --json    Print one component's metadata as JSON (case-insensitive)
  caisson doctor [dir] [--json]     Verify buyer usage of the kit (licensed; via the buyer MCP)
  caisson --help                    Show this help

describe reads the committed Apache-base manifest — no Caisson account required. doctor is a thin
client of your local @caisson/mcp-server check_usage tool (set CAISSON_MCP_COMMAND) and is
entitlement-gated.
`;

if (import.meta.main) {
  void (async () => {
    const [sub, ...rest] = process.argv.slice(2);
    try {
      if (sub === "describe") {
        process.stdout.write(
          `${describeCommand(rest, { manifest: loadBaseManifest() })}\n`,
        );
      } else if (sub === "doctor") {
        await runDoctorCli(rest);
      } else if (sub === undefined || sub === "--help" || sub === "-h") {
        process.stdout.write(CAISSON_HELP);
      } else {
        throw new Error(`unknown command ${JSON.stringify(sub)}`);
      }
    } catch (e) {
      process.stderr.write(`caisson: ${(e as Error).message}\n`);
      process.exit(1);
    }
  })();
}
