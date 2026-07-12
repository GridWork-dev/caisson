// Hermetic unit tests for the deterministic graders — accuracy, grounding, no-extra-findings — and
// their pass/fail + not-applicable (foreign case kind) paths. Always-run; no cassettes needed.
import { describe, expect, test } from "bun:test";
import {
  accuracyGrader,
  groundingGrader,
  noExtraFindingsGrader,
  stableSerialize,
} from "./rubric.ts";
import type { Finding } from "../finding.ts";
import type { Grader, GraderArgs, GraderResult } from "@caisson/ai-evals";

const FINDING: Finding = {
  source: "competitor",
  kind: "page_diff",
  severity: "info",
  title: "Competitor page changed: rival.example.com",
  body: "Watched page https://rival.example.com/pricing changed content since the last check.",
  dedupKey: "competitor:abc123:def456",
  payload: {
    url: "https://rival.example.com/pricing",
    previous: "aa",
    current: "bb",
  },
};

/** Fill a full GraderArgs from the fields a case actually varies. */
function mkArgs(over: Partial<GraderArgs>): GraderArgs {
  return {
    eval: "e",
    scorer: "s",
    caseId: FINDING.dedupKey,
    input: { kind: "finding" },
    output: stableSerialize(FINDING),
    expected: undefined,
    ...over,
  };
}

const run = async (grader: Grader, args: GraderArgs): Promise<GraderResult> =>
  grader(args);

describe("accuracyGrader", () => {
  test("passes when the replayed finding is byte-identical to the recorded one", async () => {
    const r = await run(accuracyGrader([FINDING]), mkArgs({}));
    expect(r.pass).toBe(true);
  });

  test("fails when the replayed finding differs", async () => {
    const r = await run(
      accuracyGrader([FINDING]),
      mkArgs({
        output: stableSerialize({
          ...FINDING,
          body: "something else entirely",
        }),
      }),
    );
    expect(r.pass).toBe(false);
  });

  test("fails when no recorded finding has the case's dedupKey", async () => {
    const r = await run(
      accuracyGrader([FINDING]),
      mkArgs({ caseId: "competitor:nope:nope" }),
    );
    expect(r.pass).toBe(false);
  });

  test("not-applicable-passes a count case", async () => {
    const r = await run(
      accuracyGrader([FINDING]),
      mkArgs({ input: { kind: "count" }, output: "3" }),
    );
    expect(r.pass).toBe(true);
  });
});

describe("groundingGrader", () => {
  test("passes when every finding URL host was fetched", async () => {
    const r = await run(
      groundingGrader(new Set(["rival.example.com"])),
      mkArgs({}),
    );
    expect(r.pass).toBe(true);
  });

  test("fails on a URL host that was never fetched", async () => {
    const finding = {
      ...FINDING,
      body: "see https://evil.example.net/x",
      payload: {},
    };
    const r = await run(
      groundingGrader(new Set(["rival.example.com"])),
      mkArgs({ output: stableSerialize(finding) }),
    );
    expect(r.pass).toBe(false);
  });

  test("passes a finding with no URLs at all", async () => {
    const finding = { ...FINDING, body: "no links here", payload: { n: 1 } };
    const r = await run(
      groundingGrader(new Set()),
      mkArgs({ output: stableSerialize(finding) }),
    );
    expect(r.pass).toBe(true);
  });

  test("not-applicable-passes a count case", async () => {
    const r = await run(
      groundingGrader(new Set()),
      mkArgs({ input: { kind: "count" }, output: "0" }),
    );
    expect(r.pass).toBe(true);
  });
});

describe("noExtraFindingsGrader", () => {
  test("passes when replayed count equals recorded count", async () => {
    const r = await run(
      noExtraFindingsGrader(),
      mkArgs({
        input: { kind: "count" },
        output: "3",
        expected: { recordedCount: 3 },
      }),
    );
    expect(r.pass).toBe(true);
  });

  test("fails when the replay produced an extra finding", async () => {
    const r = await run(
      noExtraFindingsGrader(),
      mkArgs({
        input: { kind: "count" },
        output: "4",
        expected: { recordedCount: 3 },
      }),
    );
    expect(r.pass).toBe(false);
  });

  test("not-applicable-passes a finding case", async () => {
    const r = await run(noExtraFindingsGrader(), mkArgs({}));
    expect(r.pass).toBe(true);
  });
});
