// The second `caisson` bin (ADR-0345 Fork F). Agent-facing companion to `create-caisson`:
//   caisson describe [name] --json         — free, no auth; reads the committed base manifest.
//   caisson doctor  [dir] [--json]         — the static verify doctor; a thin client of the local
//                                             MCP `check_usage` tool.
//   caisson run start <prompt>             — open a governed agent run (ADR-0360 S5); a thin client
//                                             of the buyer MCP `run_start` tool (ADR-0362).
//   caisson run approve|deny|status        — the agent-runtime approval seam (ADR-0360 U-2); direct
//                                             DB call against the buyer's own Postgres.
// Bins may print to stdout/stderr (the no-console floor is for library code); errors fail closed
// with a non-zero exit.
import { loadBaseManifest } from "@caisson-sh/ds-manifest";
import { describeCommand } from "./describe.ts";
import { runDoctorCli } from "./doctor.ts";
import { runRunCli } from "./run.ts";

export const CAISSON_HELP = `\
caisson — agent-facing companion to create-caisson

Usage:
  caisson describe --json           Print the full @caisson-sh/ui component manifest as JSON
  caisson describe <name> --json    Print one component's metadata as JSON (case-insensitive)
  caisson doctor [dir] [--json]     Verify usage of the kit (via your local MCP server)
  caisson run ...                   Start/approve/deny/status for a governed agent run (see 'caisson run --help')
  caisson --help                    Show this help

describe reads the committed base manifest — no account required. doctor and 'run start' are thin
clients of your local @caisson-sh/mcp-server (set CAISSON_MCP_COMMAND), authenticated by that
server's own Bearer token. 'run approve/deny/status' talk DIRECTLY to your Postgres
(DATABASE_URL/CAISSON_ACCOUNT_ID) — see 'caisson run --help'.
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
      } else if (sub === "run") {
        await runRunCli(rest);
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
