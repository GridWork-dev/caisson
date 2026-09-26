// Server Action example: enqueuing a job (@caisson-sh/jobs `JobQueue.enqueue`) instead of sending
// email inline — the caller returns immediately, the queue's driver retries the send on failure.
"use server";

import { z } from "zod";
import { queue } from "../../lib/jobs";

const NotifyInput = z.object({ email: z.string().email() }).strict();

export async function notifySignup(input: unknown): Promise<void> {
  const { email } = NotifyInput.parse(input);
  await queue.enqueue("send-welcome-email", { to: email });
}
