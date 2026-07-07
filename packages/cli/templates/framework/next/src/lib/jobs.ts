// Background jobs via the `@caisson/jobs` `JobQueue` port. `createInMemoryQueue` runs a task's
// handler inline (synchronous, no daemon) — fine for dev/tests, and every caller only ever depends
// on the `JobQueue` port, so swapping in the durable pg-boss/Trigger.dev driver later is a config
// change, not a rewrite.
import { z } from "zod";
import { createInMemoryQueue, defineTask } from "@caisson/jobs";
import type { JobQueue } from "@caisson/jobs";
import { sendWelcomeEmail } from "./email";

const sendWelcomeEmailTask = defineTask(
  "send-welcome-email",
  z.object({ to: z.string().email() }).strict(),
  async (payload) => {
    await sendWelcomeEmail(payload.to);
  },
);

export const queue: JobQueue = createInMemoryQueue([sendWelcomeEmailTask]);
