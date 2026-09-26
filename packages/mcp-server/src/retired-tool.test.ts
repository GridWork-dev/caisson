// ADR-0216: the retired-tool ledger distinguishes "we killed it" from "it never existed". A hit on
// `retireTool`'s ledger answers `RetiredToolError` (410, {reason, retiredAt}) from `handleToolCall`
// — a truly-unknown name still answers the ordinary `NotFoundError` (404). `retireTool` itself is
// fail-closed and append-only: a name is exactly one of active/retired/unknown, never two at once,
// and there is no `unretireTool`.
import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { createMcpServer, RetiredToolError } from "./index.ts";

// A minimal but VALID built index — these tests never call `generate`.
const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/auth",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/auth",
            version: "0.1.0",
            kind: "base",
            editions: [],
            tier: "paid",
            priceCents: 4900,
            license: "LicenseRef-Caisson-Commercial",
            description: "Fixture module.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

function makeServer() {
  return createMcpServer({
    tokens: [
      {
        token: "tok_retired_x0000000000000000",
        accountId: "acct_retired",
      },
    ],
    index,
    onGenerate: async () => ({ generationId: "gen_retired" }),
  });
}

describe("retired-tool ledger (ADR-0216)", () => {
  test("a retired tool answers 410 tool_retired with reason + retiredAt", async () => {
    const server = makeServer();
    server.retireTool({
      name: "old_generate_v1",
      reason: "Superseded by generate v2 — the {id, version} shape.",
      retiredAt: "2026-06-01T00:00:00.000Z",
    });
    const session = server.authenticate("tok_retired_x0000000000000000");

    let err: unknown;
    try {
      await server.handleToolCall(session, "old_generate_v1", {});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RetiredToolError);
    const retired = err as RetiredToolError;
    expect(retired.code).toBe("tool_retired");
    expect(retired.httpStatus).toBe(410);
    expect(retired.details).toEqual({
      reason: "Superseded by generate v2 — the {id, version} shape.",
      retiredAt: "2026-06-01T00:00:00.000Z",
    });
  });

  test("a truly-unknown tool is still a plain 404 — retired and unknown are distinguishable", async () => {
    const server = makeServer();
    server.retireTool({
      name: "old_generate_v1",
      reason: "Superseded.",
      retiredAt: "2026-06-01T00:00:00.000Z",
    });
    const session = server.authenticate("tok_retired_x0000000000000000");

    await expect(
      server.handleToolCall(session, "never_existed", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    // A NotFoundError is not a RetiredToolError — the two error shapes never collide.
    await expect(
      server.handleToolCall(session, "never_existed", {}),
    ).rejects.not.toBeInstanceOf(RetiredToolError);
  });

  test("retiring the same name twice is rejected (append-only, fail-closed)", () => {
    const server = makeServer();
    server.retireTool({
      name: "old_tool",
      reason: "First retirement.",
      retiredAt: "2026-06-01T00:00:00.000Z",
    });
    expect(() =>
      server.retireTool({
        name: "old_tool",
        reason: "Second retirement attempt.",
        retiredAt: "2026-06-02T00:00:00.000Z",
      }),
    ).toThrow(ValidationError);
  });

  test("retiring a currently-active (registered) tool name is rejected", () => {
    const server = makeServer();
    // "list_modules" is one of the 3 base tools — currently active in the registry.
    expect(() =>
      server.retireTool({
        name: "list_modules",
        reason: "Attempting to retire a live tool.",
        retiredAt: "2026-06-01T00:00:00.000Z",
      }),
    ).toThrow(ValidationError);
  });

  test("a retired name never appears in listTools", () => {
    const server = makeServer();
    server.retireTool({
      name: "old_generate_v1",
      reason: "Superseded.",
      retiredAt: "2026-06-01T00:00:00.000Z",
    });
    const session = server.authenticate("tok_retired_x0000000000000000");
    const names = server.listTools(session).map((reg) => reg.name);
    expect(names).not.toContain("old_generate_v1");
  });
});
