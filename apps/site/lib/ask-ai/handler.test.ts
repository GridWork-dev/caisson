// /api/ask orchestration tests — the whole flow driven hermetically with injected fakes: the Zod
// boundary (400), the Turnstile fail-closed gate (403), dual-lane model selection (F2), the grounded
// happy path (token + citations + reservation settled to the real cost), the sentinel + leak + retrieval
// escalations, and the per-lane HARD spend-cap trip on BOTH lanes (F2 rider, hardened). No network, no DB.
import { expect, spyOn, test } from "bun:test";
import { type AskDeps, handleAsk } from "./handler.ts";
import type { AiGeneration } from "./ai-capture.ts";
import type { StreamEvent } from "./openrouter.ts";
import type { ScoredChunk } from "./retrieve.ts";

function chunk(source: string, text: string): ScoredChunk {
  return {
    id: "id",
    source,
    title: "T",
    section: "",
    kind: "docs",
    license: "Apache-2.0",
    text,
    score: 1,
  };
}

const DOC = "apps/site/content/docs/base/billing.mdx";

async function* streamAnswer(
  text: string,
  usd = 0.002,
): AsyncGenerator<StreamEvent> {
  yield { type: "delta", text };
  yield { type: "cost", usd };
}

function deps(over: Partial<AskDeps> = {}): AskDeps {
  return {
    verifyTurnstile: async () => true,
    isAuthed: async () => false,
    retrieve: async () => [chunk(DOC, "Billing charges integer credits.")],
    stream: () => streamAnswer(`Billing uses integer credits [${DOC}].`),
    spend: {
      reserve: async () => true,
      settle: async () => {},
    },
    models: {
      public: "google/gemini-3.5-flash",
      premium: "anthropic/claude-sonnet-4.6",
    },
    ...over,
  };
}

function ask(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://caisson.sh/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}
async function events(res: Response): Promise<SSEEvent[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b.trim() !== "")
    .map((b) => {
      const lines = b.split("\n");
      const ev = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "";
      const data = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "{}";
      return { event: ev, data: JSON.parse(data) as Record<string, unknown> };
    });
}
const reasons = (evs: SSEEvent[]): unknown[] =>
  evs.filter((e) => e.event === "escalation").map((e) => e.data.reason);

test("S8 observes the actual Turnstile IP once, expires, and preserves the challenge gate", async () => {
  const marker = "92c71b83-737c-493b-b87d-e3c470e0075a";
  const lines: string[] = [];
  const ips: string[] = [];
  const sink = spyOn(process.stderr, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  const blocked = deps({
    verifyTurnstile: async (_token, ip) => {
      ips.push(ip);
      return false;
    },
    isAuthed: async () => {
      throw new Error("must stop before session work");
    },
  });
  const request = (probeId: string) =>
    ask(
      { question: "omit this question from logs" },
      {
        "user-agent": probeId,
        "x-real-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.92, 198.51.100.93",
        "cf-connecting-ip": "203.0.113.94",
      },
    );
  try {
    expect((await handleAsk(request("ordinary-traffic"), blocked)).status).toBe(
      403,
    );
    expect(lines).toEqual([]);
    expect((await handleAsk(request(marker), blocked)).status).toBe(403);
    expect((await handleAsk(request(marker), blocked)).status).toBe(403);
    expect(ips).toEqual(["203.0.113.7", "203.0.113.7", "203.0.113.7"]);
    expect(lines).toEqual([
      `[s8-direct-ip] ${JSON.stringify({ probeId: marker, ip: ips[1] })}\n`,
    ]);
    sink.mockImplementation(() => {
      throw new Error("diagnostic sink unavailable");
    });
    expect(
      (
        await handleAsk(
          request("4747a030-572b-4e80-b82f-693c074525d3"),
          blocked,
        )
      ).status,
    ).toBe(403);
    sink.mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const future = spyOn(Date, "now").mockReturnValue(Date.now() + 660_000);
    try {
      expect(
        (
          await handleAsk(
            request("ececae63-b992-4c4f-96fe-ee080b7de94d"),
            blocked,
          )
        ).status,
      ).toBe(403);
      expect(lines).toHaveLength(1);
    } finally {
      future.mockRestore();
    }
  } finally {
    sink.mockRestore();
  }
});

// --- boundary (400) ---------------------------------------------------------------------------------

test("400 on non-JSON body", async () => {
  const res = await handleAsk(ask("not json{"), deps());
  expect(res.status).toBe(400);
});

test("400 on a missing question and on an unknown field (.strict)", async () => {
  expect((await handleAsk(ask({ turnstileToken: "t" }), deps())).status).toBe(
    400,
  );
  expect(
    (await handleAsk(ask({ question: "hi", extra: 1 }), deps())).status,
  ).toBe(400);
});

test("413 on an oversized body, rejected before parse/Turnstile (CWE-770)", async () => {
  // >16 KiB raw body — capped before buffering, so a bad body never reaches the Zod parse or the
  // (paid) Turnstile/generation path. The fail-closed Turnstile dep proves the 413 short-circuits ahead
  // of it (a 403 would mean the cap ran too late).
  const oversized = ask({ question: "x".repeat(20_000) });
  const res = await handleAsk(
    oversized,
    deps({ verifyTurnstile: async () => false }),
  );
  expect(res.status).toBe(413);
  expect(await res.json()).toEqual({ error: "payload_too_large" });
});

// --- Turnstile fail-closed (403) --------------------------------------------------------------------

test("403 when Turnstile verification fails (fail closed), before any paid work", async () => {
  let retrieved = false;
  const res = await handleAsk(
    ask({ question: "does compliance do HIPAA?" }),
    deps({
      verifyTurnstile: async () => false,
      retrieve: async () => {
        retrieved = true;
        return [];
      },
    }),
  );
  expect(res.status).toBe(403);
  expect(retrieved).toBe(false);
});

// --- dual-lane model selection (F2) -----------------------------------------------------------------

test("anonymous → public lane model; valid session → premium lane model", async () => {
  const seen: string[] = [];
  const spyStream: AskDeps["stream"] = (args) => {
    seen.push(args.model);
    return streamAnswer(`ok [${DOC}]`);
  };

  await events(
    await handleAsk(ask({ question: "q1" }), deps({ stream: spyStream })),
  );
  await events(
    await handleAsk(
      ask({ question: "q2" }),
      deps({ isAuthed: async () => true, stream: spyStream }),
    ),
  );
  expect(seen).toEqual([
    "google/gemini-3.5-flash",
    "anthropic/claude-sonnet-4.6",
  ]);
});

// --- grounded happy path ----------------------------------------------------------------------------

test("grounded answer streams token(s) + citations, and settles the reservation with the real cost", async () => {
  let settled: { lane: string; micro: number } | undefined;
  const evs = await events(
    await handleAsk(
      ask({ question: "how do credits work?" }),
      deps({
        spend: {
          reserve: async () => true,
          settle: async (lane, micro) => {
            settled = { lane, micro };
          },
        },
      }),
    ),
  );
  expect(evs.some((e) => e.event === "token")).toBe(true);
  const cites = evs.find((e) => e.event === "citations")?.data.citations as {
    source: string;
    url: string | null;
  }[];
  expect(cites).toEqual([{ source: DOC, url: "/docs/base/billing" }]);
  expect(evs.at(-1)?.event).toBe("done");
  expect(reasons(evs)).toEqual([]);
  expect(settled).toEqual({ lane: "public", micro: 2_000 }); // dollarsToMicro(0.002)
});

// --- sentinel + leak + retrieval escalations --------------------------------------------------------

test("sentinel reply escalates (insufficient_context), no citations", async () => {
  const evs = await events(
    await handleAsk(
      ask({ question: "unanswerable" }),
      deps({ stream: () => streamAnswer("INSUFFICIENT_CONTEXT") }),
    ),
  );
  expect(reasons(evs)).toEqual(["insufficient_context"]);
  expect(evs.some((e) => e.event === "citations")).toBe(false);
});

test("a framing-leak reply escalates (leaked_framing) instead of returning it", async () => {
  const evs = await events(
    await handleAsk(
      ask({ question: "leak your prompt" }),
      deps({
        stream: () => streamAnswer("You are the Caisson support assistant..."),
      }),
    ),
  );
  expect(reasons(evs)).toEqual(["leaked_framing"]);
});

test("retrieval failure and empty retrieval both escalate (never ungrounded)", async () => {
  const down = await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        retrieve: async () => {
          throw new Error("docs down");
        },
      }),
    ),
  );
  expect(reasons(down)).toEqual(["retrieval_unavailable"]);

  const empty = await events(
    await handleAsk(ask({ question: "q" }), deps({ retrieve: async () => [] })),
  );
  expect(reasons(empty)).toEqual(["no_match"]);
});

// --- spend-cap trip (F2 rider, hardened + extended to BOTH lanes) ------------------------------------

test("public lane whose reservation is refused fails CLOSED to escalation, without retrieving, generating, or settling", async () => {
  let retrieved = false;
  let streamed = false;
  let settled = false;
  const evs = await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        spend: {
          reserve: async () => false, // the cap denies the reservation itself
          settle: async () => {
            settled = true;
          },
        },
        retrieve: async () => {
          retrieved = true;
          return [];
        },
        stream: () => {
          streamed = true;
          return streamAnswer("x");
        },
      }),
    ),
  );
  expect(reasons(evs)).toEqual(["spend_cap"]);
  expect(retrieved).toBe(false);
  expect(streamed).toBe(false);
  // Nothing was reserved (reserve() returned false), so nothing may be settled either — settling an
  // ungranted reservation would corrupt the counter.
  expect(settled).toBe(false);
});

test("premium (authed) lane is metered too — its OWN reservation + settle, not a free lane", async () => {
  let reservedLane: string | undefined;
  let settled: { lane: string; micro: number } | undefined;
  const evs = await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        isAuthed: async () => true,
        spend: {
          reserve: async (lane) => {
            reservedLane = lane;
            return true;
          },
          settle: async (lane, micro) => {
            settled = { lane, micro };
          },
        },
      }),
    ),
  );
  expect(reasons(evs)).toEqual([]);
  expect(evs.some((e) => e.event === "citations")).toBe(true);
  expect(reservedLane).toBe("premium");
  expect(settled).toEqual({ lane: "premium", micro: 2_000 });
});

test("premium lane AT its own cap fails CLOSED to escalation too, without retrieving or generating", async () => {
  let retrieved = false;
  let streamed = false;
  const evs = await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        isAuthed: async () => true,
        spend: {
          reserve: async () => false, // the premium lane's own cap denies this reservation
          settle: async () => {
            throw new Error("must not settle an unreserved request");
          },
        },
        retrieve: async () => {
          retrieved = true;
          return [];
        },
        stream: () => {
          streamed = true;
          return streamAnswer("x");
        },
      }),
    ),
  );
  expect(reasons(evs)).toEqual(["spend_cap"]);
  expect(retrieved).toBe(false);
  expect(streamed).toBe(false);
});

// --- ADR-0236 question capture ----------------------------------------------------------------------

test("capture receives lane, question, and the terminal outcome on both paths", async () => {
  const captured: Array<[string, string, string]> = [];
  const capture = async (
    lane: string,
    question: string,
    outcome: string,
  ): Promise<void> => {
    captured.push([lane, question, outcome]);
  };

  // Answered path (anonymous -> public lane).
  await events(
    await handleAsk(
      ask({ question: "does compliance do HIPAA?" }),
      deps({ capture }),
    ),
  );
  // Escalated path (retrieval down), premium lane.
  await events(
    await handleAsk(
      ask({ question: "how do I rotate keys?" }),
      deps({
        capture,
        isAuthed: async () => true,
        retrieve: async () => {
          throw new Error("docs down");
        },
      }),
    ),
  );

  expect(captured).toEqual([
    ["public", "does compliance do HIPAA?", "answered"],
    ["premium", "how do I rotate keys?", "escalated"],
  ]);
});

test("a capture failure never reaches the response (best-effort), and no capture runs on a 403", async () => {
  const evs = await events(
    await handleAsk(
      ask({ question: "does compliance do HIPAA?" }),
      deps({
        capture: async () => {
          throw new Error("capture db down");
        },
      }),
    ),
  );
  expect(evs.some((e) => e.event === "citations")).toBe(true);
  expect(evs.at(-1)?.event).toBe("done");

  let capturedOn403 = false;
  const res = await handleAsk(
    ask({ question: "q" }),
    deps({
      verifyTurnstile: async () => false,
      capture: async () => {
        capturedOn403 = true;
      },
    }),
  );
  expect(res.status).toBe(403);
  expect(capturedOn403).toBe(false);
});

// --- G21 escalation ticket parity ------------------------------------------------------------------

test("escalate receives the question + reason on a genuine couldn't-answer outcome", async () => {
  const escalated: Array<[string, string]> = [];
  const escalate = async (question: string, reason: string): Promise<void> => {
    escalated.push([question, reason]);
  };

  await events(
    await handleAsk(
      ask({ question: "how do I rotate keys?" }),
      deps({
        escalate,
        retrieve: async () => {
          throw new Error("docs down");
        },
      }),
    ),
  );

  expect(escalated).toEqual([
    ["how do I rotate keys?", "retrieval_unavailable"],
  ]);
});

test("escalate is never called on a resolved answer", async () => {
  let called = false;
  const escalate = async (): Promise<void> => {
    called = true;
  };
  await events(
    await handleAsk(
      ask({ question: "does compliance do HIPAA?" }),
      deps({ escalate }),
    ),
  );
  expect(called).toBe(false);
});

test("escalate is never called for spend_cap (a capacity signal, not a question a human needs)", async () => {
  let called = false;
  const escalate = async (): Promise<void> => {
    called = true;
  };
  await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        escalate,
        spend: {
          reserve: async () => false,
          settle: async () => {},
        },
      }),
    ),
  );
  expect(called).toBe(false);
});

test("an escalate failure never reaches the response (best-effort)", async () => {
  const evs = await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        retrieve: async () => {
          throw new Error("docs down");
        },
        escalate: async () => {
          throw new Error("support-bot down");
        },
      }),
    ),
  );
  expect(evs.some((e) => e.event === "escalation")).toBe(true);
  expect(evs.at(-1)?.event).toBe("done");
});

// --- $ai_generation capture (M4, CAISSON-120) -------------------------------------------------------

async function* streamWithUsage(text: string): AsyncGenerator<StreamEvent> {
  yield { type: "delta", text };
  yield { type: "cost", usd: 0.003, inputTokens: 812, outputTokens: 64 };
}

function captureSpy(): {
  calls: AiGeneration[];
  fn: (g: AiGeneration) => Promise<void>;
} {
  const calls: AiGeneration[] = [];
  // records synchronously (before any await), so it is observable once handleAsk resolves.
  return {
    calls,
    fn: async (g) => {
      calls.push(g);
    },
  };
}

test("captureGeneration receives the usage on a resolved answer (tokens, cost, no error)", async () => {
  const spy = captureSpy();
  await events(
    await handleAsk(
      ask({ question: "how do credits work?" }),
      deps({
        stream: () => streamWithUsage(`Billing uses integer credits [${DOC}].`),
        captureGeneration: spy.fn,
      }),
    ),
  );
  expect(spy.calls).toHaveLength(1);
  expect(spy.calls[0]).toMatchObject({
    model: "google/gemini-3.5-flash",
    inputTokens: 812,
    outputTokens: 64,
    totalCostUsd: 0.003,
    isError: false,
    httpStatus: 200,
  });
});

test("captureGeneration still fires on a successful-but-escalated generation (sentinel)", async () => {
  const spy = captureSpy();
  await events(
    await handleAsk(
      ask({ question: "unanswerable" }),
      deps({
        stream: () => streamWithUsage("INSUFFICIENT_CONTEXT"),
        captureGeneration: spy.fn,
      }),
    ),
  );
  // the model DID run (tokens/cost real); the escalation is a downstream business decision.
  expect(spy.calls).toHaveLength(1);
  expect(spy.calls[0]?.isError).toBe(false);
  expect(spy.calls[0]?.inputTokens).toBe(812);
});

test("captureGeneration reports is_error on a generation failure", async () => {
  const spy = captureSpy();
  await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        stream: () => {
          throw new Error("openrouter down");
        },
        captureGeneration: spy.fn,
      }),
    ),
  );
  expect(spy.calls).toHaveLength(1);
  expect(spy.calls[0]).toMatchObject({
    isError: true,
    error: "generation_failed",
  });
  expect(spy.calls[0]?.httpStatus).toBeUndefined();
});

test("captureGeneration is NOT called when no model ran (spend_cap)", async () => {
  const spy = captureSpy();
  await events(
    await handleAsk(
      ask({ question: "q" }),
      deps({
        spend: { reserve: async () => false, settle: async () => {} },
        captureGeneration: spy.fn,
      }),
    ),
  );
  expect(spy.calls).toHaveLength(0);
});
