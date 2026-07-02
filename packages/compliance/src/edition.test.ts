// ADR-0178 (mirroring ADR-0199): the Compliance edition BUNDLES @caisson/alerting +
// @caisson/retention-runner, so both operational-compliance primitives must be reachable from the ONE
// edition import home AND wired as live gates on the composed edition. This proves the WIRE — each
// primitive's own pipeline behavior is covered in its own package.
import { describe, expect, test } from "bun:test";
import {
  createCaptureAuditSink,
  createComplianceEdition,
  createInMemoryAuditSink,
  processAlert,
  runErasure,
} from "./index.ts";

describe("compliance edition — bundled alerting + retention gates (ADR-0178)", () => {
  test("the alerting + retention surfaces are re-exported from the one edition import home", () => {
    expect(typeof processAlert).toBe("function");
    expect(typeof runErasure).toBe("function");
    expect(typeof createComplianceEdition).toBe("function");
  });

  test("the composed edition exposes a live alerting gate bound to its audit sink", async () => {
    const auditSink = createInMemoryAuditSink();
    const edition = createComplianceEdition({ alerting: { auditSink } });
    const result = await edition.alerting.process(
      {
        id: "evt-1",
        type: "compliance.export_requested",
        severity: "info",
        tenantId: "t-1",
        recipient: "ops@example.com",
        dedupeKey: "k-1",
        title: "Export requested",
        body: "A tenant requested an evidence export.",
        createdAt: 0,
      },
      {
        openIncidents: [],
        recentCount: 0,
        ratePolicy: { maxPerWindow: 5 },
        recipientTz: "UTC",
        quietPolicy: { startHour: 0, endHour: 0 },
        now: new Date("2026-07-02T12:00:00.000Z"),
      },
    );
    // No channels ⇒ delivered with zero deliveries; exactly one audit row is written to the sink.
    expect(result.outcome).toBe("delivered");
    expect(result.deliveries).toEqual([]);
    expect(auditSink.rows).toHaveLength(1);
    expect(auditSink.rows[0]?.eventId).toBe("evt-1");
  });

  test("the composed edition exposes a live erasure runner bound to its audit sink", async () => {
    const auditSink = createCaptureAuditSink();
    const edition = createComplianceEdition({ retention: { auditSink } });
    const result = await edition.retention.run(
      { subjectId: "s-1", tenantId: "t-1", reason: "ccpa_request" },
      () => 1_700_000_000_000,
    );
    // No targets ⇒ an empty results set; exactly one reason-tagged audit row is written.
    expect(result.results).toEqual([]);
    expect(result.reason).toBe("ccpa_request");
    expect(auditSink.rows).toHaveLength(1);
    expect(auditSink.rows[0]?.at).toBe(1_700_000_000_000);
  });

  test("each pipeline defaults to an in-memory audit sink so a run never drops its row", () => {
    const edition = createComplianceEdition();
    expect(edition.alerting.auditSink).toBeDefined();
    expect(edition.retention.auditSink).toBeDefined();
    expect(edition.alerting.channels).toEqual([]);
    expect(edition.retention.targets).toEqual([]);
  });
});
