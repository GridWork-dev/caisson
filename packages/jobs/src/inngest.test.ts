import { expect, test } from "bun:test";
import { Inngest } from "inngest";
import { z } from "zod";
import {
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson-sh/kernel";
import { defineTask } from "./queue.ts";
import {
  createInngestJobQueue,
  type InngestClient,
  type InngestJobQueueConfig,
} from "./inngest.ts";

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function createSdkClient(): {
  readonly client: Inngest;
  readonly calls: readonly FetchCall[];
} {
  const calls: FetchCall[] = [];
  const testFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init });
    return Response.json({ ids: ["evt_test"], status: 200 });
  }) as unknown as typeof fetch;
  return {
    client: new Inngest({
      id: "caisson-jobs-test",
      eventKey: "test-event-key",
      fetch: testFetch,
      isDev: false,
    }),
    calls,
  };
}

type CapturedHandler = (input: { event: { data: unknown } }) => Promise<void>;

function createCapturingClient(): {
  readonly client: InngestClient;
  readonly handlers: readonly CapturedHandler[];
  readonly functionOptions: readonly unknown[];
  readonly sentEvents: readonly unknown[];
} {
  const handlers: CapturedHandler[] = [];
  const functionOptions: unknown[] = [];
  const sentEvents: unknown[] = [];
  const send = (async (event: unknown) => {
    sentEvents.push(event);
    return { ids: ["evt_test"] };
  }) as Inngest["send"];
  const createFunction = ((options: unknown, handler: unknown): object => {
    functionOptions.push(options);
    handlers.push(handler as CapturedHandler);
    return {};
  }) as unknown as Inngest["createFunction"];
  return {
    client: { send, createFunction },
    handlers,
    functionOptions,
    sentEvents,
  };
}

test("exports an Inngest v4 JobQueue factory", async () => {
  const jobs = await import("./index.ts");

  expect("createInngestJobQueue" in jobs).toBe(true);
});

test("constructs from an injected Inngest v4 client", () => {
  const client = new Inngest({
    id: "caisson-jobs-test",
    eventKey: "test-event-key",
    isDev: false,
  });

  expect(() =>
    Reflect.apply(createInngestJobQueue, undefined, [[], { client }]),
  ).not.toThrow();
});

test("registers task functions and enqueue sends a validated event without running inline", async () => {
  const sdk = createSdkClient();
  let handled = 0;
  const queue = createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({
          accountId: z.string(),
          amount: z.number().int(),
        }),
        async () => {
          handled += 1;
        },
      ),
    ],
    { client: sdk.client },
  );

  expect(sdk.client.funcs.map((fn) => fn.id())).toEqual(["grant-credits"]);

  await queue.enqueue("grant-credits", {
    accountId: "acct_a",
    amount: 100,
  });

  expect(handled).toBe(0);
  expect(sdk.calls).toHaveLength(1);
  expect(JSON.parse(String(sdk.calls[0]?.init?.body)) as unknown).toMatchObject(
    [
      {
        name: "grant-credits",
        data: {
          payload: { accountId: "acct_a", amount: 100 },
        },
      },
    ],
  );
});

test("rejects a schema-invalid payload before sending an event", async () => {
  const sdk = createSdkClient();
  const queue = createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({
          accountId: z.string(),
          amount: z.number().int(),
        }),
        async () => {},
      ),
    ],
    { client: sdk.client },
  );

  await expect(
    queue.enqueue("grant-credits", {
      accountId: "acct_a",
      amount: "100",
    }),
  ).rejects.toThrow(ValidationError);
  expect(sdk.calls).toHaveLength(0);
});

test("rejects an unregistered task before sending an event", async () => {
  const sdk = createSdkClient();
  const queue = createInngestJobQueue([], { client: sdk.client });

  await expect(queue.enqueue("missing", {})).rejects.toThrow(NotFoundError);
  expect(sdk.calls).toHaveLength(0);
});

test("scopes Inngest's globally unique event id to task + idempotencyKey", async () => {
  const sdk = createSdkClient();
  const queue = createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async () => {},
      ),
      defineTask(
        "revoke-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async () => {},
      ),
    ],
    { client: sdk.client },
  );

  await queue.enqueue(
    "grant-credits",
    { accountId: "acct_a", amount: 1 },
    { idempotencyKey: "retry-1" },
  );
  await queue.enqueue(
    "revoke-credits",
    { accountId: "acct_a", amount: 1 },
    { idempotencyKey: "retry-1" },
  );

  const grant = JSON.parse(String(sdk.calls[0]?.init?.body)) as Array<{
    id: string;
  }>;
  const revoke = JSON.parse(String(sdk.calls[1]?.init?.body)) as Array<{
    id: string;
  }>;
  expect(grant[0]?.id).not.toBe("retry-1");
  expect(grant[0]?.id).not.toBe(revoke[0]?.id);
});

test("work returns a stoppable no-op handle because Inngest owns the registered consumer", async () => {
  const sdk = createSdkClient();
  const queue = createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async () => {},
      ),
    ],
    { client: sdk.client },
  );

  const handle = await queue.work("grant-credits");
  await expect(handle.stop()).resolves.toBeUndefined();
});

test("work rejects an unregistered task", async () => {
  const sdk = createSdkClient();
  const queue = createInngestJobQueue([], { client: sdk.client });

  await expect(queue.work("missing")).rejects.toThrow(NotFoundError);
});

test("validates the injected-client config as a strict boundary", () => {
  const sdk = createSdkClient();

  expect(() => createInngestJobQueue([], {} as InngestJobQueueConfig)).toThrow(
    ValidationError,
  );
  expect(() =>
    createInngestJobQueue([], {
      client: sdk.client,
      ambientEventKey: "must-not-be-read-here",
    } as unknown as InngestJobQueueConfig),
  ).toThrow(ValidationError);
});

test("validates a delivered Inngest event before invoking the task handler", async () => {
  const captured = createCapturingClient();
  const received: unknown[] = [];
  createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async (payload) => {
          received.push(payload);
        },
      ),
    ],
    { client: captured.client },
  );
  const handler = captured.handlers[0];
  if (handler === undefined) throw new Error("task handler was not registered");

  await handler({
    event: {
      data: {
        payload: { accountId: "acct_a", amount: 5 },
      },
    },
  });
  expect(received).toEqual([{ accountId: "acct_a", amount: 5 }]);

  await expect(
    handler({
      event: {
        data: {
          payload: { accountId: "acct_a", amount: "5" },
        },
      },
    }),
  ).rejects.toThrow(ValidationError);

  await expect(
    handler({
      event: {
        data: {
          payload: { accountId: "acct_a", amount: 5 },
          attackerControlled: true,
        },
      },
    }),
  ).rejects.toThrow(ValidationError);
});

test("does not register Inngest's weaker active-run singleton as port conformance", () => {
  const captured = createCapturingClient();
  createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async () => {},
      ),
    ],
    { client: captured.client },
  );

  expect(captured.functionOptions).toEqual([
    {
      id: "grant-credits",
      triggers: [{ event: "grant-credits" }],
    },
  ]);
});

test("throws before send whenever singletonKey requests unsupported queued-or-active suppression", async () => {
  const captured = createCapturingClient();
  const queue = createInngestJobQueue(
    [
      defineTask(
        "grant-credits",
        strictObject({ accountId: z.string(), amount: z.number().int() }),
        async () => {},
      ),
    ],
    { client: captured.client },
  );

  await expect(
    queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { singletonKey: "tenant_a:subject_1" },
    ),
  ).rejects.toThrow(
    "Inngest v4 cannot honor the JobQueue queued-or-active singletonKey contract",
  );
  expect(captured.sentEvents).toEqual([]);
});
