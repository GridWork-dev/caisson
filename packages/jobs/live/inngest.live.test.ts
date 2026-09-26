// Real Inngest v4 event-send proof. This file is outside ./src and self-skips unless the caller
// explicitly opts in with CAISSON_INNGEST_LIVE=1 and injects CAISSON_INNGEST_LIVE_EVENT_KEY.
// It sends one UUID-scoped event through the real SDK and adapter; no credential is read by
// createInngestJobQueue itself.
import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { Inngest } from "inngest";
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";
import { createInngestJobQueue, defineTask } from "../src/index.ts";

const OPT_IN = process.env.CAISSON_INNGEST_LIVE ?? "";
const EVENT_KEY = process.env.CAISSON_INNGEST_LIVE_EVENT_KEY ?? "";
const HAVE_CREDS = OPT_IN === "1" && EVENT_KEY.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);

liveTest(
  "sends a schema-validated event through Inngest v4",
  async () => {
    const runId = randomUUID();
    const client = new Inngest({
      id: "caisson-jobs-live-proof",
      eventKey: EVENT_KEY,
      isDev: false,
    });
    const queue = createInngestJobQueue(
      [
        defineTask(
          "caisson/jobs.live-proof",
          strictObject({ runId: z.string().uuid() }),
          async () => {},
        ),
      ],
      { client },
    );

    await expect(
      queue.enqueue(
        "caisson/jobs.live-proof",
        { runId },
        { idempotencyKey: runId },
      ),
    ).resolves.toBeUndefined();
  },
  30_000,
);
