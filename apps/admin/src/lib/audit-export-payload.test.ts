import { expect, test } from "bun:test";
import { allowlistAuditExportPayload } from "./audit-export-payload.ts";
import type {
  FIRST_PARTY_AUDIT_EXPORT_EVENTS,
  FIRST_PARTY_AUDIT_EXPORT_KINDS,
} from "./audit-export-payload.ts";

test("known events export only their per-event allowlist and unknown events fail closed", () => {
  expect(
    allowlistAuditExportPayload({
      source: "admin_action",
      action: "system_mode",
      actorEmail: "operator@example.com",
      targetAccountId: "acct_a",
      before: { mode: "active", auth: "before-secret" },
      after: { mode: "read_only", credentials: "after-secret" },
      at: "2026-07-25T12:00:00.000Z",
      clientAssertion: "top-level-secret",
    }),
  ).toEqual({
    payload: {
      source: "admin_action",
      action: "system_mode",
      actorEmail: "operator@example.com",
      targetAccountId: "acct_a",
      before: { mode: "active" },
      after: { mode: "read_only" },
      at: "2026-07-25T12:00:00.000Z",
    },
    droppedPaths: ["$.unrecognized"],
  });

  expect(
    allowlistAuditExportPayload({
      source: "future_event",
      credentials: { value: "hunter2" },
    }),
  ).toEqual({
    payload: {},
    droppedPaths: ["$.unrecognized"],
  });
});

test("an unknown or ambiguous primary discriminator cannot fall through to another schema", () => {
  for (const payload of [
    {
      source: "future_event",
      kind: "risk.residual-overridden",
      riskId: "risk-1",
      computed: 12,
      override: 8,
      who: "operator-1",
      why: "must not fall through",
      at: "2026-07-25T12:00:00.000Z",
    },
    {
      source: "admin_action",
      action: "future_action",
      kind: "risk.residual-overridden",
      riskId: "risk-1",
      computed: 12,
      override: 8,
      who: "operator-1",
      why: "must not fall through",
      at: "2026-07-25T12:00:00.000Z",
    },
    {
      kind: "risk.residual-overridden",
      event: "erasure.crypto-shred",
      riskId: "risk-1",
      computed: 12,
      override: 8,
      who: "operator-1",
      why: "ambiguous discriminator",
      at: "2026-07-25T12:00:00.000Z",
    },
    {
      kind: "future.kind",
      event: "erasure.crypto-shred",
      deletion: { state: "soft-deleted", irreversible: false },
      method: "kms-key-deletion",
      tenantId: "tenant-1",
      subjectId: "subject-1",
      reason: "must not fall through",
      occurredAt: "2026-07-25T12:00:00.000Z",
      shreddedThroughVersion: 2,
    },
  ]) {
    expect(allowlistAuditExportPayload(payload).payload).toEqual({});
  }
});

test("prototype-chain discriminator names fail closed without throwing", () => {
  for (const discriminator of [
    "constructor",
    "toString",
    "hasOwnProperty",
    "__proto__",
  ]) {
    expect(
      allowlistAuditExportPayload({
        source: "admin_action",
        action: discriminator,
      }),
    ).toEqual({ payload: {}, droppedPaths: ["$.unrecognized"] });
    expect(allowlistAuditExportPayload({ kind: discriminator })).toEqual({
      payload: {},
      droppedPaths: ["$.unrecognized"],
    });
    expect(allowlistAuditExportPayload({ event: discriminator })).toEqual({
      payload: {},
      droppedPaths: ["$.unrecognized"],
    });
  }
});

test("export schemas accept the real producer boundary values", () => {
  const now = "2026-07-25T12:00:00.000Z";
  expect(
    allowlistAuditExportPayload({
      source: "admin_action",
      action: "license_reissue",
      actorEmail: "operator@example.com",
      targetAccountId: "account-1",
      before: { major: 0 },
      after: { major: 0, licenseId: null },
      at: now,
    }).payload,
  ).not.toEqual({});
  expect(
    allowlistAuditExportPayload({
      kind: "retention.escalated",
      key: "account-1/evidence/pack.bin",
      versionId: "v".repeat(1024),
      from: null,
      to: now,
      mode: "GOVERNANCE",
    }).payload,
  ).not.toEqual({});
  const maxMemberId = "m".repeat(320);
  expect(
    allowlistAuditExportPayload({
      kind: "access-review.campaign.opened",
      campaignId: "campaign-1",
      reviewerId: maxMemberId,
      reviewees: [maxMemberId],
      openedAt: now,
      deadlineAt: now,
    }).payload,
  ).not.toEqual({});
});

test("dropped-field metadata never echoes attacker-controlled key names", () => {
  const secretBearingKey = "sk-proj-abcdefghijklmnop";
  const result = allowlistAuditExportPayload({
    source: "future_event",
    [secretBearingKey]: "opaque",
  });

  expect(result.payload).toEqual({});
  expect(result.droppedPaths).toEqual(["$.unrecognized"]);
  expect(JSON.stringify(result)).not.toContain(secretBearingKey);
});

test("legacy non-object payloads fail closed and are marked undisclosed", () => {
  for (const payload of [
    "legacy-event",
    ["legacy-event"],
    42,
    true,
    null,
  ] as const) {
    expect(allowlistAuditExportPayload(payload)).toEqual({
      payload: {},
      droppedPaths: ["$.unrecognized"],
    });
  }
});

test("every code-derived non-admin event discriminator has a working fail-closed schema", () => {
  const now = "2026-07-25T12:00:00.000Z";
  const kindFixtures = {
    "impersonation.operator": {
      kind: "impersonation.operator",
      sessionId: "session-1",
      operatorId: "operator-1",
      action: "session.begin",
      reason: "support investigation",
      expiresAt: now,
    },
    "impersonation.tenant": {
      kind: "impersonation.tenant",
      sessionId: "session-1",
      targetAccountId: "account-1",
      action: "session.begin",
    },
    "access-review.campaign.opened": {
      kind: "access-review.campaign.opened",
      campaignId: "campaign-1",
      reviewerId: "reviewer-1",
      reviewees: ["reviewee-1"],
      openedAt: now,
      deadlineAt: now,
    },
    "access-review.decision": {
      kind: "access-review.decision",
      campaignId: "campaign-1",
      reviewerId: "reviewer-1",
      revieweeId: "reviewee-1",
      decision: "approve",
    },
    "access-review.campaign.closed": {
      kind: "access-review.campaign.closed",
      campaignId: "campaign-1",
      closedAt: now,
      reason: "completed",
      unresolved: [],
    },
    "retention.escalated": {
      kind: "retention.escalated",
      key: "account-1/evidence/pack.bin",
      from: null,
      to: now,
      mode: "GOVERNANCE",
    },
    "risk.residual-overridden": {
      kind: "risk.residual-overridden",
      riskId: "risk-1",
      computed: 12,
      override: 8,
      who: "operator-1",
      why: "documented compensating control",
      at: now,
    },
    "artifact.locked": {
      kind: "artifact.locked",
      artifactId: "artifact-1",
      artifactHash: "a".repeat(64),
    },
  } satisfies Record<(typeof FIRST_PARTY_AUDIT_EXPORT_KINDS)[number], object>;
  const eventFixtures = {
    "erasure.crypto-shred": {
      event: "erasure.crypto-shred",
      deletion: { state: "soft-deleted", irreversible: false },
      method: "kms-key-deletion",
      tenantId: "tenant-1",
      subjectId: "subject-1",
      reason: "gdpr-art17",
      occurredAt: now,
      shreddedThroughVersion: 2,
    },
  } satisfies Record<(typeof FIRST_PARTY_AUDIT_EXPORT_EVENTS)[number], object>;

  for (const [kind, fixture] of Object.entries(kindFixtures)) {
    const result = allowlistAuditExportPayload({
      ...fixture,
      credential: "must-drop",
    });
    expect(result.payload).toEqual(fixture);
    expect(result.droppedPaths).toEqual(["$.unrecognized"]);
    expect((result.payload as { kind?: string }).kind).toBe(kind);
  }
  for (const [event, fixture] of Object.entries(eventFixtures)) {
    const result = allowlistAuditExportPayload({
      ...fixture,
      setCookie: "must-drop",
    });
    expect(result.payload).toEqual(fixture);
    expect(result.droppedPaths).toEqual(["$.unrecognized"]);
    expect((result.payload as { event?: string }).event).toBe(event);
  }
});
