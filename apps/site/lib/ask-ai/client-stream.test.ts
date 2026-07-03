// Ask-AI widget state-machine tests (ADR-0234). The browser flow is a pure reducer + SSE parser, so the
// loading → streaming → cited path and the insufficient / capped / error fail-safes are driven directly
// — no DOM, no React (the repo has no browser-test harness by design; the state machine IS the unit).
import { expect, test } from "bun:test";
import {
  type AskEvent,
  type AskState,
  INITIAL,
  citationLabel,
  parseSse,
  reduceAsk,
} from "./client-stream.ts";

/** Drive a sequence of events through the reducer from `loading` (the imperative start state). */
function run(events: AskEvent[]): AskState {
  return events.reduce<AskState>(reduceAsk, { status: "loading" });
}

const CITE = {
  source: "apps/site/content/docs/base/billing.mdx",
  url: "/docs/base/billing",
};

// --- the happy path: loading → streaming → cited ---------------------------------------------------

test("token deltas accumulate into streaming, citations resolve to cited", () => {
  const s1 = reduceAsk(
    { status: "loading" },
    { type: "token", delta: "Credits " },
  );
  expect(s1).toEqual({ status: "streaming", answer: "Credits " });

  const s2 = reduceAsk(s1, { type: "token", delta: "are integer units." });
  expect(s2).toEqual({
    status: "streaming",
    answer: "Credits are integer units.",
  });

  const s3 = reduceAsk(s2, { type: "citations", citations: [CITE] });
  expect(s3).toEqual({
    status: "cited",
    answer: "Credits are integer units.",
    citations: [CITE],
  });

  // done after a terminal state is a no-op.
  expect(reduceAsk(s3, { type: "done" })).toBe(s3);
});

// --- fail-safes: insufficient / no_match / capped --------------------------------------------------

test("insufficient_context escalation → escalated(insufficient_context)", () => {
  expect(run([{ type: "escalation", reason: "insufficient_context" }])).toEqual(
    {
      status: "escalated",
      reason: "insufficient_context",
    },
  );
});

test("no_match escalation → escalated(no_match)", () => {
  expect(run([{ type: "escalation", reason: "no_match" }])).toEqual({
    status: "escalated",
    reason: "no_match",
  });
});

test("spend_cap escalation → escalated(spend_cap) [capped]", () => {
  expect(run([{ type: "escalation", reason: "spend_cap" }])).toEqual({
    status: "escalated",
    reason: "spend_cap",
  });
});

test("a stream that ends mid-answer without citations fails safe to escalated", () => {
  expect(
    run([{ type: "token", delta: "half an answer" }, { type: "done" }]),
  ).toEqual({
    status: "escalated",
    reason: "generation_failed",
  });
});

test("transport error is terminal", () => {
  expect(reduceAsk(INITIAL, { type: "error", kind: "challenge" })).toEqual({
    status: "error",
    kind: "challenge",
  });
});

// --- SSE parsing ------------------------------------------------------------------------------------

test("parseSse decodes framed events and keeps a partial tail for the next chunk", () => {
  const { events, rest } = parseSse(
    'event: token\ndata: {"delta":"Hi"}\n\nevent: citations\ndata: {"citations":[{"source":"a","url":null}]}\n\nevent: to',
  );
  expect(events).toEqual([
    { type: "token", delta: "Hi" },
    { type: "citations", citations: [{ source: "a", url: null }] },
  ]);
  expect(rest).toBe("event: to");
});

test("parseSse feeds the reducer end-to-end across a split boundary", () => {
  let state: AskState = { status: "loading" };
  let buffer = 'event: token\ndata: {"delta":"Cred';
  let out = parseSse(buffer);
  buffer = out.rest;
  for (const ev of out.events) state = reduceAsk(state, ev);
  expect(state.status).toBe("loading"); // no complete frame yet

  buffer +=
    'its work."}\n\nevent: escalation\ndata: {"reason":"spend_cap"}\n\n';
  out = parseSse(buffer);
  for (const ev of out.events) state = reduceAsk(state, ev);
  expect(state).toEqual({ status: "escalated", reason: "spend_cap" });
});

test("an unknown escalation reason coerces to a safe generic, never crashes", () => {
  const { events } = parseSse('event: escalation\ndata: {"reason":"wat"}\n\n');
  expect(events).toEqual([{ type: "escalation", reason: "generation_failed" }]);
});

// --- citation labels --------------------------------------------------------------------------------

test("citationLabel: doc slug leaf, index/README named by parent section", () => {
  expect(citationLabel(CITE)).toBe("billing");
  expect(citationLabel({ source: "x", url: "/docs/getting-started" })).toBe(
    "getting started",
  );
  expect(
    citationLabel({ source: "packages/kernel/README.md", url: null }),
  ).toBe("kernel");
  expect(citationLabel({ source: "x", url: "/docs/base/index" })).toBe("base");
});
