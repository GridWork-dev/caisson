// Unit tests. Every git/tar/railway call goes through an injected fake `ExecFileSyncFn` double --
// no real git-archive/railway subprocess anywhere in this file (mirrors the `fakeExecFn` double
// pattern in packages/tool-exec/src/tool-exec.test.ts).
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import type { ExecFileSyncFn } from "./railway-deploy";
import {
  appendReceipt,
  archiveRefToDir,
  assertAncestorOfMain,
  buildReceiptRow,
  checkReceiptCollision,
  parseArgv,
  parseReceipts,
  receiptsPath,
  resolveDeployedBy,
  resolveRef,
  type Receipt,
} from "./railway-deploy";

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
    });
  });

  test("accepts --force and --dry-run flags", () => {
    expect(
      parseArgv(["--service", "s", "--ref", "abc", "--force", "--dry-run"]),
    ).toEqual({ service: "s", ref: "abc", force: true, dryRun: true });
  });

  test("accepts --key=value form", () => {
    expect(parseArgv(["--service=s", "--ref=abc"])).toEqual({
      service: "s",
      ref: "abc",
      force: false,
      dryRun: false,
    });
  });

  test("throws when --service is missing", () => {
    expect(() => parseArgv(["--ref", "abc"])).toThrow(/--service/);
  });

  test("throws when --ref is missing", () => {
    expect(() => parseArgv(["--service", "s"])).toThrow(/--ref/);
  });

  test("throws on an unrecognized argument", () => {
    expect(() =>
      parseArgv(["--service", "s", "--ref", "abc", "--bogus"]),
    ).toThrow(/unrecognized argument/);
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
      { cmd: "git", args: ["rev-parse", "--verify", "main^{commit}"] },
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
        args: ["merge-base", "--is-ancestor", "deadbeef", "origin/main"],
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
    expect(calls[0]).toEqual({ cmd: "git", args: ["archive", "deadbeef"] });
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
