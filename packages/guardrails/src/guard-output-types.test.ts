import { describe, expect, test } from "bun:test";
import { localModerator } from "./moderator.ts";
import type { guardOutput as nodeGuardOutput } from "./guard.ts";
import type { guardOutput as browserGuardOutput } from "./browser.ts";

const nodeInlinePolicy = {
  policyName: "inline-node",
  moderator: localModerator([]),
  pii: { mode: "mask" },
} satisfies Parameters<typeof nodeGuardOutput>[1];

const browserInlinePolicy = {
  policyName: "inline-browser",
  moderator: localModerator([]),
  pii: { mode: "hash" },
} satisfies Parameters<typeof browserGuardOutput>[1];

describe("guardOutput public policy compatibility", () => {
  test("inline PII fields remain source-compatible on both entries", () => {
    expect(nodeInlinePolicy.pii.mode).toBe("mask");
    expect(browserInlinePolicy.pii.mode).toBe("hash");
  });
});
