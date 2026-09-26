// observe.test.ts — the operational EventSink mirror (ADR-0075). Two assertions per emitter:
//   1. Exactly one event lands on the sink, with the right name + tenant + the edge-injected clock
//      (clock at the edge: the emitted timestamp is byte-for-byte the instant the caller passed).
//   2. The attributes carry ONLY the opaque, non-PII fields — never ciphertext, never a control body.
import { describe, expect, test } from "bun:test";
import { InMemoryEventSink } from "@caisson-sh/kernel";
import {
  ERASURE_CRYPTO_SHRED,
  EVIDENCE_GENERATED,
  emitErasureCryptoShred,
  emitEvidenceGenerated,
} from "./observe.ts";

describe("compliance operational telemetry (ADR-0075)", () => {
  test("emitEvidenceGenerated emits one ops event with the edge clock + posture counts", async () => {
    const sink = new InMemoryEventSink();
    await emitEvidenceGenerated(sink, {
      tenantId: "tenant-1",
      framework: "soc2-tsc",
      sha256: "a".repeat(64),
      controlCount: 12,
      flaggedCount: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event?.name).toBe(EVIDENCE_GENERATED);
    expect(EVIDENCE_GENERATED).toBe("evidence.generated");
    expect(event?.tenantId).toBe("tenant-1");
    // Clock at the edge: emitted timestamp == the injected instant (no internal Date.now()).
    expect(event?.timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(event?.attributes).toEqual({
      framework: "soc2-tsc",
      sha256: "a".repeat(64),
      controlCount: 12,
      flaggedCount: 1,
    });
  });

  test("emitErasureCryptoShred mirrors the WORM erasure record as an ops event (no PII)", async () => {
    const sink = new InMemoryEventSink();
    await emitErasureCryptoShred(sink, {
      tenantId: "tenant-1",
      subjectId: "subject-9",
      reason: "gdpr-art17",
      shreddedThroughVersion: 3,
      deletion: {
        state: "pending-deletion",
        irreversible: false,
        scheduledFor: "2026-02-09T00:00:00.000Z",
      },
      occurredAt: "2026-02-02T00:00:00.000Z",
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event?.name).toBe(ERASURE_CRYPTO_SHRED);
    // The ops name is single-sourced from the WORM chain's event name — they can never drift.
    expect(ERASURE_CRYPTO_SHRED).toBe("erasure.crypto-shred");
    expect(event?.tenantId).toBe("tenant-1");
    expect(event?.timestamp).toBe("2026-02-02T00:00:00.000Z");
    expect(event?.attributes).toEqual({
      subjectId: "subject-9",
      reason: "gdpr-art17",
      shreddedThroughVersion: 3,
      deletion: {
        state: "pending-deletion",
        irreversible: false,
        scheduledFor: "2026-02-09T00:00:00.000Z",
      },
    });
  });
});
