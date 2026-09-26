// Compliance prompt, registered through the SAME prompt seam the coach uses. One prompt
// (`compliance_evidence_walkthrough`) that narrates generating a compliance project, visible to
// every authenticated caller once the host opts in.
//
// This module imports NOTHING from `server.ts` (it declares the minimal `CompliancePromptRegistrar`
// slice it needs); `McpServer` is structurally assignable to it, so `server.ts` wires it
// one-directionally with no import cycle — the same pattern as `coach.ts`/`manifest-tools.ts`. It
// deliberately takes NO `@caisson/compliance` package dependency: framework names are prompt-local
// advisory strings, not imported OSCAL frameworkIds, keeping the cross-package coupling ADR-0161
// already rejects for the transports out of this seam too.
import { ValidationError } from "@caisson/kernel";
import type { RegistryIndex } from "@caisson/registry-schema";

// The compliance module list this prompt tells the caller to generate. It must be updated whenever
// the compliance composition changes — the prompt should never recommend a set that drifts from
// what the compliance package actually composes.
const COMPLIANCE_MODULES = [
  "@caisson/compliance",
  "@caisson/audit-worm",
  "@caisson/field-crypto",
] as const;

// Frameworks the walkthrough can tailor its pointer to — a small closed set validated in-handler.
// Advisory strings only (no OSCAL frameworkId import); extend deliberately alongside the package.
const FRAMEWORKS = ["soc2", "hipaa"] as const;

/**
 * The minimal slice of the prompt seam this module drives — just prompt registration. `McpServer`
 * (from `server.ts`) is structurally assignable to this, so this module never imports the server.
 */
export interface CompliancePromptRegistrar {
  registerPrompt(registration: {
    name: string;
    description: string;
    version: string;
    arguments: readonly {
      name: string;
      description?: string;
      required: boolean;
    }[];
    handler: (ctx: { args: Readonly<Record<string, string>> }) => Promise<{
      description?: string;
      messages: readonly {
        role: "user" | "assistant";
        content: { type: "text"; text: string };
      }[];
    }>;
  }): void;
}

/** The opt-in marker for the compliance prompt: pass `{}` to register it. It carries no settings. */
export type CompliancePromptOptions = Readonly<Record<string, never>>;

/** Register the compliance prompt on `server` through the prompt seam. */
export function registerCompliancePrompts(
  server: CompliancePromptRegistrar,
  index: RegistryIndex,
): void {
  server.registerPrompt({
    name: "compliance_evidence_walkthrough",
    description:
      "Walk through generating a compliance project and where evidence assembly lives.",
    version: "1.0.0",
    arguments: [
      {
        name: "framework",
        description: `Target framework: ${FRAMEWORKS.join(" or ")} (default soc2).`,
        required: false,
      },
      {
        name: "project_name",
        description: "The target project slug (default my-app).",
        required: false,
      },
    ],
    handler: async ({ args }) => {
      const framework = args.framework ?? "soc2";
      if (!(FRAMEWORKS as readonly string[]).includes(framework)) {
        throw new ValidationError("Unsupported framework", {
          framework,
          supported: [...FRAMEWORKS],
        });
      }
      const projectName = args.project_name ?? "my-app";
      // Resolve each module to its CONCRETE latest version: `generate` validates via
      // assertKnownVersion, which only accepts members of entry.versions — the literal string
      // "latest" is an index pointer and would 400. Fail-closed if the hard-coded module list ever
      // drifts from the live index.
      const modules = COMPLIANCE_MODULES.map((id) => {
        const entry = index.modules.find((m) => m.id === id);
        if (entry === undefined) {
          throw new ValidationError(
            "Compliance module missing from registry index",
            { module: id },
          );
        }
        return { id, version: entry.latest };
      });
      const text = [
        `Generate a ${framework.toUpperCase()} compliance project scaffold for "${projectName}".`,
        "",
        "1. Generate the project — call the generate tool:",
        JSON.stringify({ projectName, modules }, null, 2),
        "   generate validates every module against the registry catalog, then writes the scaffold.",
        "",
        `2. Assemble ${framework.toUpperCase()}-specific OSCAL evidence packs using the generated project's own compliance tooling — that assembly runs in your project, not on this MCP server.`,
      ].join("\n");
      return {
        description: `Compliance evidence walkthrough (${framework})`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  });
}
