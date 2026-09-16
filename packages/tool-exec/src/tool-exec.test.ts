import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import {
  createMemoryApprovalStore,
  createToolExec,
  type ExecFn,
} from "./index.ts";

/** A hermetic double: records every call and returns a canned result. No process ever spawns. */
function fakeExecFn(): {
  fn: ExecFn;
  calls: Array<{ command: string; args: readonly string[] }>;
} {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const fn: ExecFn = async (command, args) => {
    calls.push({ command, args });
    return { stdout: "hello\n", stderr: "", exitCode: 0 };
  };
  return { fn, calls };
}

const echoSpec = {
  name: "echo",
  command: "/bin/echo",
  argsSchema: z.array(z.string()),
};

describe("createToolExec — default-deny allowlist", () => {
  test("an unregistered command name is refused", async () => {
    const { fn } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    await expect(toolExec.run("rm", ["-rf", "/"])).rejects.toThrow(
      NotFoundError,
    );
  });

  test("an empty allowlist refuses everything", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [], execFn: fn });
    await expect(toolExec.run("echo", ["hi"])).rejects.toThrow(NotFoundError);
    expect(calls).toHaveLength(0);
  });
});

describe("createToolExec — schema-validated args, no exec on failure", () => {
  test("args failing the schema are rejected BEFORE any exec", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    // argsSchema is z.array(z.string()) — a plain object fails the shape.
    await expect(toolExec.run("echo", { not: "an array" })).rejects.toThrow(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("createToolExec — a valid call", () => {
  test("returns a provenance record with exit code, output, resolved args", async () => {
    const { fn, calls } = fakeExecFn();
    const now = () => 1_700_000_000_000;
    const toolExec = createToolExec({
      allowlist: [echoSpec],
      execFn: fn,
      now,
    });
    const result = await toolExec.run("echo", ["hello", "world"], "smoke");

    expect(result).toEqual({
      command: "/bin/echo",
      args: ["hello", "world"],
      exitCode: 0,
      stdout: "hello\n",
      stderr: "",
      ok: true,
      reason: "smoke",
      at: 1_700_000_000_000,
    });
    // structural proof: the exec fn received (command: string, argsArray: string[]) — never a
    // shell string. Nothing here ever builds a single concatenated command string.
    expect(calls).toHaveLength(1);
    expect(typeof calls[0]?.command).toBe("string");
    expect(Array.isArray(calls[0]?.args)).toBe(true);
    expect(calls[0]?.args.every((a) => typeof a === "string")).toBe(true);
  });

  test("reason is omitted from the record when not supplied", async () => {
    const { fn } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    const result = await toolExec.run("echo", ["x"]);
    expect(result.reason).toBeUndefined();
    expect("reason" in result).toBe(false);
  });
});

describe("createToolExec — a non-zero exit / spawn failure", () => {
  test("a non-zero exit is captured, not thrown", async () => {
    const failFn: ExecFn = async () => ({
      stdout: "",
      stderr: "boom\n",
      exitCode: 2,
    });
    const toolExec = createToolExec({
      allowlist: [echoSpec],
      execFn: failFn,
    });
    const result = await toolExec.run("echo", ["x"]);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("boom\n");
  });
});

describe("createToolExec — real spawn (default ExecFn), a safe binary", () => {
  test("actually execs node -e and captures bounded stdout", async () => {
    const toolExec = createToolExec({
      allowlist: [
        {
          name: "node-eval",
          command: process.execPath,
          argsSchema: z.array(z.string()),
        },
      ],
    });
    const result = await toolExec.run("node-eval", [
      "-e",
      "process.stdout.write('ok')",
    ]);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });
});

describe("createToolExec — env leak guard (THREAT: parent-secret inheritance), real default execFn", () => {
  const CANARY_KEY = "CAISSON_LEAK_CANARY";

  test("with env supplied on the allowlist entry, the child does NOT see the canary and DOES see PATH", async () => {
    process.env[CANARY_KEY] = "leak";
    try {
      const toolExec = createToolExec({
        allowlist: [
          {
            name: "node-eval",
            command: process.execPath,
            argsSchema: z.array(z.string()),
            env: { PATH: process.env.PATH ?? "" },
          },
        ],
      });
      const result = await toolExec.run("node-eval", [
        "-e",
        `process.stdout.write(process.env.${CANARY_KEY} ? "leaked" : (process.env.PATH ? "clean" : "no-path"))`,
      ]);
      expect(result.stdout).toBe("clean");
    } finally {
      delete process.env[CANARY_KEY];
    }
  });

  test("with no env on the allowlist entry (today's default), the child DOES see the canary — pins the inherit-everything default so a future flip shows up in CI", async () => {
    process.env[CANARY_KEY] = "leak";
    try {
      const toolExec = createToolExec({
        allowlist: [
          {
            name: "node-eval",
            command: process.execPath,
            argsSchema: z.array(z.string()),
          },
        ],
      });
      const result = await toolExec.run("node-eval", [
        "-e",
        `process.stdout.write(process.env.${CANARY_KEY} ? "leaked" : "clean")`,
      ]);
      expect(result.stdout).toBe("leaked");
    } finally {
      delete process.env[CANARY_KEY];
    }
  });
});

describe("createToolExec — two-phase gate (ADR-0360 S3): propose() then execute()", () => {
  test("propose validates + parks without spawning; execute later runs the SAME validated argv", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });

    const proposed = await toolExec.propose(
      "echo",
      ["hello", "world"],
      "smoke",
    );
    expect(proposed).toMatchObject({
      name: "echo",
      command: "/bin/echo",
      args: ["hello", "world"],
      reason: "smoke",
    });
    expect(calls).toHaveLength(0); // propose never spawns

    const result = await toolExec.execute(proposed);
    expect(result).toMatchObject({
      command: "/bin/echo",
      args: ["hello", "world"],
      ok: true,
      reason: "smoke",
    });
    expect(calls).toHaveLength(1);
  });

  test("propose rejects an unregistered command BEFORE anything is parked", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    await expect(toolExec.propose("rm", ["-rf", "/"])).rejects.toThrow(
      NotFoundError,
    );
    expect(calls).toHaveLength(0);
  });

  test("propose rejects args failing the schema, BEFORE anything is parked", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    await expect(toolExec.propose("echo", { not: "an array" })).rejects.toThrow(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  test("execute rejects a hand-built proposal without a stored approval", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    await expect(
      toolExec.execute({
        name: "echo",
        command: "/bin/echo",
        args: ["already", "validated"],
      }),
    ).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  test("execute refuses a proposal whose command no longer matches the allowlist (drift defense)", async () => {
    const { fn, calls } = fakeExecFn();
    const spec = { ...echoSpec };
    const toolExec = createToolExec({ allowlist: [spec], execFn: fn });
    const proposed = await toolExec.propose("echo", ["hi"]);
    spec.command = "/bin/other";
    await expect(toolExec.execute(proposed)).rejects.toThrow(NotFoundError);
    expect(calls).toHaveLength(0);
  });

  test("execute refuses a proposal for a name removed from the allowlist since propose", async () => {
    const { fn, calls } = fakeExecFn();
    const approvalStore = createMemoryApprovalStore();
    const issuer = createToolExec({
      allowlist: [echoSpec],
      execFn: fn,
      approvalStore,
    });
    const proposed = await issuer.propose("echo", ["x"]);
    const toolExec = createToolExec({
      allowlist: [],
      execFn: fn,
      approvalStore,
    });
    await expect(toolExec.execute(proposed)).rejects.toThrow(NotFoundError);
    expect(calls).toHaveLength(0);
  });

  test("the existing single-phase run() path is untouched by the two-phase addition", async () => {
    const { fn, calls } = fakeExecFn();
    const toolExec = createToolExec({ allowlist: [echoSpec], execFn: fn });
    const result = await toolExec.run("echo", ["still", "works"]);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("ADR-0423 — stored approval integrity", () => {
  test("mutated approved arguments never spawn", async () => {
    const { fn, calls } = fakeExecFn();
    const gate = createToolExec({ allowlist: [echoSpec], execFn: fn });
    const proposal = await gate.propose("echo", ["approved"]);
    await expect(
      gate.execute({ ...proposal, args: ["changed"] }),
    ).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  test("forged IDs, digests, reasons and policy versions are rejected", async () => {
    const { fn, calls } = fakeExecFn();
    const gate = createToolExec({ allowlist: [echoSpec], execFn: fn });
    for (const patch of [
      { approvalId: crypto.randomUUID() },
      { digest: "0".repeat(64) },
      { reason: "not approved" },
      { policyVersion: "forged" },
    ]) {
      const proposal = await gate.propose("echo", ["approved"], "reason");
      await expect(gate.execute({ ...proposal, ...patch })).rejects.toThrow();
    }
    expect(calls).toHaveLength(0);
  });

  test("altered proposal environment is rejected and current spec owns child env", async () => {
    const seen: unknown[] = [];
    const gate = createToolExec({
      allowlist: [{ ...echoSpec, env: { PATH: "/safe/bin" } }],
      execFn: async (_command, _args, opts) => {
        seen.push(opts.env);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });
    const proposal = await gate.propose("echo", ["approved"]);
    expect("env" in proposal).toBe(false);
    await expect(
      gate.execute({ ...proposal, env: { PATH: "/hostile/bin" } }),
    ).rejects.toThrow(ValidationError);
    expect(seen).toEqual([]);
    await gate.execute(proposal);
    expect(seen).toEqual([{ PATH: "/safe/bin" }]);
  });

  test("environment and policy-version rotation invalidate outstanding approvals", async () => {
    const { fn, calls } = fakeExecFn();
    const spec = {
      ...echoSpec,
      env: { PATH: "/old/bin" },
      policyVersion: "v1",
    };
    const gate = createToolExec({ allowlist: [spec], execFn: fn });
    const oldEnv = await gate.propose("echo", ["approved"]);
    spec.env.PATH = "/new/bin";
    await expect(gate.execute(oldEnv)).rejects.toThrow(NotFoundError);
    const oldVersion = await gate.propose("echo", ["approved"]);
    spec.policyVersion = "v2";
    await expect(gate.execute(oldVersion)).rejects.toThrow(NotFoundError);
    expect(calls).toHaveLength(0);
  });

  test("current schema revalidates saved original input, including object-to-argv transforms", async () => {
    const { fn, calls } = fakeExecFn();
    let allowed = true;
    const spec = {
      ...echoSpec,
      argsSchema: z
        .object({ text: z.string() })
        .strict()
        .refine(() => allowed, "policy narrowed")
        .transform(({ text }) => [text]),
    };
    const gate = createToolExec({ allowlist: [spec], execFn: fn });
    const input = { text: "approved" };
    const first = await gate.propose("echo", input);
    input.text = "caller mutated original";
    await gate.execute(first);
    expect(calls[0]?.args).toEqual(["approved"]);
    const second = await gate.propose("echo", { text: "another" });
    allowed = false;
    await expect(gate.execute(second)).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(1);
  });

  test("a changed schema transform cannot alter the approved argv", async () => {
    const { fn, calls } = fakeExecFn();
    let suffix = "old";
    const gate = createToolExec({
      allowlist: [
        {
          ...echoSpec,
          argsSchema: z
            .array(z.string())
            .transform((args) => [...args, suffix]),
        },
      ],
      execFn: fn,
    });
    const proposal = await gate.propose("echo", ["approved"]);
    suffix = "new";
    await expect(gate.execute(proposal)).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  test("atomic consumption prevents replay and concurrent double execution", async () => {
    const { fn, calls } = fakeExecFn();
    const gate = createToolExec({ allowlist: [echoSpec], execFn: fn });
    const proposal = JSON.parse(
      JSON.stringify(await gate.propose("echo", ["approved"])),
    ) as unknown;
    const results = await Promise.allSettled([
      gate.execute(proposal),
      gate.execute(proposal),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(calls).toHaveLength(1);
    await expect(gate.execute(proposal)).rejects.toThrow(NotFoundError);
  });
});
