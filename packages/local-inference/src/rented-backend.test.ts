// Unit tests for the rented/hosted inference backend SEAM (ADR-0064).
// SHAPE ONLY, NO NETWORK: the wire call is a deterministic `RentedTransport` double and
// the meter sink captures the emitted `UsageMetering` records. These tests pin the two safety
// invariants — OFF BY DEFAULT (the privacy guard gates construction) and METERED (every call emits
// one integer + idempotent record) — without ever opening a socket. The live transport's wire runs
// only in the gated live proof (ADR-0201); its construction gate is pinned here.
import { describe, expect, test } from "bun:test";
import { AuthzError, InternalError, ValidationError } from "@caisson-sh/kernel";
import type { UsageMetering } from "@caisson-sh/kernel";
import { createEgressGuard } from "@caisson-sh/local-privacy";
import { ZERO_EGRESS_POLICY, localOnlyPolicy } from "@caisson-sh/local-privacy";
import { EMBEDDING_DIM } from "./backend.ts";
import {
  RentedInferenceBackend,
  createLiveRentedTransport,
} from "./rented-backend.ts";
import type { MeterSink, RentedTransport } from "./rented-backend.ts";

const HOST = "inference.example.com";
const ENDPOINT = `https://${HOST}/v1`;
const TEST_DIM = 4;

/** A guard whose policy allowlists HOST as a `rented-backend` sanctioned sink (the opt-in posture). */
function rentedGuard() {
  return createEgressGuard(
    localOnlyPolicy([{ host: HOST, kind: "rented-backend" }]),
  );
}

/** A deterministic transport double — no network. Echoes a fixed-`dim` vector + integer usage. */
function fakeTransport(dim: number): RentedTransport {
  return {
    embed: ({ text }) =>
      Promise.resolve({
        vector: Array.from({ length: dim }, (_, i) => (i + 1) / (dim + 1)),
        usage: { unit: "token", quantity: text.length },
      }),
    complete: ({ prompt }) =>
      Promise.resolve({
        text: `rented:${prompt}`,
        model: "vendor/model-x",
        usage: { unit: "token", quantity: 7 },
      }),
  };
}

/** A capturing meter sink — collects every emitted record for assertion. */
function capturingMeter(): { sink: MeterSink; records: UsageMetering[] } {
  const records: UsageMetering[] = [];
  return {
    records,
    sink: (record) => {
      records.push(record);
    },
  };
}

function makeBackend(overrides: { dim?: number; meter?: MeterSink } = {}) {
  const dim = overrides.dim ?? TEST_DIM;
  return new RentedInferenceBackend({
    endpoint: ENDPOINT,
    guard: rentedGuard(),
    transport: fakeTransport(dim),
    meter: overrides.meter ?? (() => {}),
    tenantId: "tenant-a",
    feature: "local-ai.rented-inference",
    model: "vendor/model-x",
    dim,
  });
}

describe("RentedInferenceBackend — OFF BY DEFAULT (gated by the privacy guard)", () => {
  test("zero-egress (default) policy blocks construction — no rented path without opt-in", () => {
    expect(
      () =>
        new RentedInferenceBackend({
          endpoint: ENDPOINT,
          guard: createEgressGuard(ZERO_EGRESS_POLICY),
          transport: fakeTransport(TEST_DIM),
          meter: () => {},
          tenantId: "tenant-a",
          feature: "local-ai.rented-inference",
          model: "vendor/model-x",
          dim: TEST_DIM,
        }),
    ).toThrow(AuthzError);
  });

  test("a host allowlisted as the WRONG kind (model-fetch) is rejected", () => {
    const guard = createEgressGuard(
      localOnlyPolicy([{ host: HOST, kind: "model-fetch" }]),
    );
    expect(
      () =>
        new RentedInferenceBackend({
          endpoint: ENDPOINT,
          guard,
          transport: fakeTransport(TEST_DIM),
          meter: () => {},
          tenantId: "tenant-a",
          feature: "local-ai.rented-inference",
          model: "vendor/model-x",
          dim: TEST_DIM,
        }),
    ).toThrow(AuthzError);
  });

  test("a non-https endpoint fails closed even when the host is allowlisted", () => {
    expect(
      () =>
        new RentedInferenceBackend({
          endpoint: `http://${HOST}/v1`,
          guard: rentedGuard(),
          transport: fakeTransport(TEST_DIM),
          meter: () => {},
          tenantId: "tenant-a",
          feature: "local-ai.rented-inference",
          model: "vendor/model-x",
          dim: TEST_DIM,
        }),
    ).toThrow(AuthzError);
  });

  test("an allowlisted `rented-backend` host constructs and exposes the port surface", () => {
    const backend = makeBackend();
    expect(backend.model).toBe("vendor/model-x");
    expect(backend.dim).toBe(TEST_DIM);
  });

  test("defaults dim to the locked EMBEDDING_DIM when omitted", () => {
    const backend = new RentedInferenceBackend({
      endpoint: ENDPOINT,
      guard: rentedGuard(),
      transport: fakeTransport(EMBEDDING_DIM),
      meter: () => {},
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: "vendor/model-x",
    });
    expect(backend.dim).toBe(EMBEDDING_DIM);
  });

  test("a non-positive dim fails closed at construction", () => {
    expect(() => makeBackend({ dim: 0 })).toThrow(ValidationError);
  });
});

describe("RentedInferenceBackend — METERED CALL SHAPE (one integer + idempotent record per call)", () => {
  test("embed returns a locked-dim vector and emits one metered record", async () => {
    const meter = capturingMeter();
    const backend = makeBackend({ meter: meter.sink });
    const vec = await backend.embed("hello");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(TEST_DIM);

    expect(meter.records).toHaveLength(1);
    const rec = meter.records[0];
    expect(rec).toBeDefined();
    if (!rec) throw new Error("expected a metered record");
    expect(rec.tenantId).toBe("tenant-a");
    expect(rec.feature).toBe("local-ai.rented-inference");
    expect(rec.unit).toBe("token");
    expect(rec.quantity).toBe(5); // "hello".length, an integer (ADR-0007)
    expect(Number.isInteger(rec.quantity)).toBe(true);
    expect(rec.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(() => new Date(rec.occurredAt).toISOString()).not.toThrow();
  });

  test("complete returns text + model and emits one metered record", async () => {
    const meter = capturingMeter();
    const backend = makeBackend({ meter: meter.sink });
    const out = await backend.complete({ prompt: "summarize" });
    expect(out.text).toBe("rented:summarize");
    expect(out.model).toBe("vendor/model-x");
    expect(meter.records).toHaveLength(1);
    expect(meter.records[0]?.quantity).toBe(7);
  });

  test("each call mints a fresh idempotency key (no double-charge on replay of one key)", async () => {
    const meter = capturingMeter();
    const backend = makeBackend({ meter: meter.sink });
    await backend.embed("alpha");
    await backend.embed("alpha");
    expect(meter.records).toHaveLength(2);
    expect(meter.records[0]?.idempotencyKey).not.toBe(
      meter.records[1]?.idempotencyKey,
    );
  });
});

describe("RentedInferenceBackend — fail-closed boundaries", () => {
  test("a transport vector of the wrong width fails closed (dim-guard)", async () => {
    const meter = capturingMeter();
    const backend = new RentedInferenceBackend({
      endpoint: ENDPOINT,
      guard: rentedGuard(),
      transport: fakeTransport(TEST_DIM + 1), // backend opened at TEST_DIM
      meter: meter.sink,
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: "vendor/model-x",
      dim: TEST_DIM,
    });
    await expect(backend.embed("x")).rejects.toThrow(InternalError);
    expect(meter.records).toHaveLength(0); // never metered a failed call
  });

  test("a malformed transport response is rejected at the boundary", async () => {
    const badTransport: RentedTransport = {
      embed: () =>
        // missing `usage` → strict parse fails closed
        Promise.resolve({
          vector: [0.1, 0.2, 0.3, 0.4],
        } as unknown as Awaited<ReturnType<RentedTransport["embed"]>>),
      complete: fakeTransport(TEST_DIM).complete,
    };
    const backend = new RentedInferenceBackend({
      endpoint: ENDPOINT,
      guard: rentedGuard(),
      transport: badTransport,
      meter: () => {},
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: "vendor/model-x",
      dim: TEST_DIM,
    });
    await expect(backend.embed("x")).rejects.toThrow(ValidationError);
  });

  test("a meter sink that throws fails the call (a paid call must be recordable)", async () => {
    const backend = makeBackend({
      meter: () => {
        throw new Error("ledger unavailable");
      },
    });
    await expect(backend.embed("x")).rejects.toThrow("ledger unavailable");
  });
});

describe("createLiveRentedTransport — purpose-bound construction gate (ADR-0201)", () => {
  test("an endpoint sanctioned for a DIFFERENT kind (model-fetch) is refused before any call", () => {
    const guard = createEgressGuard(
      localOnlyPolicy([{ host: HOST, kind: "model-fetch" }]),
    );
    expect(() =>
      createLiveRentedTransport({ endpoint: ENDPOINT, guard }),
    ).toThrow(AuthzError);
  });

  test("a zero-egress policy refuses construction outright (fail-closed-to-offline)", () => {
    const guard = createEgressGuard(ZERO_EGRESS_POLICY);
    expect(() =>
      createLiveRentedTransport({ endpoint: ENDPOINT, guard }),
    ).toThrow(AuthzError);
  });

  test("a rented-backend-sanctioned endpoint constructs (the wire itself stays live-only)", () => {
    const transport = createLiveRentedTransport({
      endpoint: ENDPOINT,
      guard: rentedGuard(),
    });
    expect(typeof transport.embed).toBe("function");
    expect(typeof transport.complete).toBe("function");
  });
});
