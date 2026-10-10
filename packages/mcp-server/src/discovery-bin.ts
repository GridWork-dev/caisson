// Runnable entry for the local stdio discovery MCP (ADR-0330 Fork A). An agent configures this as a
// local MCP server (see README "Local design-system discovery MCP"): it loads the committed
// Apache-base manifest and the kit's real tokens and serves read-only discovery over stdin/stdout —
// no bearer, no env token, no network. This is the one place the base manifest + `@caisson-sh/ui/tokens`
// are wired together for production; `discovery-stdio.ts` stays dependency-injected for tests.
import {
  darkTheme,
  fonts,
  functionalDark,
  functionalLight,
  lightTheme,
} from "@caisson-sh/ui/tokens";
import { loadBaseManifest } from "@caisson-sh/ds-manifest";
import { isMainModule } from "@caisson-sh/kernel/node";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  runDiscoveryServer,
  type DiscoveryServerDeps,
} from "./discovery-stdio.ts";
import type { DesignTokens } from "./manifest-tools.ts";

/** Assemble the discovery deps from the committed base manifest + the real `@caisson-sh/ui` tokens. */
export function discoveryDeps(): DiscoveryServerDeps {
  const tokens: DesignTokens = {
    themes: { dark: darkTheme, light: lightTheme },
    functional: { dark: functionalDark, light: functionalLight },
    fonts: { sans: fonts.sans, mono: fonts.mono },
  };
  return { manifest: loadBaseManifest(), tokens };
}

/** Start the discovery server (default: real stdio; injectable transport for tests). */
export function startDiscovery(transport?: Transport): Promise<Server> {
  return runDiscoveryServer(discoveryDeps(), transport);
}

if (isMainModule(import.meta)) {
  void startDiscovery();
}
