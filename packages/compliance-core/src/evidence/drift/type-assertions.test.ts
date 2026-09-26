// src/evidence/drift/type-assertions.test.ts — WR-04: compile-time-only proof that the drift
// monitor's structural ports are genuinely assignable to the REAL @caisson-sh/jobs / @caisson-sh/alerting
// shapes they claim to mirror (schedule.ts / alert-sink.ts's "no adapter needed" claims were
// previously pinned by nothing but a comment). @caisson-sh/jobs and @caisson-sh/alerting are TYPE-ONLY
// devDependencies of this package — never runtime dependencies (see schedule.ts / alert-sink.ts
// module docs for why compliance-core stays dependency-free of both at runtime).
//
// Neither assertion function below is ever CALLED — a passing tscn build IS the assertion. If
// either shape drifts out of structural compatibility, this file fails to compile.
import { describe, expect, test } from "bun:test";
import type { TaskDefinition } from "@caisson-sh/jobs";
import type { AlertChannel } from "@caisson-sh/alerting";
import {
  defineComplianceSnapshotTask,
  type ComplianceSnapshotTaskDeps,
} from "./schedule.ts";
import type { DriftAlertChannel } from "./alert-sink.ts";

/** `defineComplianceSnapshotTask`'s output must satisfy the real `TaskDefinition<unknown>` —
 *  proves a caller can register it directly on a real `JobQueue`
 *  (`createPgBossJobQueue`/`createInMemoryQueue`) with no adapter. Never called. */
function _assertTaskDefinitionAssignable(
  deps: ComplianceSnapshotTaskDeps,
): TaskDefinition<unknown> {
  return defineComplianceSnapshotTask(deps);
}

/** A real `AlertChannel` must be assignable to our `DriftAlertChannel` port — proves a caller can
 *  pass the real email/webhook/Slack/Telegram/Discord channels straight into `deliverToAll` with
 *  no adapter. Never called. */
function _assertAlertChannelAssignable(
  channel: AlertChannel,
): DriftAlertChannel {
  return channel;
}

describe("structural assignability (compile-time only, WR-04)", () => {
  test("a passing build is the real check; this keeps the file a real, runnable test", () => {
    expect(typeof _assertTaskDefinitionAssignable).toBe("function");
    expect(typeof _assertAlertChannelAssignable).toBe("function");
  });
});
