// The LOCAL stdio-only discovery MCP (ADR-0330 Fork A / CR-09). The one unauthenticated tier this
// feature ships: a local process a trusted client (Claude Desktop/Code) spawns 1:1 — NO bearer, NO
// `authenticate`, NO network listener, ever. It does NOT go through `createMcpServer` (that path is
// fail-closed pre-auth); it wires the three READ handlers directly against the base manifest.
//
// STRICT-SUBSET INVARIANT (mandatory): this unauthenticated server resolves ONLY what is
// in the base manifest it is constructed with — `describeComponent` throws `NotFoundError` for any
// name not in that manifest. Because the runnable entry (`discovery-bin.ts`) only ever loads
// `loadBaseManifest()`, a `@caisson-sh/ui-pro` component is structurally unreachable here: it lives in
// the pro manifest, which this server is never handed. There is no check_usage, no pro tool, no
// generate — discovery only.
import {
  Server,
  type ServerOptions,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import {
  NotFoundError,
  parseStrict,
  strictObject,
  toErrorResponse,
} from "@caisson-sh/kernel";
import type { ComponentManifest } from "@caisson-sh/ds-manifest";
import {
  describeComponent,
  getTokens,
  listComponents,
  type DesignTokens,
} from "./manifest-tools.ts";

const DISCOVERY_VERSION = "1.0.0";

/** What the discovery server serves: the Apache-BASE manifest only, plus the design tokens. */
export interface DiscoveryServerDeps {
  readonly manifest: ComponentManifest;
  readonly tokens: DesignTokens;
}

const describeArgs = strictObject({ name: z.string().min(1).max(128) });

// Same three read tools + shapes as the authed base tools (one data layer) — MCP requires each
// listed tool's `inputSchema.type === "object"`; each handler still parses its own strict shape.
const READ_TOOLS = [
  {
    name: "list_components",
    description:
      "List the open @caisson-sh/ui components (name, one-line summary, typed variant props). No auth.",
  },
  {
    name: "describe_component",
    description:
      "Full metadata for one open @caisson-sh/ui component: props, variants, token deps, a11y + recipe notes.",
  },
  {
    name: "get_tokens",
    description:
      "The kit's design tokens (themes, functional colours, fonts) as JSON for agent theming.",
  },
] as const;
const PERMISSIVE_INPUT_SCHEMA = { type: "object" as const };

/**
 * Build (but do not connect) the discovery `Server`. Takes the low-level SDK `Server` (the tool set
 * is fixed and unauthenticated, so no dynamic per-caller listing is needed). Every tool result and
 * error renders through the same client-safe `toErrorResponse` envelope the authed transport uses.
 */
export function createDiscoveryServer(deps: DiscoveryServerDeps): Server {
  const options: ServerOptions = { capabilities: { tools: {} } };
  const server = new Server(
    { name: "caisson-ds-discovery", version: DISCOVERY_VERSION },
    options,
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: READ_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: PERMISSIVE_INPUT_SCHEMA,
    })),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<CallToolResult> => {
      try {
        const { name, arguments: rawArgs } = request.params;
        let result: unknown;
        if (name === "list_components") {
          result = listComponents(deps.manifest);
        } else if (name === "describe_component") {
          const { name: component } = parseStrict(describeArgs, rawArgs ?? {});
          result = describeComponent(deps.manifest, component);
        } else if (name === "get_tokens") {
          result = getTokens(deps.tokens);
        } else {
          // Any other tool name — including a pro tool — does not exist on this server.
          throw new NotFoundError(`Unknown tool: ${name}`);
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        const { body } = toErrorResponse(err);
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(body) }],
        };
      }
    },
  );

  return server;
}

/**
 * Connect the discovery server to a transport (default: real process stdin/stdout). The transport
 * is injectable (`InMemoryTransport.createLinkedPair()`) so tests drive it without an OS pipe.
 */
export async function runDiscoveryServer(
  deps: DiscoveryServerDeps,
  transport: Transport = new StdioServerTransport(),
): Promise<Server> {
  const server = createDiscoveryServer(deps);
  await server.connect(transport);
  return server;
}
