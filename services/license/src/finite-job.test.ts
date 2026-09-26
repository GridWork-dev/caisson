import { expect, test } from "bun:test";
import type { JobAlertingDeps } from "@caisson/jobs";
import { runAlertedFiniteJob } from "./finite-job.ts";

test("alert delivery failure never masks the finite job's original failure", async () => {
  const original = new Error("job failed");
  const reported: string[] = [];
  const alerting: JobAlertingDeps = {
    async reportTaskFailure(taskName): Promise<void> {
      reported.push(taskName);
      throw new Error("alert transport failed");
    },
    async reportInfraError(): Promise<void> {},
  };

  await expect(
    runAlertedFiniteJob("credits.expiry_tick", alerting, async () => {
      throw original;
    }),
  ).rejects.toBe(original);
  expect(reported).toEqual(["credits.expiry_tick"]);
});
