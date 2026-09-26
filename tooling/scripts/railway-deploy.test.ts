// Unit tests. Every git/tar/railway call goes through an injected fake `ExecFileSyncFn` double --
// no real git-archive/railway subprocess anywhere in this file (mirrors the `fakeExecFn` double
// pattern in packages/tool-exec/src/tool-exec.test.ts).
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Reached by relative path, not the `@caisson-sh/kernel/node` specifier: `tooling/scripts/` has no
// package.json, so it is not a workspace and bun's workspace resolution never links `@caisson-sh/*`
// here. That is also why railway-deploy.ts re-declares the carrier filename instead of importing
// it — and why the round-trip below is the only thing holding the two declarations together.
import {
  readRevision,
  REVISION_FILENAME,
  UNKNOWN_REVISION,
} from "../../packages/kernel/src/revision.ts";
import type { Args, ExecFileSyncFn } from "./railway-deploy";
import {
  appendReceipt,
  archiveRefToDir,
  assertAncestorOfMain,
  awaitDeployment,
  buildReceiptRow,
  checkReceiptCollision,
  classifyDeployStatus,
  latestDeployment,
  main,
  DEFAULT_WAIT_MINUTES,
  parseArgv,
  pollsForWait,
  parseReceipts,
  receiptEvidenceMarkdown,
  receiptsPath,
  resolveDeployedBy,
  resolveRef,
  stampRevision,
  type Receipt,
} from "./railway-deploy";

/** Test double for the injectable sleep -- never actually waits. */
const noSleep = (): Promise<void> => Promise.resolve();

/** One `railway deployment list --json` answer. */
const deploymentsJson = (
  rows: ReadonlyArray<{ id: string; status: string }>,
): string =>
  JSON.stringify(rows.map((r) => ({ ...r, meta: { reason: "deploy" } })));

/** Records every call; each entry in `script` answers the Nth call (or throws if it's an Error). */
function fakeExec(script: ReadonlyArray<string | Buffer | Error>): {
  fn: ExecFileSyncFn;
  calls: Array<{ cmd: string; args: readonly string[] }>;
} {
  const calls: Array<{ cmd: string; args: readonly string[] }> = [];
  let i = 0;
  const fn = ((cmd: string, args: readonly string[]) => {
    calls.push({ cmd, args: [...args] });
    const answer = script[i++];
    if (answer instanceof Error) throw answer;
    return answer as string | Buffer;
  }) as ExecFileSyncFn;
  return { fn, calls };
}

describe("parseArgv", () => {
  test("parses --service/--ref, defaults force/dryRun false", () => {
    expect(parseArgv(["--service", "caisson-site", "--ref", "HEAD"])).toEqual({
      service: "caisson-site",
      ref: "HEAD",
      force: false,
      dryRun: false,
      waitMinutes: DEFAULT_WAIT_MINUTES,
    });
  });

  test("accepts --force and --dry-run flags", () => {
    expect(
      parseArgv(["--service", "s", "--ref", "abc", "--force", "--dry-run"]),
    ).toEqual({
      service: "s",
      ref: "abc",
      force: true,
      dryRun: true,
      waitMinutes: DEFAULT_WAIT_MINUTES,
    });
  });

  test("accepts --key=value form", () => {
    expect(parseArgv(["--service=s", "--ref=abc"])).toEqual({
      service: "s",
      ref: "abc",
      force: false,
      dryRun: false,
      waitMinutes: DEFAULT_WAIT_MINUTES,
    });
  });

  test("throws when --service is missing", () => {
    expect(() => parseArgv(["--ref", "abc"])).toThrow(/--service/);
  });

  test("throws when --ref is missing", () => {
    expect(() => parseArgv(["--service", "s"])).toThrow(/--ref/);
  });

  // The docs service is why this flag exists: its railway.toml sets healthcheckTimeout = 1500s
  // and it re-embeds the whole corpus on a cold boot, so the 15-minute default poll budget would
  // throw "timed out waiting" on a deploy that is still legitimately warming — a false RED that
  // would then skip every step after it in the fleet job.
  test("accepts --wait-minutes in both forms and rejects a non-positive one", () => {
    expect(
      parseArgv(["--service", "s", "--ref", "abc", "--wait-minutes", "40"])
        .waitMinutes,
    ).toBe(40);
    expect(
      parseArgv(["--service=s", "--ref=abc", "--wait-minutes=40"]).waitMinutes,
    ).toBe(40);
    expect(() =>
      parseArgv(["--service", "s", "--ref", "abc", "--wait-minutes", "0"]),
    ).toThrow();
    expect(() =>
      parseArgv(["--service", "s", "--ref", "abc", "--wait-minutes", "x"]),
    ).toThrow();
  });

  test("throws on an unrecognized argument", () => {
    expect(() =>
      parseArgv(["--service", "s", "--ref", "abc", "--bogus"]),
    ).toThrow(/unrecognized argument/);
  });
});

describe("pollsForWait -- the wait budget the docs service needs", () => {
  test("the default budget reproduces the historical 90-poll ceiling exactly", () => {
    expect(pollsForWait(DEFAULT_WAIT_MINUTES)).toBe(90);
  });

  // Mutation-relevant: without the Number.isFinite guard this returns NaN, `poll < NaN` is
  // false on the first iteration, the poll loop never executes, and every deploy reports
  // "timed out" without ever asking Railway a single question.
  test("refuses a non-finite or non-positive budget instead of returning NaN", () => {
    expect(() => pollsForWait(Number.NaN)).toThrow(/positive number/);
    expect(() => pollsForWait(0)).toThrow(/positive number/);
    expect(() => pollsForWait(-5)).toThrow(/positive number/);
  });

  test("a raised budget scales at the fixed 10s cadence and always rounds UP", () => {
    // 40 minutes covers docs' 1500s healthcheckTimeout plus build; rounding down would
    // reintroduce the exact false-RED this flag exists to prevent.
    expect(pollsForWait(40)).toBe(240);
    expect(pollsForWait(1)).toBe(6);
    expect(pollsForWait(1, 7000)).toBe(9);
  });
});

describe("resolveRef -- ref resolution", () => {
  test("resolves to the trimmed SHA `git rev-parse --verify` returns", () => {
    const { fn, calls } = fakeExec([
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n",
    ]);
    expect(resolveRef("main", "/repo", fn)).toBe(
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    );
    expect(calls).toEqual([
      {
        cmd: "git",
        args: ["rev-parse", "--verify", "--end-of-options", "main^{commit}"],
      },
    ]);
  });

  test("rejects an unresolvable ref (git rev-parse throws)", () => {
    const { fn } = fakeExec([new Error("fatal: ambiguous argument")]);
    expect(() => resolveRef("not-a-real-ref", "/repo", fn)).toThrow(
      /could not resolve ref "not-a-real-ref"/,
    );
  });
});

describe("assertAncestorOfMain -- ancestry check", () => {
  test("passes silently when git merge-base --is-ancestor succeeds", () => {
    const { fn, calls } = fakeExec([""]);
    expect(() => assertAncestorOfMain("deadbeef", "/repo", fn)).not.toThrow();
    expect(calls).toEqual([
      {
        cmd: "git",
        args: [
          "merge-base",
          "--is-ancestor",
          "--end-of-options",
          "deadbeef",
          "origin/main",
        ],
      },
    ]);
  });

  test("rejects a SHA not on origin/main (non-zero exit -> throw)", () => {
    const { fn } = fakeExec([new Error("exit code 1")]);
    expect(() => assertAncestorOfMain("deadbeef", "/repo", fn)).toThrow(
      /is not an ancestor of origin\/main/,
    );
  });
});

describe("archiveRefToDir -- clean staging via git archive | tar -x", () => {
  test("pipes the archive buffer into tar's stdin, no shell pipe", () => {
    const archiveBuf = Buffer.from("fake-tar-bytes");
    const { fn, calls } = fakeExec([archiveBuf, ""]);
    const stageDir = `/tmp/railway-deploy-test-${process.pid}`;
    archiveRefToDir("deadbeef", "/repo", stageDir, fn);
    expect(calls[0]).toEqual({
      cmd: "git",
      args: ["archive", "--end-of-options", "deadbeef"],
    });
    expect(calls[1]?.cmd).toBe("tar");
    expect(calls[1]?.args).toEqual(["-x", "-C", stageDir]);
    rmSync(stageDir, { recursive: true, force: true });
  });
});

describe("resolveDeployedBy", () => {
  test("uses git config user.name when set", () => {
    const { fn } = fakeExec(["Liam\n"]);
    expect(resolveDeployedBy("/repo", fn)).toBe("Liam");
  });

  test("falls back to $USER when git config throws", () => {
    const prevUser = process.env.USER;
    process.env.USER = "fallback-user";
    const { fn } = fakeExec([new Error("no user.name set")]);
    expect(resolveDeployedBy("/repo", fn)).toBe("fallback-user");
    if (prevUser === undefined) delete process.env.USER;
    else process.env.USER = prevUser;
  });
});

describe("receiptsPath", () => {
  test("keys the receipts file by service name under docs/deploy/receipts/", () => {
    expect(receiptsPath("/repo", "caisson-site")).toBe(
      "/repo/docs/deploy/receipts/caisson-site.json",
    );
  });
});

describe("parseReceipts", () => {
  test("null (no file yet) parses to an empty array", () => {
    expect(parseReceipts(null)).toEqual([]);
  });

  test("empty/whitespace string parses to an empty array", () => {
    expect(parseReceipts("  \n")).toEqual([]);
  });

  test("parses a well-formed receipts array", () => {
    const raw = JSON.stringify([
      {
        sha: "a".repeat(40),
        deployedAt: "2026-07-17T00:00:00Z",
        deployedBy: "Liam",
      },
    ]);
    expect(parseReceipts(raw)).toEqual([
      {
        sha: "a".repeat(40),
        deployedAt: "2026-07-17T00:00:00Z",
        deployedBy: "Liam",
      },
    ]);
  });

  test("rejects an unknown field (strict schema)", () => {
    const raw = JSON.stringify([
      { sha: "a", deployedAt: "t", deployedBy: "d", extra: "nope" },
    ]);
    expect(() => parseReceipts(raw)).toThrow();
  });
});

describe("buildReceiptRow", () => {
  test("omits `forced` when not forced", () => {
    expect(buildReceiptRow("sha1", "t", "Liam", false)).toEqual({
      sha: "sha1",
      deployedAt: "t",
      deployedBy: "Liam",
    });
  });

  test("stamps forced:true when forced", () => {
    expect(buildReceiptRow("sha1", "t", "Liam", true)).toEqual({
      sha: "sha1",
      deployedAt: "t",
      deployedBy: "Liam",
      forced: true,
    });
  });
});

describe("checkReceiptCollision", () => {
  const existing: Receipt[] = [
    { sha: "sha1", deployedAt: "t0", deployedBy: "Liam" },
  ];

  test("a fresh sha is never refused", () => {
    expect(() => checkReceiptCollision(existing, "sha2", false)).not.toThrow();
  });

  test("refuses a repeat sha without --force", () => {
    expect(() => checkReceiptCollision(existing, "sha1", false)).toThrow(
      /already has a deploy receipt.*--force/,
    );
  });

  test("a repeat sha with --force is allowed", () => {
    expect(() => checkReceiptCollision(existing, "sha1", true)).not.toThrow();
  });
});

describe("appendReceipt -- append-only", () => {
  test("adds exactly one well-formed row, leaving prior rows untouched", () => {
    const existing: Receipt[] = [
      { sha: "sha1", deployedAt: "t0", deployedBy: "Liam" },
    ];
    const row: Receipt = { sha: "sha2", deployedAt: "t1", deployedBy: "Liam" };
    const updated = appendReceipt(existing, row);

    expect(updated).toEqual([
      { sha: "sha1", deployedAt: "t0", deployedBy: "Liam" },
      { sha: "sha2", deployedAt: "t1", deployedBy: "Liam" },
    ]);
    // the input array is never mutated
    expect(existing).toEqual([
      { sha: "sha1", deployedAt: "t0", deployedBy: "Liam" },
    ]);
    expect(existing).toHaveLength(1);
  });
});

describe("main -- P0 ordering: ancestry gates any deploy", () => {
  test("railway up is never invoked when the ancestry check fails", async () => {
    const { fn, calls } = fakeExec([
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n", // resolveRef succeeds
      new Error("exit code 1"), // assertAncestorOfMain fails -- main() must stop here
    ]);
    const args: Args = {
      service: "caisson-site",
      ref: "some-feature-branch",
      force: false,
      dryRun: false,
    };

    await expect(main(args, fn)).rejects.toThrow(
      /is not an ancestor of origin\/main/,
    );

    // Only the resolve + ancestry-check git calls ran; archive and "railway up" never fired.
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.cmd === "git")).toBe(true);
    expect(calls.some((c) => c.cmd === "railway")).toBe(false);
  });
});

describe("classifyDeployStatus", () => {
  test("SUCCESS is the only ok state", () => {
    expect(classifyDeployStatus("SUCCESS")).toBe("ok");
  });

  test("failure states are terminal-bad", () => {
    for (const s of ["FAILED", "CRASHED", "REMOVED", "SKIPPED"]) {
      expect(classifyDeployStatus(s)).toBe("bad");
    }
  });

  test("in-flight and UNKNOWN-to-us states stay pending, never guessed either way", () => {
    for (const s of [
      "BUILDING",
      "DEPLOYING",
      "INITIALIZING",
      "SOME_NEW_2027",
    ]) {
      expect(classifyDeployStatus(s)).toBe("pending");
    }
  });
});

describe("latestDeployment", () => {
  test("returns the newest row and queries with --json --limit 1", () => {
    const { fn, calls } = fakeExec([
      deploymentsJson([{ id: "dep-1", status: "SUCCESS" }]),
    ]);
    expect(latestDeployment("caisson-site", "/stage", fn)).toEqual({
      id: "dep-1",
      status: "SUCCESS",
    });
    expect(calls[0]).toEqual({
      cmd: "railway",
      args: [
        "deployment",
        "list",
        "--service",
        "caisson-site",
        "--json",
        "--limit",
        "1",
      ],
    });
  });

  test("a service with no deployments yet reads as null, not a throw", () => {
    const { fn } = fakeExec(["[]"]);
    expect(latestDeployment("caisson-site", "/stage", fn)).toBeNull();
  });

  test("tolerates unknown vendor keys -- a Railway CLI field addition must not fail a deploy", () => {
    const { fn } = fakeExec([
      JSON.stringify([
        { id: "dep-1", status: "SUCCESS", meta: {}, somethingNew: 42 },
      ]),
    ]);
    expect(latestDeployment("caisson-site", "/stage", fn)?.id).toBe("dep-1");
  });
});

describe("awaitDeployment -- the deployment status is the verdict", () => {
  test("returns once a NEW deployment reaches SUCCESS", async () => {
    const { fn } = fakeExec([
      deploymentsJson([{ id: "dep-2", status: "SUCCESS" }]),
    ]);
    await expect(
      awaitDeployment("caisson-site", "/stage", "dep-1", fn, noSleep),
    ).resolves.toBeUndefined();
  });

  test("polls through in-flight states before succeeding", async () => {
    const { fn, calls } = fakeExec([
      deploymentsJson([{ id: "dep-2", status: "BUILDING" }]),
      deploymentsJson([{ id: "dep-2", status: "DEPLOYING" }]),
      deploymentsJson([{ id: "dep-2", status: "SUCCESS" }]),
    ]);
    await awaitDeployment("caisson-site", "/stage", "dep-1", fn, noSleep);
    expect(calls).toHaveLength(3);
  });

  test("a genuinely failed deployment still throws -- this is not a rubber stamp", async () => {
    const { fn } = fakeExec([
      deploymentsJson([{ id: "dep-2", status: "FAILED" }]),
    ]);
    await expect(
      awaitDeployment("caisson-site", "/stage", "dep-1", fn, noSleep),
    ).rejects.toThrow(/deployment dep-2 ended FAILED/);
  });

  test("an upload that never created a deployment fails after the grace window", async () => {
    // The head of the ledger never moves off `dep-1` -- the `railway up` 500-on-upload case.
    const { fn } = fakeExec(
      Array.from({ length: 8 }, () =>
        deploymentsJson([{ id: "dep-1", status: "SUCCESS" }]),
      ),
    );
    await expect(
      awaitDeployment("caisson-site", "/stage", "dep-1", fn, noSleep),
    ).rejects.toThrow(/no new caisson-site deployment was created/);
  });

  test("a service with no deployments at all is treated the same way", async () => {
    const { fn } = fakeExec(Array.from({ length: 8 }, () => "[]"));
    await expect(
      awaitDeployment("caisson-site", "/stage", null, fn, noSleep),
    ).rejects.toThrow(/no new caisson-site deployment was created/);
  });

  test("gives up rather than hanging when nothing ever goes terminal", async () => {
    const { fn } = fakeExec(
      Array.from({ length: 12 }, () =>
        deploymentsJson([{ id: "dep-2", status: "BUILDING" }]),
      ),
    );
    await expect(
      awaitDeployment("caisson-site", "/stage", "dep-1", fn, noSleep, 0, 10),
    ).rejects.toThrow(/timed out waiting/);
  });
});

describe("main -- a dropped log stream is not a failed deploy", () => {
  // The 2026-07-30 regression: `railway up --ci` exited non-zero on "Failed to stream build
  // logs" while Railway's ledger recorded the very same deployment as SUCCESS. A false RED
  // here skipped the second service in the fleet workflow and half-deployed it.
  const service = "zz-railway-deploy-selftest";
  const path = receiptsPath(`${import.meta.dir}/../..`, service);
  const sha = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

  const script = (upAnswer: string | Error) => [
    `${sha}\n`, // resolveRef
    "", // assertAncestorOfMain
    Buffer.from("tar-bytes"), // git archive
    "", // tar -x
    "Liam\n", // git config user.name
    deploymentsJson([{ id: "dep-1", status: "SUCCESS" }]), // priorId capture
    upAnswer, // railway up
    deploymentsJson([{ id: "dep-2", status: "SUCCESS" }]), // awaitDeployment
  ];
  const args: Args = {
    service,
    ref: "HEAD",
    force: false,
    dryRun: false,
    waitMinutes: DEFAULT_WAIT_MINUTES,
  };

  test("succeeds and still writes the receipt when railway up exits non-zero", async () => {
    const { fn } = fakeExec(
      script(new Error("Command failed: railway up --service x --ci")),
    );
    try {
      await expect(main(args, fn, noSleep)).resolves.toBeUndefined();
      expect(existsSync(path)).toBe(true);
      const rows = parseReceipts(readFileSync(path, "utf8"));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sha).toBe(sha);
    } finally {
      rmSync(path, { force: true });
    }
  });

  test("a clean railway up still verifies -- and a FAILED deployment throws, no receipt", async () => {
    const { fn } = fakeExec([
      ...script("").slice(0, 7),
      deploymentsJson([{ id: "dep-2", status: "FAILED" }]),
    ]);
    try {
      await expect(main(args, fn, noSleep)).rejects.toThrow(/ended FAILED/);
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(path, { force: true });
    }
  });
});

describe("receiptEvidenceMarkdown", () => {
  const row: Receipt = {
    sha: "d9ae893e1234567890abcdef1234567890abcdef",
    deployedAt: "2026-07-30T19:21:41.000Z",
    deployedBy: "github-actions (release-train leg 4)",
  };

  test("carries the whole receipt row verbatim as JSON", () => {
    const md = receiptEvidenceMarkdown("caisson-admin", row);
    const fenced = md.split("```json")[1]?.split("```")[0] ?? "";
    expect(JSON.parse(fenced)).toEqual(row);
  });

  // The limitation belongs in the summary BODY, not only in a log line that scrolls away: someone
  // reading this run page months later must not take it for a committed ledger entry.
  test("states on its face that the committed ledger was not updated", () => {
    const md = receiptEvidenceMarkdown("caisson-site", row);
    expect(md).toContain("caisson-site");
    expect(md).toContain("not** committed");
    expect(md).toContain("docs/deploy/receipts/");
  });
});

// The serving-revision stamp. Its two halves live in different trees (this script writes the
// carrier; packages/kernel/src/revision.ts reads it) and are wired together by nothing but a
// filename string, so the test that earns its place is the ROUND TRIP: what the deploy stamps must
// be what the kernel reader — the code that actually answers x-caisson-revision — reads back.
//
// Without it, a rename or a format change on either side fails NOTHING. Every service in the fleet
// would quietly report `unknown` forever, which is indistinguishable from the pre-existing state
// this whole mechanism exists to end. That silence is the failure mode worth a test.
describe("stampRevision", () => {
  const SHA = "8619c41e0f2a4b6d9c1e3f5a7b8d0c2e4f6a8b0d";

  const withStageDir = (fn: (dir: string) => void): void => {
    const dir = mkdtempSync(join(tmpdir(), "stamp-revision-"));
    try {
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test("round-trips through the kernel reader that serves the header", () => {
    withStageDir((dir) => {
      stampRevision(dir, SHA);
      expect(readRevision({}, dir)).toBe(SHA);
    });
  });

  test("overwrites the extracted placeholder rather than landing beside it", () => {
    withStageDir((dir) => {
      // What `git archive` extraction leaves behind: the committed carrier, reading `unknown`.
      writeFileSync(join(dir, REVISION_FILENAME), "unknown\n");
      expect(readRevision({}, dir)).toBe(UNKNOWN_REVISION);
      stampRevision(dir, SHA);
      expect(readRevision({}, dir)).toBe(SHA);
    });
  });

  test("writes the carrier filename the Dockerfiles COPY", () => {
    withStageDir((dir) => {
      stampRevision(dir, SHA);
      expect(existsSync(join(dir, REVISION_FILENAME))).toBe(true);
      expect(readFileSync(join(dir, REVISION_FILENAME), "utf8")).toBe(
        `${SHA}\n`,
      );
    });
  });

  test("stamps into the staging dir only — never the caller's cwd", () => {
    withStageDir((dir) => {
      stampRevision(dir, SHA);
      // The operator's working tree keeps its committed placeholder after every deploy.
      expect(readRevision({}, process.cwd())).toBe(UNKNOWN_REVISION);
    });
  });
});
