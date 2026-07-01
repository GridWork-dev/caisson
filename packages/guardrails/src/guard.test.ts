// Guard contract (ADR-0063). The load-bearing safety properties: fail-closed by default on a
// moderator outage/timeout, `failOpen` honored ONLY when explicitly set, a positive verdict always
// blocks, the cheap pre-screen short-circuits before the (expensive) moderator, and every block
// throws `GuardrailError` 422 + emits a metadata-only event to the `EventSink`.
import { describe, expect, test } from "bun:test";
import { GuardrailError, InMemoryEventSink } from "@caisson/kernel";
import {
  guardInput,
  guardOutput,
  type GuardPolicy,
  type GuardRuntime,
} from "./guard.ts";
import {
  customModerator,
  localModerator,
  providerModerator,
  type Moderator,
} from "./moderator.ts";

const FIXED_NOW = new Date("2026-06-27T12:00:00.000Z");
function runtime(): { rt: GuardRuntime; sink: InMemoryEventSink } {
  const sink = new InMemoryEventSink();
  const rt: GuardRuntime = {
    tenantId: "acct_a",
    sink,
    now: () => FIXED_NOW,
    newId: () => "00000000-0000-4000-8000-000000000000",
  };
  return { rt, sink };
}

const clean = localModerator([]); // never flags
const policy = (over: Partial<GuardPolicy> = {}): GuardPolicy => ({
  policyName: "default",
  moderator: clean,
  ...over,
});

describe("guardInput — pass + PII redact", () => {
  test("a clean input passes and PII is masked; no block event", async () => {
    const { rt, sink } = runtime();
    const out = await guardInput(
      "email a@b.com please",
      policy({ pii: { mode: "mask" } }),
      rt,
    );
    expect(out.text).toBe("email [EMAIL] please");
    expect(out.tokens).toHaveLength(0);
    expect(sink.events).toHaveLength(0);
  });
});

describe("guardInput — moderation blocks", () => {
  test("a flagged input throws GuardrailError 422 + emits failClosed=false", async () => {
    const { rt, sink } = runtime();
    const p = policy({ moderator: localModerator(["forbidden"]) });
    let err: unknown;
    try {
      await guardInput("this is forbidden text", p, rt);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GuardrailError);
    expect((err as GuardrailError).httpStatus).toBe(422);
    expect((err as GuardrailError).code).toBe("guardrail_blocked");
    expect((err as GuardrailError).details).toEqual({
      stage: "input",
      category: "moderation",
    });
    expect(sink.events).toHaveLength(1);
    const ev = sink.events[0];
    expect(ev?.name).toBe("guardrail.blocked");
    expect(ev?.tenantId).toBe("acct_a");
    expect(ev?.attributes).toEqual({
      blockId: "00000000-0000-4000-8000-000000000000",
      stage: "input",
      category: "moderation",
      policy: "default",
      failClosed: false,
    });
    // The flagged content is NEVER carried on the event.
    expect(JSON.stringify(ev?.attributes)).not.toContain("forbidden");
  });
});

describe("fail-closed semantics", () => {
  test("a moderator timeout fails closed (failClosed=true)", async () => {
    const { rt, sink } = runtime();
    // A provider check that never resolves → the deadline trips.
    const stalled = providerModerator(() => new Promise(() => {}));
    let err: unknown;
    try {
      await guardInput(
        "hello",
        policy({ moderator: stalled, timeoutMs: 5 }),
        rt,
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GuardrailError);
    expect(sink.events[0]?.attributes.failClosed).toBe(true);
  });

  test("a moderator that throws fails closed", async () => {
    const { rt } = runtime();
    const broken = customModerator(() => {
      throw new Error("moderation backend down");
    });
    await expect(
      guardInput("hi", policy({ moderator: broken }), rt),
    ).rejects.toBeInstanceOf(GuardrailError);
  });

  test("failOpen is honored ONLY when explicitly set — an outage then passes", async () => {
    const { rt, sink } = runtime();
    const broken = customModerator(() => {
      throw new Error("moderation backend down");
    });
    const out = await guardInput(
      "hi",
      policy({ moderator: broken, failOpen: true }),
      rt,
    );
    expect(out.text).toBe("hi");
    expect(sink.events).toHaveLength(0);
  });

  test("failOpen does NOT override a positive verdict — flagged still blocks", async () => {
    const { rt } = runtime();
    const p = policy({ moderator: localModerator(["nope"]), failOpen: true });
    await expect(guardInput("a nope b", p, rt)).rejects.toBeInstanceOf(
      GuardrailError,
    );
  });
});

describe("cheap pre-screen", () => {
  test("a cheapDeny hit blocks BEFORE the (expensive) moderator is called", async () => {
    const { rt, sink } = runtime();
    let called = false;
    const spy: Moderator = {
      moderate() {
        called = true;
        return { flagged: false, category: "moderation" };
      },
    };
    const p = policy({ moderator: spy, cheapDeny: [/leak/i] });
    await expect(
      guardInput("please do not leak this", p, rt),
    ).rejects.toBeInstanceOf(GuardrailError);
    expect(called).toBe(false);
    expect(sink.events[0]?.attributes.failClosed).toBe(false);
  });

  test("a global-flagged cheapDeny blocks the same phrase on consecutive calls", async () => {
    const { rt } = runtime();
    // A `g`-flagged pattern has a sticky lastIndex; without a per-call reset the 2nd
    // identical call would search from the advanced offset and silently pass.
    const p = policy({ cheapDeny: [/leak/g] });
    await expect(
      guardInput("please do not leak this", p, rt),
    ).rejects.toBeInstanceOf(GuardrailError);
    await expect(
      guardInput("please do not leak this", p, rt),
    ).rejects.toBeInstanceOf(GuardrailError);
  });
});

describe("guardOutput", () => {
  test("a flagged output blocks at the output stage", async () => {
    const { rt, sink } = runtime();
    const p = policy({ moderator: localModerator(["secret"]) });
    let err: unknown;
    try {
      await guardOutput("the secret is out", p, rt);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GuardrailError);
    expect((err as GuardrailError).details).toEqual({
      stage: "output",
      category: "moderation",
    });
    expect(sink.events[0]?.attributes.stage).toBe("output");
  });

  test("a clean output passes", async () => {
    const { rt } = runtime();
    await expect(
      guardOutput("all good", policy(), rt),
    ).resolves.toBeUndefined();
  });
});
