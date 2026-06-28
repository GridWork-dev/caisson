import { describe, expect, test } from "bun:test";
import {
  allow,
  deny,
  evaluateGuards,
  isAllow,
  isDeny,
  isMutate,
  mutate,
  predicateGuard,
  type HookResult,
  type TransitionContext,
  type TransitionGuard,
} from "./governance.ts";

interface Ctx {
  readonly tag: string;
}
const CTX: TransitionContext<Ctx> = {
  from: "execute",
  to: "verify",
  context: { tag: "base" },
};

describe("HookResult — the one governance shape", () => {
  test("constructors produce the discriminated variants", () => {
    expect(allow<Ctx>()).toEqual({ decision: "allow" });
    expect(deny<Ctx>("nope")).toEqual({ decision: "deny", reason: "nope" });
    expect(mutate<Ctx>({ tag: "x" })).toEqual({
      decision: "mutate",
      context: { tag: "x" },
    });
  });

  test("the narrowing helpers select exactly one variant", () => {
    const variants: HookResult<Ctx>[] = [
      allow(),
      deny("r"),
      mutate({ tag: "m" }),
    ];
    expect(variants.map(isAllow)).toEqual([true, false, false]);
    expect(variants.map(isDeny)).toEqual([false, true, false]);
    expect(variants.map(isMutate)).toEqual([false, false, true]);
  });
});

describe("predicateGuard — pure predicate per transition", () => {
  test("allows when the predicate holds, denies(reason) when it does not", () => {
    const onlyToVerify = predicateGuard<Ctx>(
      (t) => t.to === "verify",
      "must transition into verify",
    );
    expect(onlyToVerify(CTX)).toEqual({ decision: "allow" });
    expect(onlyToVerify({ ...CTX, to: "ship" })).toEqual({
      decision: "deny",
      reason: "must transition into verify",
    });
  });
});

describe("evaluateGuards — folds the unified shape", () => {
  test("no guards (or all allow) yields allow", () => {
    expect(evaluateGuards<Ctx>([], CTX)).toEqual({ decision: "allow" });
    const allows: TransitionGuard<Ctx>[] = [() => allow(), () => allow()];
    expect(evaluateGuards(allows, CTX)).toEqual({ decision: "allow" });
  });

  test("the first deny short-circuits (fail-closed); later guards do not run", () => {
    const calls: string[] = [];
    const result = evaluateGuards<Ctx>(
      [
        () => {
          calls.push("a");
          return allow();
        },
        () => {
          calls.push("b");
          return deny("blocked by policy");
        },
        () => {
          calls.push("c");
          return allow();
        },
      ],
      CTX,
    );
    expect(result).toEqual({ decision: "deny", reason: "blocked by policy" });
    expect(calls).toEqual(["a", "b"]);
  });

  test("a mutate threads its context to downstream guards and returns mutate(final)", () => {
    const seen: string[] = [];
    const result = evaluateGuards<Ctx>(
      [
        (t) => {
          seen.push(t.context.tag);
          return mutate({ tag: "mid" });
        },
        (t) => {
          seen.push(t.context.tag);
          return mutate({ tag: "final" });
        },
      ],
      CTX,
    );
    expect(seen).toEqual(["base", "mid"]);
    expect(result).toEqual({ decision: "mutate", context: { tag: "final" } });
  });

  test("a deny after a mutate still denies (deny wins)", () => {
    const result = evaluateGuards<Ctx>(
      [() => mutate({ tag: "mid" }), () => deny("vetoed")],
      CTX,
    );
    expect(result).toEqual({ decision: "deny", reason: "vetoed" });
  });

  test("a guard that throws is a fail-closed deny and never surfaces the thrown value", () => {
    const result = evaluateGuards<Ctx>(
      [
        () => {
          throw new Error("super-secret-token-abc123");
        },
      ],
      CTX,
    );
    expect(result).toEqual({ decision: "deny", reason: "guard threw" });
    expect(isDeny(result) && result.reason).not.toContain("secret");
  });
});
