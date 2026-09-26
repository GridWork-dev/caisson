import { describe, expect, test } from "bun:test";
import { GuardrailError, InMemoryEventSink } from "@caisson-sh/kernel";
import { ConfigError } from "@caisson-sh/kernel";
import { guardInputAsync, guardOutput } from "./browser.ts";
import type { BrowserGuardPolicy } from "./guard-browser.ts";
import type { BrowserPiiCryptoContext } from "./pii-browser.ts";
import { localModerator } from "./moderator.ts";

const fieldContext: BrowserPiiCryptoContext = {
  tenantId: "acct_a",
  masterKey: new Uint8Array(32).fill(0x11),
  salt: new Uint8Array(32).fill(0x22),
  currentVersion: 1,
};

function setup(policy: Partial<BrowserGuardPolicy> = {}) {
  const sink = new InMemoryEventSink();
  return {
    sink,
    policy: {
      policyName: "browser-default",
      moderator: localModerator([]),
      ...policy,
    } satisfies BrowserGuardPolicy,
    runtime: {
      tenantId: "acct_a",
      sink,
      now: () => new Date("2026-08-02T12:00:00.000Z"),
      newId: () => "00000000-0000-4000-8000-000000000000",
    },
  };
}

describe("browser guard", () => {
  test("runs the real async mask, hash, and reversible-tokenize paths", async () => {
    for (const mode of ["mask", "hash"] as const) {
      const { policy, runtime } = setup({ pii: { mode } });
      const outcome = await guardInputAsync("mail a@b.com", policy, runtime);
      expect(outcome.text).not.toContain("a@b.com");
      expect(outcome.tokens).toEqual([]);
    }
    const { policy, runtime } = setup({
      pii: { mode: "tokenize", ctx: fieldContext },
    });
    const outcome = await guardInputAsync("mail a@b.com", policy, runtime);
    expect(outcome.text).toContain("[[PII:email:0]]");
    expect(outcome.tokens).toHaveLength(1);
  });

  test("fails closed and emits metadata only on a moderator outage", async () => {
    const { policy, runtime, sink } = setup({
      moderator: {
        moderate() {
          throw new Error("offline");
        },
      },
    });
    await expect(
      guardInputAsync("private words", policy, runtime),
    ).rejects.toBeInstanceOf(GuardrailError);
    expect(sink.events[0]?.attributes).toEqual({
      blockId: "00000000-0000-4000-8000-000000000000",
      stage: "input",
      category: "moderation",
      policy: "browser-default",
      failClosed: true,
    });
    expect(JSON.stringify(sink.events[0])).not.toContain("private words");
  });

  test("the unconditional secret gate wins before the moderator", async () => {
    let called = false;
    const { policy, runtime } = setup({
      moderator: {
        moderate() {
          called = true;
          return { flagged: false, category: "moderation" };
        },
      },
    });
    await expect(
      guardInputAsync("Rotate AKIAIOSFODNN7EXAMPLE now", policy, runtime),
    ).rejects.toMatchObject({
      details: { stage: "input", category: "secret" },
    });
    expect(called).toBe(false);
  });

  test("rejects a runtime/PII-context tenant mismatch before moderation or telemetry", async () => {
    let moderatorCalls = 0;
    const { policy, runtime, sink } = setup({
      moderator: {
        moderate() {
          moderatorCalls += 1;
          return { flagged: false, category: "moderation" };
        },
      },
      pii: {
        mode: "tokenize",
        ctx: { ...fieldContext, tenantId: "acct_b" },
      },
    });
    await expect(
      guardInputAsync("mail a@b.com", policy, runtime),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(moderatorCalls).toBe(0);
    expect(sink.events).toEqual([]);
  });

  test("public browser guardOutput accepts an inline PII-bearing browser policy", async () => {
    const { runtime } = setup();
    await expect(
      guardOutput(
        "clean output",
        {
          policyName: "inline-browser",
          moderator: localModerator([]),
          pii: { mode: "hash" },
        },
        runtime,
      ),
    ).resolves.toBeUndefined();
  });
});
