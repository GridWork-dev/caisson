import { createHash } from "node:crypto";
import type { Inngest } from "inngest";
import { z } from "zod";
import { NotFoundError, parseStrict, strictObject } from "@caisson/kernel";
import {
  type EnqueueOptions,
  type JobConsumer,
  type JobQueue,
  type TaskDefinition,
  type WorkHandle,
} from "./queue.ts";

export type InngestClient = Pick<Inngest, "createFunction" | "send">;

export interface InngestJobQueueConfig {
  client: InngestClient;
}

function isInngestClient(value: unknown): value is InngestClient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.send === "function" &&
    typeof candidate.createFunction === "function"
  );
}

const inngestJobQueueConfigSchema = strictObject({
  client: z.custom<InngestClient>(isInngestClient, {
    message: "client must implement Inngest v4 send() and createFunction()",
  }),
});

function eventId(name: string, idempotencyKey: string): string {
  return createHash("sha256")
    .update(name)
    .update("\0")
    .update(idempotencyKey)
    .digest("hex");
}

export function createInngestJobQueue(
  tasks: readonly TaskDefinition<unknown>[],
  config: InngestJobQueueConfig,
): JobQueue & JobConsumer {
  const validatedConfig = parseStrict(inngestJobQueueConfigSchema, config);

  const registry = new Map<string, TaskDefinition<unknown>>(
    tasks.map((task) => [task.name, task]),
  );
  for (const task of tasks) {
    validatedConfig.client.createFunction(
      {
        id: task.name,
        triggers: [{ event: task.name }],
      },
      async (input: { event: { data?: unknown } }): Promise<void> => {
        await task.handler(parseStrict(task.schema, input.event.data));
      },
    );
  }

  return {
    async enqueue(
      name: string,
      payload: unknown,
      options?: EnqueueOptions,
    ): Promise<void> {
      const task = registry.get(name);
      if (task === undefined) {
        throw new NotFoundError(`No task registered for "${name}"`, {
          task: name,
        });
      }
      const validated = parseStrict(task.schema, payload);
      await validatedConfig.client.send({
        name,
        data: validated,
        ...(options?.idempotencyKey !== undefined
          ? { id: eventId(name, options.idempotencyKey) }
          : {}),
      });
      // `singletonKey` is intentionally not fabricated here: Inngest overlap control belongs on
      // a function's concurrency config, which cannot safely derive a generic expression from an
      // arbitrary task payload. This matches Trigger.dev's honest no-op posture.
    },

    async work(name: string): Promise<WorkHandle> {
      if (registry.has(name)) {
        return {
          async stop(): Promise<void> {},
        };
      }
      throw new NotFoundError(`No task registered for "${name}"`, {
        task: name,
      });
    },
  };
}
