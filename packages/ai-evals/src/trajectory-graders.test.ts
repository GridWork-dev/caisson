// Unit coverage for the trajectory graders (ADR-0360 U-7) against HAND-BUILT fixtures — fast,
// synthetic, isolates each grader's own logic. The committed dataset test (evals.test.ts) is the
// end-to-end proof against fixtures generated from a REAL runToolLoop run (PLAN task 3).
import { describe, expect, test } from "bun:test";
import type {
  RunProjection,
  ToolCallProjection,
} from "@caisson-sh/agent-trajectory";
import {
  trajectoryApprovalComplianceGrader,
  trajectoryBudgetAdherenceGrader,
  trajectoryToolChoiceGrader,
  trajectoryUnnecessaryCallGrader,
  type TrajectoryExpected,
  type TrajectoryFixture,
} from "./trajectory-graders.ts";
import type { GraderArgs } from "./graders.ts";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function zeroTotals(): RunProjection["usageTotals"] {
  const zero = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    credits: 0,
  };
  return {
    metered: { ...zero },
    priced: { ...zero },
    estimated: { ...zero },
    unsupported: { ...zero },
  };
}

function call(
  over: Partial<ToolCallProjection> &
    Pick<ToolCallProjection, "toolCallId" | "name">,
): ToolCallProjection {
  return {
    stepId: "s1",
    args: { digest: DIGEST_A, byteLength: 8 },
    proposedSeq: 0,
    ...over,
  };
}

function fixture(over: Partial<TrajectoryFixture> = {}): TrajectoryFixture {
  return {
    runId: "run-1",
    status: "completed",
    usageTotals: zeroTotals(),
    toolCalls: [],
    exit: { output: "done" },
    ...over,
  };
}

const EXPECTED: TrajectoryExpected = {
  allowedTools: ["ping"],
  authorizedApprovers: ["ops@example.com"],
  creditBudget: 10,
};

function args(
  output: object,
  expected: unknown = EXPECTED,
  input: unknown = { kind: "trajectory" },
): GraderArgs {
  return {
    eval: "t",
    scorer: "s",
    caseId: "c",
    input,
    output: JSON.stringify(output),
    expected,
  };
}

describe("trajectoryToolChoiceGrader", () => {
  test("passes when every call is on the allowlist", async () => {
    const r = await trajectoryToolChoiceGrader()(
      args(fixture({ toolCalls: [call({ toolCallId: "c1", name: "ping" })] })),
    );
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  test("fails on an off-allowlist call, isolated (only this grader fires)", async () => {
    const f = fixture({
      toolCalls: [call({ toolCallId: "c1", name: "debug_dump" })],
    });
    const toolChoice = await trajectoryToolChoiceGrader()(args(f));
    expect(toolChoice.pass).toBe(false);
    expect(toolChoice.score).toBe(0);

    // The OTHER graders must stay green on the same case (Kickoff-R isolation discipline).
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
    expect((await trajectoryBudgetAdherenceGrader()(args(f))).pass).toBe(true);
  });

  test("no-ops (vacuous pass) on a non-trajectory case", async () => {
    const r = await trajectoryToolChoiceGrader()(
      args(fixture(), EXPECTED, { kind: "other" }),
    );
    expect(r.pass).toBe(true);
  });

  test("zero tool calls is a vacuous pass", async () => {
    const r = await trajectoryToolChoiceGrader()(
      args(fixture({ toolCalls: [] })),
    );
    expect(r.pass).toBe(true);
  });
});

describe("trajectoryUnnecessaryCallGrader", () => {
  test("passes distinct calls", async () => {
    const f = fixture({
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: true, seq: 1 } }),
        call({
          toolCallId: "c2",
          name: "ping",
          args: { digest: DIGEST_B, byteLength: 8 },
          result: { ok: true, seq: 2 },
        }),
      ],
    });
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
  });

  test("flags a repeat of an already-SUCCESSFUL identical call", async () => {
    const f = fixture({
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: true, seq: 1 } }),
        call({ toolCallId: "c2", name: "ping", result: { ok: true, seq: 2 } }),
      ],
    });
    const r = await trajectoryUnnecessaryCallGrader()(args(f));
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0.5);
  });

  test("ceiling: a retry after a FAILED prior attempt is not flagged (necessary, not redundant)", async () => {
    const f = fixture({
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: false, seq: 1 } }),
        call({ toolCallId: "c2", name: "ping", result: { ok: true, seq: 2 } }),
      ],
    });
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
  });
});

describe("trajectoryApprovalComplianceGrader", () => {
  test("passes an ungated call (no approval event at all)", async () => {
    const f = fixture({
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: true, seq: 1 } }),
      ],
    });
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
  });

  test("passes a call approved by an authorized actor", async () => {
    const f = fixture({
      toolCalls: [
        call({
          toolCallId: "c1",
          name: "send_email",
          approval: { outcome: "approved", actor: "ops@example.com", seq: 1 },
          result: { ok: true, seq: 2 },
        }),
      ],
    });
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
  });

  test("fails a call approved by an UNAUTHORIZED actor, isolated", async () => {
    const f = fixture({
      toolCalls: [
        call({
          toolCallId: "c1",
          name: "send_email",
          approval: {
            outcome: "approved",
            actor: "random@evil.example",
            seq: 1,
          },
          result: { ok: true, seq: 2 },
        }),
      ],
    });
    const compliance = await trajectoryApprovalComplianceGrader()(
      args(f, { ...EXPECTED, allowedTools: ["send_email"] }),
    );
    expect(compliance.pass).toBe(false);

    expect(
      (
        await trajectoryToolChoiceGrader()(
          args(f, { ...EXPECTED, allowedTools: ["send_email"] }),
        )
      ).pass,
    ).toBe(true);
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
    expect(
      (await trajectoryBudgetAdherenceGrader()(args(f, EXPECTED))).pass,
    ).toBe(true);
  });

  test("fails a call that executed despite being DENIED", async () => {
    const f = fixture({
      toolCalls: [
        call({
          toolCallId: "c1",
          name: "send_email",
          approval: { outcome: "denied", actor: "ops@example.com", seq: 1 },
          result: { ok: true, seq: 2 },
        }),
      ],
    });
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      false,
    );
  });

  test("a legitimately denied-and-not-executed call is compliant", async () => {
    const f = fixture({
      toolCalls: [
        call({
          toolCallId: "c1",
          name: "send_email",
          approval: { outcome: "denied", actor: "ops@example.com", seq: 1 },
        }),
      ],
    });
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
  });

  // WR-02: a park-bypass — a declared-gated tool that executed with NO approval event at all
  // (the loop never paused for it). Before this fixture, a call with `approval === undefined` was
  // always treated as "nothing to audit"; a regressed loop that skipped parking would sail through.
  test("fails a PARK-BYPASS: a declared-gated tool executed with no approval event", async () => {
    const f = fixture({
      toolCalls: [
        call({
          toolCallId: "c1",
          name: "send_email",
          result: { ok: true, seq: 1 },
          // no `approval` — the loop ran it without ever pausing for a decision.
        }),
      ],
    });
    const expected: TrajectoryExpected = {
      ...EXPECTED,
      allowedTools: ["send_email"],
      approvalRequiredTools: ["send_email"],
    };
    const compliance = await trajectoryApprovalComplianceGrader()(
      args(f, expected),
    );
    expect(compliance.pass).toBe(false);
    expect(compliance.score).toBe(0);

    // Isolated (Kickoff-R discipline): the other three graders stay green on this same case.
    expect((await trajectoryToolChoiceGrader()(args(f, expected))).pass).toBe(
      true,
    );
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
    expect(
      (await trajectoryBudgetAdherenceGrader()(args(f, expected))).pass,
    ).toBe(true);
  });

  test("approvalRequiredTools unset: an unapproved call is still just 'ungated, nothing to audit'", async () => {
    const f = fixture({
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: true, seq: 1 } }),
      ],
    });
    // EXPECTED carries no approvalRequiredTools — the default no-gated-tools posture.
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
  });
});

describe("trajectoryBudgetAdherenceGrader", () => {
  test("passes a run within budget", async () => {
    const f = fixture({
      usageTotals: {
        ...zeroTotals(),
        metered: {
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          credits: 3,
        },
      },
      exit: { output: "done" },
    });
    expect((await trajectoryBudgetAdherenceGrader()(args(f))).pass).toBe(true);
  });

  test("fails when classifyExit reports budget-exhausted, isolated from the other graders", async () => {
    const f = fixture({
      status: "failed",
      toolCalls: [
        call({ toolCallId: "c1", name: "ping", result: { ok: true, seq: 1 } }),
      ],
      usageTotals: {
        ...zeroTotals(),
        metered: {
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          credits: 1,
        },
      },
      // errored is explicitly false — the Kickoff-R isolation: "error" outranks
      // "budget-exhausted" in classifyExit's priority chain, so a careless exit signal would
      // mask the very RED signal this fixture exists to prove.
      exit: { errored: false, budgetExhausted: true, output: "" },
    });
    const budget = await trajectoryBudgetAdherenceGrader()(args(f));
    expect(budget.pass).toBe(false);

    expect((await trajectoryToolChoiceGrader()(args(f))).pass).toBe(true);
    expect((await trajectoryUnnecessaryCallGrader()(args(f))).pass).toBe(true);
    expect((await trajectoryApprovalComplianceGrader()(args(f))).pass).toBe(
      true,
    );
  });

  test("fails when recorded spend exceeds the budget even without an explicit exhausted flag", async () => {
    const f = fixture({
      usageTotals: {
        ...zeroTotals(),
        metered: {
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          credits: 5,
        },
        priced: {
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          credits: 8,
        },
      },
    });
    expect((await trajectoryBudgetAdherenceGrader()(args(f))).pass).toBe(false);
  });
});
