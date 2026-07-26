import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AiSettings } from "@caisson/ai-config";
import {
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  type KmsClient,
  withKmsFieldCryptoContext,
} from "@caisson/field-crypto";
import { localModerator } from "@caisson/guardrails";
import { InMemoryEventSink } from "@caisson/kernel";
import { newTestPg, type TestPg } from "@caisson/testing";
import { buildRunTools } from "./mcp-run-tools.ts";

const ACCOUNT_ID = "acct_mcp_run_kms";
const SETTINGS: AiSettings = {
  defaultLane: "default",
  lanes: {
    default: {
      provider: "openai",
      model: "model",
      apiKeyEnv: "OPENAI_API_KEY",
    },
  },
};

let testPg: TestPg;

beforeAll(async () => {
  testPg = await newTestPg();
  const trajectory = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0001_trajectory_event.sql",
      import.meta.url,
    ),
  ).text();
  const runState = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0002_agent_run_state.sql",
      import.meta.url,
    ),
  ).text();
  const encryptedRunState = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0003_agent_run_state_parked_state_encrypted.sql",
      import.meta.url,
    ),
  ).text();
  await testPg.exec(trajectory);
  await testPg.exec(runState);
  await testPg.exec(encryptedRunState);
});

afterAll(async () => {
  await testPg.close();
});

describe("MCP run tools field-crypto context", () => {
  test("holds the KMS context for run_status and zeroizes it after the callback", async () => {
    const unwrapped: Buffer[] = [];
    const kms: KmsClient = {
      async generateDataKey() {
        return {
          plaintextKey: Buffer.alloc(32, 0x31),
          wrappedKey: Buffer.from([0x31]),
        };
      },
      async decryptDataKey() {
        const key = Buffer.alloc(32, 0x31);
        unwrapped.push(key);
        return key;
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    const provider = new KmsKeyProvider(kms, new InMemoryWrappedKeyStore());
    await provider.ensureProvisioned(ACCOUNT_ID);
    let activeDuringCallback = false;

    const tools = buildRunTools({
      tx: testPg.pg,
      settings: SETTINGS,
      resolveModel: () => {
        throw new Error("run_status must not resolve a model");
      },
      guard: {
        policy: {
          policyName: "test",
          moderator: localModerator([]),
        },
        runtime: {
          tenantId: ACCOUNT_ID,
          sink: new InMemoryEventSink(),
        },
      },
      lane: "default",
      agentId: "test-agent",
      tools: {},
      maxSteps: 1,
      creditBudget: 1,
      fieldCryptoContext: (accountId, fn) =>
        withKmsFieldCryptoContext(provider, accountId, async (ctx) => {
          const workingKey = ctx.deriveKey(1);
          activeDuringCallback = workingKey.every((byte) => byte === 0x31);
          workingKey.fill(0);
          return fn(ctx);
        }),
    });

    const status = await tools.runStatus({
      accountId: ACCOUNT_ID,
      args: { runId: "missing-run" },
    });

    expect(status.runState).toBeUndefined();
    expect(status.projection.status).toBe("pending");
    expect(activeDuringCallback).toBe(true);
    expect(unwrapped).toHaveLength(1);
    expect(unwrapped[0]?.every((byte) => byte === 0)).toBe(true);
  });
});
