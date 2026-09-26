import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AiSettings } from "@caisson-sh/ai-config";
import { AI_METER_SCHEMA_SQL, type MeterConfig } from "@caisson-sh/ai-meter";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  grant,
} from "@caisson-sh/credits";
import {
  FIELD_CRYPTO_KEY_SCHEMA_SQL,
  InMemoryWrappedKeyStore,
  KmsKeyProvider,
  PgWrappedKeyStore,
  type KmsClient,
  withKmsFieldCryptoContext,
} from "@caisson-sh/field-crypto";
import { localModerator } from "@caisson-sh/guardrails";
import {
  InMemoryEventSink,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson-sh/kernel";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import type {
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import type { LoopTool } from "./agent-loop.ts";
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
const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-07-26T12:00:00Z"),
};

let testPg: TestPg;

beforeAll(async () => {
  testPg = await newTestPg();
  await testPg.exec(CREDIT_SCHEMA_SQL);
  await testPg.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await testPg.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await testPg.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await testPg.exec(AI_METER_SCHEMA_SQL);
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
  await testPg.exec(FIELD_CRYPTO_KEY_SCHEMA_SQL);
});

afterAll(async () => {
  await testPg.close();
});

describe("MCP run tools field-crypto context", () => {
  test("run_status never acquires a KMS context", async () => {
    let contextRuns = 0;
    const tools = buildRunTools({
      ...baseDeps(() => {
        throw new Error("run_status must not resolve a model");
      }),
      fieldCryptoContext: async () => {
        contextRuns += 1;
        throw new Error("run_status must not acquire a KMS context");
      },
    });

    const status = await tools.runStatus({
      accountId: ACCOUNT_ID,
      args: { runId: "missing-run" },
    });

    expect(status.runState).toBeUndefined();
    expect(status.projection.status).toBe("pending");
    expect(contextRuns).toBe(0);
  });

  test("a run that completes without parking never acquires a KMS context", async () => {
    await seedCredits(ACCOUNT_ID);
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult("done"),
    });
    let contextRuns = 0;
    const tools = buildRunTools({
      ...baseDeps(() => model, {}, ACCOUNT_ID),
      fieldCryptoContext: async () => {
        contextRuns += 1;
        throw new Error("a completed run must not acquire a KMS context");
      },
    });

    const result = await tools.runStart({
      accountId: ACCOUNT_ID,
      args: { prompt: "finish without tools" },
    });

    expect(result.status).toBe("completed");
    expect(result.text).toBe("done");
    expect(contextRuns).toBe(0);
  });

  test("the first park acquires one KMS context and zeroizes it after sealing", async () => {
    const parkedAccount = `${ACCOUNT_ID}_park`;
    await seedCredits(parkedAccount);
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
    await provider.ensureProvisioned(parkedAccount);
    let activeDuringCallback = false;
    let contextRuns = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCallResult("call-1"),
    });

    const tools = buildRunTools({
      ...baseDeps(() => model, GATED_TOOLS, parkedAccount),
      fieldCryptoContext: (accountId, fn) =>
        withTenant(testPg.pg, accountId, (exec) =>
          withKmsFieldCryptoContext(provider, accountId, async (ctx) => {
            contextRuns += 1;
            // ADR-0393: the key is lent for the callback only and wiped on return, so the liveness
            // check has to happen INSIDE the lend — reading it afterwards would only see zeroes.
            activeDuringCallback = ctx.withKey(1, (key) =>
              key.every((byte) => byte === 0x31),
            );
            return fn(exec, ctx);
          }),
        ),
    });

    const result = await tools.runStart({
      accountId: parkedAccount,
      args: { prompt: "use the gated tool" },
    });

    expect(result.status).toBe("parked");
    expect(activeDuringCallback).toBe(true);
    expect(contextRuns).toBe(1);
    expect(unwrapped).toHaveLength(1);
    expect(unwrapped[0]?.every((byte) => byte === 0)).toBe(true);
  });

  test("the production-shaped runner shares one tenant transaction for wrapped keys and parked state", async () => {
    const accountId = `${ACCOUNT_ID}_atomic`;
    await seedCredits(accountId);
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCallResult("call-atomic"),
    });
    const kms: KmsClient = {
      async generateDataKey() {
        return {
          plaintextKey: Buffer.alloc(32, 0x41),
          wrappedKey: Buffer.from([0x41]),
        };
      },
      async decryptDataKey() {
        return Buffer.alloc(32, 0x41);
      },
      async scheduleKeyDeletion() {
        return { state: "soft-deleted", irreversible: false };
      },
    };
    let transactionActive = false;
    const guardedTx: Transactor = {
      async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
        if (transactionActive) throw new Error("nested tenant transaction");
        transactionActive = true;
        try {
          return await testPg.pg.transaction((tx) =>
            fn(tx as unknown as TenantExecutor),
          );
        } finally {
          transactionActive = false;
        }
      },
    };
    const tools = buildRunTools({
      ...baseDeps(() => model, GATED_TOOLS, accountId),
      tx: guardedTx,
      fieldCryptoContext: (requestedAccountId, fn) =>
        withTenant(guardedTx, requestedAccountId, async (exec) => {
          const provider = new KmsKeyProvider(kms, new PgWrappedKeyStore(exec));
          await provider.ensureProvisioned(requestedAccountId);
          return withKmsFieldCryptoContext(
            provider,
            requestedAccountId,
            (ctx) => fn(exec, ctx),
          );
        }),
    });

    await expect(
      tools.runStart({
        accountId,
        args: { prompt: "park atomically" },
      }),
    ).resolves.toMatchObject({ status: "parked" });

    const rows = await withTenant(testPg.pg, accountId, (exec) =>
      exec.query<{ wrapped_count: string; parked_count: string }>(
        `SELECT
           (SELECT count(*)::text FROM field_wrapped_dek) AS wrapped_count,
           (SELECT count(*)::text FROM agent_run_state WHERE parked_state IS NOT NULL) AS parked_count`,
      ),
    );
    expect(rows.rows[0]).toEqual({
      wrapped_count: "1",
      parked_count: "1",
    });
  });
});

function sdkUsage(
  inputTokens: number,
  outputTokens: number,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: inputTokens,
      noCache: inputTokens,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
  };
}

function textResult(text: string) {
  return {
    finishReason: {
      unified: "stop",
      raw: "stop",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 20),
    content: [{ type: "text" as const, text }],
    warnings: [],
  };
}

function toolCallResult(toolCallId: string) {
  return {
    finishReason: {
      unified: "tool-calls",
      raw: "tool-calls",
    } as LanguageModelV4FinishReason,
    usage: sdkUsage(10, 5),
    content: [
      {
        type: "tool-call" as const,
        toolCallId,
        toolName: "gated",
        input: JSON.stringify({ value: "test" }),
      },
    ],
    warnings: [],
  };
}

const GATED_TOOLS: Readonly<Record<string, LoopTool>> = {
  gated: {
    description: "requires approval",
    inputSchema: z.object({ value: z.string() }),
    execute: async (input) => input,
    approvalRequired: true,
  },
};

function baseDeps(
  resolveModel: () => MockLanguageModelV4,
  tools: Readonly<Record<string, LoopTool>> = {},
  accountId = ACCOUNT_ID,
) {
  return {
    tx: testPg.pg,
    settings: SETTINGS,
    resolveModel,
    guard: {
      policy: {
        policyName: "test",
        moderator: localModerator([]),
      },
      runtime: {
        tenantId: accountId,
        sink: new InMemoryEventSink(),
      },
    },
    meter: METER,
    lane: "default",
    agentId: "test-agent",
    tools,
    maxSteps: 1,
    creditBudget: 10,
    maxOutputTokens: 50,
  };
}

async function seedCredits(accountId: string): Promise<void> {
  await withTenant(testPg.pg, accountId, (tx) =>
    grant(tx, {
      accountId,
      amount: asCredits(100),
      eventType: "purchase",
      sourceEventId: `seed-${accountId}`,
    }),
  );
}
