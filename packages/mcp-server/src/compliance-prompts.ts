// Compliance-edition prompt, registered through the SAME prompt seam the coach uses. One
// entitlement-gated prompt (`compliance_evidence_walkthrough`) that narrates generating a
// compliance-edition project — invisible (404) to a caller without the `compliance` slug, per the
// seam's constant-time gate.
//
// This module imports NOTHING from `server.ts` (it declares the minimal `CompliancePromptRegistrar`
// slice it needs); `McpServer` is structurally assignable to it, so `server.ts` wires it
// one-directionally with no import cycle — the same pattern as `coach.ts`/`manifest-tools.ts`. It
// deliberately takes NO `@caisson/compliance` package dependency: framework names are prompt-local
// advisory strings, not imported OSCAL frameworkIds, keeping the cross-package coupling ADR-0161
// already rejects for the transports out of this seam too.
import { ValidationError } from "@caisson/kernel";

/** The default entitlement slug gating the compliance prompt (the `compliance` edition, from
 *  registry-schema's EDITIONS). Overridable so the operator can remap it to whatever SKU lands. */
export const DEFAULT_COMPLIANCE_ENTITLEMENT = "compliance";

// The compliance-edition module list this prompt tells the buyer to generate. It MIRRORS the
// compliance edition's membership and must be updated whenever that membership changes — the prompt
// should never recommend a set that drifts from what the edition actually ships.
const COMPLIANCE_MODULES = [
  "@caisson/compliance",
  "@caisson/audit-worm",
  "@caisson/field-crypto",
] as const;

// Frameworks the walkthrough can tailor its pointer to — a small closed set validated in-handler.
// Advisory strings only (no OSCAL frameworkId import); extend deliberately alongside the edition.
const FRAMEWORKS = ["soc2", "hipaa"] as const;

/**
 * The minimal slice of the prompt seam this module drives — just prompt registration. `McpServer`
 * (from `server.ts`) is structurally assignable to this, so this module never imports the server.
 */
export interface CompliancePromptRegistrar {
  registerPrompt(registration: {
    name: string;
    requiredEntitlement: string | null;
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

export interface CompliancePromptOptions {
  /** Edition entitlement gating the prompt. Default `"compliance"`. */
  readonly requiredEntitlement?: string;
}

/**
 * Register the compliance-edition prompt on `server` through the prompt seam. Gated on the
 * `compliance` entitlement (the seam re-checks it timing-safe per get) and invisible (404) to a
 * non-entitled buyer.
 */
export function registerCompliancePrompts(
  server: CompliancePromptRegistrar,
  options: CompliancePromptOptions,
): void {
  const requiredEntitlement =
    options.requiredEntitlement ?? DEFAULT_COMPLIANCE_ENTITLEMENT;

  server.registerPrompt({
    name: "compliance_evidence_walkthrough",
    requiredEntitlement,
    description:
      "Walk through generating a compliance-edition project and where evidence assembly lives.",
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
      const text = [
        `Generate a ${framework.toUpperCase()} compliance-edition project scaffold for "${projectName}".`,
        "",
        "1. Generate the compliance edition — call the generate tool:",
        JSON.stringify(
          {
            projectName,
            edition: "compliance",
            modules: COMPLIANCE_MODULES.map((id) => ({
              id,
              version: "latest",
            })),
          },
          null,
          2,
        ),
        "   generate validates every module against the registry allowlist and your entitlements, then debits credits and writes the scaffold.",
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
