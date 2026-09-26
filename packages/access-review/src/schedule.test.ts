// src/schedule.test.ts — campaign task wiring on `@caisson-sh/jobs` (ADR-0371). Full open/close
// execution against a real tenant DB + chain is proven in campaign.integration.test.ts; this file
// pins the queue-facing contract only — task names + the overlap-safe singleton keys, the same
// scope @caisson-sh/retention-runner's schedule.test.ts pins for its own sweep task.
import { describe, expect, test } from "bun:test";
import type { EnqueueOptions, JobQueue } from "@caisson-sh/jobs";
import type { CampaignDeps } from "./campaign.ts";
import {
  CAMPAIGN_CLOSE_TASK,
  CAMPAIGN_OPEN_TASK,
  defineCampaignCloseTask,
  defineCampaignOpenTask,
  enqueueCampaignClose,
  enqueueCampaignOpen,
} from "./schedule.ts";

/** A `JobQueue` that records every enqueue instead of running it — asserts the options passed. */
function recordingQueue(): JobQueue & {
  readonly calls: ReadonlyArray<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }>;
} {
  const calls: Array<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }> = [];
  return {
    calls,
    async enqueue(name, payload, options) {
      calls.push({ name, payload, options });
    },
  };
}

const ACCOUNT = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const CAMPAIGN = "1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("defineCampaignOpenTask / defineCampaignCloseTask", () => {
  test("carry the expected task names", () => {
    // `deps` is never invoked here — this only inspects the returned TaskDefinition's `.name`.
    const deps = {} as CampaignDeps;
    expect(defineCampaignOpenTask(deps).name).toBe(CAMPAIGN_OPEN_TASK);
    expect(defineCampaignCloseTask(deps).name).toBe(CAMPAIGN_CLOSE_TASK);
  });
});

describe("enqueueCampaignOpen — overlap-safe per (tenant, reviewer)", () => {
  test("sets the singleton key", async () => {
    const q = recordingQueue();
    await enqueueCampaignOpen(q, {
      accountId: ACCOUNT,
      reviewerId: "reviewer-9",
      reviewees: ["user-1"],
      deadlineMs: 1000,
    });
    expect(q.calls).toEqual([
      {
        name: CAMPAIGN_OPEN_TASK,
        payload: {
          accountId: ACCOUNT,
          reviewerId: "reviewer-9",
          reviewees: ["user-1"],
          deadlineMs: 1000,
        },
        options: { singletonKey: `${ACCOUNT}:reviewer-9` },
      },
    ]);
  });
});

describe("enqueueCampaignClose — overlap-safe per (tenant, campaign)", () => {
  test("sets the singleton key", async () => {
    const q = recordingQueue();
    await enqueueCampaignClose(q, { accountId: ACCOUNT, campaignId: CAMPAIGN });
    expect(q.calls).toEqual([
      {
        name: CAMPAIGN_CLOSE_TASK,
        payload: { accountId: ACCOUNT, campaignId: CAMPAIGN },
        options: { singletonKey: `${ACCOUNT}:${CAMPAIGN}` },
      },
    ]);
  });
});
