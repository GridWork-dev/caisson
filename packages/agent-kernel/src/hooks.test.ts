import { describe, expect, test } from "bun:test";
import type { EventSink, OpsEvent } from "@caisson-sh/kernel";
import {
  HookDispatcher,
  commandHandler,
  type CommandRunner,
  type HookContext,
} from "./hooks.ts";
import { allow, deny, isDeny, isMutate, mutate } from "./governance.ts";

interface Ctx {
  readonly tags: readonly string[];
}

const BASE: HookContext<Ctx> = {
  act: "execute",
  phase: "before",
  context: { tags: [] },
};

/** A raw recording sink — does NOT redact, so a test can prove the dispatcher hands it secret-free data. */
class RecordingSink implements EventSink {
  readonly events: OpsEvent[] = [];
  emit(event: OpsEvent): void {
    this.events.push(event);
  }
}

describe("hooks dispatcher — ordering + observe-only", () => {
  test("handlers run in registration order, each awaited; observe-only → allow", async () => {
    const calls: string[] = [];
    const hooks = new HookDispatcher<Ctx>()
      .on("before:execute", async (ctx) => {
        await Promise.resolve();
        calls.push(`first:${ctx.act}:${ctx.phase}`);
      })
      .on("before:execute", () => {
        calls.push("second");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(out.invoked).toBe(2);
    expect(out.errors).toBe(0);
    expect(out.result.decision).toBe("allow");
    expect(calls).toEqual(["first:execute:before", "second"]);
    expect(hooks.count("before:execute")).toBe(2);
  });

  test("an unregistered point is a no-op (invoked 0, allow), never a throw", async () => {
    const hooks = new HookDispatcher<Ctx>();
    expect(hooks.count("after:ship")).toBe(0);
    const out = await hooks.dispatch("after:ship", BASE);
    expect(out).toEqual({ invoked: 0, errors: 0, result: allow<Ctx>() });
  });

  test("registration is keyed per hook point", async () => {
    const calls: string[] = [];
    const hooks = new HookDispatcher<Ctx>()
      .on("before:execute", () => {
        calls.push("be");
      })
      .on("after:execute", () => {
        calls.push("ae");
      });

    await hooks.dispatch("after:execute", { ...BASE, phase: "after" });
    expect(calls).toEqual(["ae"]);
  });
});

describe("hooks dispatcher — governance fold (HookResult)", () => {
  test("deny short-circuits (fail-closed): the first veto wins, downstream handlers do not run", async () => {
    const ran: string[] = [];
    const hooks = new HookDispatcher<Ctx>()
      .on("before:execute", () => {
        ran.push("a");
      })
      .on("before:execute", () => deny<Ctx>("policy: not allowed"))
      .on("before:execute", () => {
        ran.push("c");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(out.invoked).toBe(2);
    expect(isDeny(out.result)).toBe(true);
    if (isDeny(out.result))
      expect(out.result.reason).toBe("policy: not allowed");
    expect(ran).toEqual(["a"]); // "c" never ran
  });

  test("mutate threads the new context into downstream handlers and into the final result", async () => {
    let seen: readonly string[] = [];
    const hooks = new HookDispatcher<Ctx>()
      .on("before:execute", () => mutate<Ctx>({ tags: ["audited"] }))
      .on("before:execute", (ctx) => {
        seen = ctx.context.tags;
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(seen).toEqual(["audited"]); // downstream handler saw the mutated context
    expect(isMutate(out.result)).toBe(true);
    if (isMutate(out.result))
      expect(out.result.context.tags).toEqual(["audited"]);
  });
});

describe("hooks dispatcher — fail-open isolation (THREAT: exception bleed)", () => {
  test("a throwing handler is isolated and fail-open: the loop continues and never vetoes", async () => {
    const ran: string[] = [];
    const hooks = new HookDispatcher<Ctx>()
      .on("before:execute", () => {
        throw new Error("boom");
      })
      .on("before:execute", () => {
        ran.push("after-throw");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(out.invoked).toBe(2);
    expect(out.errors).toBe(1);
    expect(out.result.decision).toBe("allow"); // a throw never becomes a veto
    expect(ran).toEqual(["after-throw"]);
  });
});

describe("hooks dispatcher — pluggable sink (THREATS: secret logging, down sink blocks loop)", () => {
  test("a handler throw reports only the hook + error TYPE name — never the message/stack", async () => {
    const sink = new RecordingSink();
    const hooks = new HookDispatcher<Ctx>({ sink }).on("after:ship", () => {
      throw new Error("SECRET=sk-live-deadbeefcafe");
    });

    await hooks.dispatch("after:ship", {
      ...BASE,
      act: "ship",
      phase: "after",
    });

    expect(sink.events).toHaveLength(1);
    const ev = sink.events[0]!;
    expect(ev.name).toBe("hook.handler.error");
    expect(ev.attributes).toEqual({
      hook: "after:ship",
      index: 0,
      error: "Error",
    });
    // The secret from the thrown message never reached the sink in any field.
    expect(JSON.stringify(ev)).not.toContain("sk-live-deadbeefcafe");
  });

  test("a sink that throws synchronously never blocks the loop (fail-open)", async () => {
    const ran: string[] = [];
    const throwingSink: EventSink = {
      emit() {
        throw new Error("sink down");
      },
    };
    const hooks = new HookDispatcher<Ctx>({ sink: throwingSink })
      .on("before:execute", () => {
        throw new Error("handler down");
      })
      .on("before:execute", () => {
        ran.push("survived");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(out.errors).toBe(1);
    expect(ran).toEqual(["survived"]);
    expect(out.result.decision).toBe("allow");
  });

  test("a sink whose async emit never settles never blocks the loop", async () => {
    const ran: string[] = [];
    const hangingSink: EventSink = {
      emit() {
        return new Promise<void>(() => {
          /* never resolves — a hung transport */
        });
      },
    };
    const hooks = new HookDispatcher<Ctx>({ sink: hangingSink })
      .on("before:execute", () => {
        throw new Error("handler down");
      })
      .on("before:execute", () => {
        ran.push("survived");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(ran).toEqual(["survived"]); // dispatch resolved despite the hung sink
    expect(out.errors).toBe(1);
  });
});

describe("commandHandler — safe shell hooks (THREAT: shell injection / secret in argv)", () => {
  test("spawns via the runner with a FIXED argv array; exit 0 → allow", async () => {
    const calls: Array<{
      command: string;
      args: readonly string[];
      timeoutMs: number;
    }> = [];
    const runner: CommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
      return Promise.resolve(0);
    };

    const hooks = new HookDispatcher<Ctx>().on(
      "before:execute",
      commandHandler(
        { command: "lint", args: ["--fix", "src"], timeoutMs: 5_000 },
        runner,
      ),
    );

    // The context carries a secret; it must NEVER reach the command argv (interpolation is impossible).
    const out = await hooks.dispatch("before:execute", {
      ...BASE,
      context: { tags: ["token=sk-live-zzz"] },
    });

    expect(out.result.decision).toBe("allow");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.command).toBe("lint");
    expect(calls[0]!.args).toEqual(["--fix", "src"]);
    expect(calls[0]!.timeoutMs).toBe(5_000);
    expect(JSON.stringify(calls[0])).not.toContain("sk-live-zzz");
  });

  test("a non-zero exit throws and is isolated fail-open by the dispatcher (never a veto)", async () => {
    const sink = new RecordingSink();
    const runner: CommandRunner = () => Promise.resolve(7);
    const ran: string[] = [];

    const hooks = new HookDispatcher<Ctx>({ sink })
      .on(
        "before:execute",
        commandHandler({ command: "gate", args: [] }, runner),
      )
      .on("before:execute", () => {
        ran.push("after-cmd");
      });

    const out = await hooks.dispatch("before:execute", BASE);
    expect(out.errors).toBe(1);
    expect(out.result.decision).toBe("allow"); // a failing command never blocks the loop
    expect(ran).toEqual(["after-cmd"]);
    expect(sink.events[0]!.attributes).toEqual({
      hook: "before:execute",
      index: 0,
      error: "Error",
    });
  });

  test("defaults: no args → empty argv; uses the default 30s timeout", async () => {
    let captured: { args: readonly string[]; timeoutMs: number } | undefined;
    const runner: CommandRunner = (_command, args, timeoutMs) => {
      captured = { args, timeoutMs };
      return Promise.resolve(0);
    };
    const handler = commandHandler<Ctx>({ command: "noop" }, runner);
    await handler(BASE);
    expect(captured).toEqual({ args: [], timeoutMs: 30_000 });
  });
});

describe("commandHandler — env leak guard (THREAT: parent-secret inheritance), real default runner", () => {
  const CANARY_KEY = "CAISSON_LEAK_CANARY";

  test("with env supplied, the child does NOT see the canary and DOES see PATH", async () => {
    process.env[CANARY_KEY] = "leak";
    try {
      const handler = commandHandler<Ctx>({
        command: process.execPath,
        args: [
          "-e",
          `process.exit(process.env.${CANARY_KEY} ? 3 : (process.env.PATH ? 0 : 4))`,
        ],
        env: { PATH: process.env.PATH ?? "" },
      });
      // exit 0 → allow (no throw); exit 3 (canary leaked) or 4 (PATH missing) would throw.
      await expect(handler(BASE)).resolves.toBeUndefined();
    } finally {
      delete process.env[CANARY_KEY];
    }
  });

  test("with no env supplied (today's default), the child DOES see the canary — pins the inherit-everything default so a future flip shows up in CI", async () => {
    process.env[CANARY_KEY] = "leak";
    try {
      const handler = commandHandler<Ctx>({
        command: process.execPath,
        args: ["-e", `process.exit(process.env.${CANARY_KEY} ? 3 : 0)`],
      });
      await expect(handler(BASE)).rejects.toThrow("command hook exited 3");
    } finally {
      delete process.env[CANARY_KEY];
    }
  });
});
