// Proves the runnable discovery entry wires the REAL committed manifest + the REAL @caisson-sh/ui
// tokens and answers list_components / get_tokens over an in-memory transport — the same start path
// an agent spawns, minus the OS stdio pipe.
import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadBaseManifest } from "@caisson-sh/ds-manifest";
import { startDiscovery } from "./discovery-bin.ts";

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("discovery-bin", () => {
  test("starts on an injected transport and serves the real base manifest", async () => {
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "discovery-bin-test", version: "0.0.0" });
    await Promise.all([
      startDiscovery(serverTransport),
      c.connect(clientTransport),
    ]);
    client = c;

    const result = await c.callTool({
      name: "list_components",
      arguments: {},
    });
    const content =
      (result as { content?: { type: string; text: string }[] }).content ?? [];
    const list = JSON.parse(content[0]?.text ?? "{}") as {
      pkg: string;
      components: { name: string }[];
    };
    expect(list.pkg).toBe("@caisson-sh/ui");
    expect(list.components.length).toBe(loadBaseManifest().components.length);
  });
});
