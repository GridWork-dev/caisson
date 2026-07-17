// POST /api/demo/run handler — the full contract exercised hermetically with fake deps (no DB, no
// network), same pattern as lib/ask-ai/handler.test.ts. Covers: .strict() unknown-field reject,
// malformed + oversize body, kill switch, FAIL-CLOSED Turnstile, the 429 rate-limit path, the F5 503,
// the happy 200 shape, and the generation-failure path (release still runs).
import { describe, expect, test } from "bun:test";
import { type DemoRunDeps, DemoRunBody, handleDemoRun } from "./handler.ts";
import type { DemoRunResult } from "./run.ts";

const RESULT: DemoRunResult = {
  tree: [{ path: "README.md", bytes: 42 }],
  files: { "README.md": "# demo" },
  moduleSummary: { total: 2, oss: 1, paid: 1, modules: [] },
  generatedInMs: 3,
};

interface Calls {
  released: number;
  leads: { email: string; runId: string; ip: string }[];
}

function makeDeps(over: Partial<DemoRunDeps> = {}): {
  deps: DemoRunDeps;
  calls: Calls;
} {
  const calls: Calls = { released: 0, leads: [] };
  const deps: DemoRunDeps = {
    enabled: () => true,
    verifyTurnstile: async () => true,
    checkRate: async () => ({ allowed: true, retryAfterSec: 0 }),
    reserve: async () => ({ ok: true }),
    release: async () => {
      calls.released++;
    },
    generate: () => RESULT,
    recordLead: async (email, runId, ip) => {
      calls.leads.push({ email, runId, ip });
    },
    ...over,
  };
  return { deps, calls };
}

function req(body: unknown, headers: Record<string, string> = {}): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://caisson.sh/api/demo/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "1.2.3.4",
      ...headers,
    },
    body: text,
  });
}

const VALID = {
  email: "buyer@example.com",
  projectName: "my-demo",
  turnstileToken: "tok",
};

describe("body validation", () => {
  test("rejects an unknown field (.strict) → 400", async () => {
    const { deps } = makeDeps();
    const res = await handleDemoRun(req({ ...VALID, admin: true }), deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  test("rejects a non-slug projectName → 400", async () => {
    const { deps } = makeDeps();
    const res = await handleDemoRun(
      req({ ...VALID, projectName: "Bad Name" }),
      deps,
    );
    expect(res.status).toBe(400);
  });

  test("rejects malformed JSON → 400", async () => {
    const { deps } = makeDeps();
    const res = await handleDemoRun(req("{not json"), deps);
    expect(res.status).toBe(400);
  });

  test("rejects an oversize body pre-parse → 413", async () => {
    const { deps } = makeDeps();
    const res = await handleDemoRun(
      req({ ...VALID, filler: "A".repeat(9000) }),
      deps,
    );
    expect(res.status).toBe(413);
  });
});

describe("gates", () => {
  test("kill switch off → 503 disabled, no work done", async () => {
    const { deps, calls } = makeDeps({ enabled: () => false });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ reason: "disabled" });
    expect(calls.released).toBe(0);
  });

  test("FAIL-CLOSED Turnstile → 403", async () => {
    const { deps } = makeDeps({ verifyTurnstile: async () => false });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "challenge_failed" });
  });

  test("rate-limited → 429 with Retry-After", async () => {
    const { deps } = makeDeps({
      checkRate: async () => ({ allowed: false, retryAfterSec: 42 }),
    });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(await res.json()).toEqual({
      error: "rate_limited",
      retryAfterSec: 42,
    });
  });

  test("F5 reserve tripped → 503 with the reason", async () => {
    const { deps, calls } = makeDeps({
      reserve: async () => ({ ok: false, reason: "daily-cap" }),
    });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ reason: "daily-cap" });
    expect(calls.released).toBe(0); // nothing reserved → nothing to release
  });
});

describe("run", () => {
  test("happy path → 200 with the bounded artifact + runId; releases + records the lead", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.runId).toBe("string");
    expect(body.tree).toEqual(RESULT.tree);
    expect(body.files).toEqual(RESULT.files);
    expect(body.moduleSummary).toEqual(RESULT.moduleSummary);
    expect(body.generatedInMs).toBe(3);
    expect(calls.released).toBe(1);
    expect(calls.leads).toHaveLength(1);
    expect(calls.leads[0]).toMatchObject({
      email: "buyer@example.com",
      ip: "1.2.3.4",
    });
    expect(calls.leads[0]?.runId).toBe(body.runId as string);
  });

  test("generation failure → 500, concurrency slot still released", async () => {
    const { deps, calls } = makeDeps({
      generate: () => {
        throw new Error("boom");
      },
    });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "generation_failed" });
    expect(calls.released).toBe(1);
  });

  test("a telemetry failure never fails the response", async () => {
    const { deps } = makeDeps({
      recordLead: async () => {
        throw new Error("telemetry down");
      },
    });
    const res = await handleDemoRun(req(VALID), deps);
    expect(res.status).toBe(200);
  });
});

describe("body schema", () => {
  test("email is lowercased + trimmed (telemetry normalization)", () => {
    const parsed = DemoRunBody.parse({
      ...VALID,
      email: "  Buyer@Example.COM ",
    });
    expect(parsed.email).toBe("buyer@example.com");
  });
});
