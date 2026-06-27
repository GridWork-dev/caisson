import { describe, expect, test } from "bun:test";
import { HookDispatcher, type HookContext } from "./hooks.ts";

const CTX: HookContext = { act: "execute", phase: "before" };

describe("hooks dispatcher", () => {
  test("handlers run in registration order, each awaited", async () => {
    const calls: string[] = [];
    const hooks = new HookDispatcher()
      .on("before:execute", async (ctx) => {
        await Promise.resolve();
        calls.push(`first:${ctx.act}:${ctx.phase}`);
      })
      .on("before:execute", () => {
        calls.push("second");
      });

    const invoked = await hooks.dispatch("before:execute", CTX);
    expect(invoked).toBe(2);
    expect(calls).toEqual(["first:execute:before", "second"]);
    expect(hooks.count("before:execute")).toBe(2);
  });

  test("dispatching an unregistered point is a no-op (0 handlers), never a throw", async () => {
    const hooks = new HookDispatcher();
    expect(hooks.count("after:ship")).toBe(0);
    await expect(hooks.dispatch("after:ship", CTX)).resolves.toBe(0);
  });

  test("registration is keyed per hook point", async () => {
    const calls: string[] = [];
    const hooks = new HookDispatcher()
      .on("before:execute", () => {
        calls.push("be");
      })
      .on("after:execute", () => {
        calls.push("ae");
      });

    await hooks.dispatch("after:execute", { act: "execute", phase: "after" });
    expect(calls).toEqual(["ae"]);
  });
});
