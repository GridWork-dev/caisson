import { z } from "zod";
import type { JsonValue } from "@caisson/kernel";
import type { AdminAction } from "@caisson/service-license";

type AdminWormAction = Exclude<AdminAction, "audit_proof_read">;

/**
 * The real `source:"admin_action"` WORM events emitted by services/license and intel-triage.
 * `audit_proof_read` is intentionally absent: its source declaration records a DB-only read log and
 * explicitly appends no WORM event.
 */
export const ADMIN_AUDIT_EXPORT_ACTIONS = [
  "entitlement_grant",
  "entitlement_revoke",
  "credit_adjust",
  "license_reissue",
  "purchase_revoke",
  "license_first_mint",
  "email_resend",
  "system_mode",
  "license_rotate",
  "intel_review",
  "intel_dismiss",
  "affiliate_mint",
] as const satisfies readonly AdminWormAction[];

/**
 * Every non-admin first-party WORM `kind` discriminator emitted by production code. Sources:
 * compliance impersonation, access-review campaigns, audit-worm retention escalation,
 * risk-register residual overrides, and the compliance reference leg.
 */
export const FIRST_PARTY_AUDIT_EXPORT_KINDS = [
  "impersonation.operator",
  "impersonation.tenant",
  "access-review.campaign.opened",
  "access-review.decision",
  "access-review.campaign.closed",
  "retention.escalated",
  "risk.residual-overridden",
  "artifact.locked",
] as const;

/** First-party WORM `event` discriminators minted outside the `kind` convention. */
export const FIRST_PARTY_AUDIT_EXPORT_EVENTS = [
  "erasure.crypto-shred",
] as const;

function allowlistedObject<const Shape extends z.ZodRawShape>(
  shape: Shape,
): z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodObject<Shape>> {
  const allowed = new Set(Object.keys(shape));
  return z
    .transform((input: unknown) => {
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return input;
      }
      return Object.fromEntries(
        Object.entries(input).filter(([key]) => allowed.has(key)),
      );
    })
    .pipe(z.object(shape).strict());
}

const shortString = z.string().min(1).max(2048);
const opaqueId = z.string().min(1).max(256);
const idList = z.array(opaqueId).max(10_000);
const accessReviewMemberId = z.string().min(1).max(320);
const accessReviewMemberList = z.array(accessReviewMemberId).max(10_000);
const timestamp = z.iso.datetime();

const modeSnapshot = allowlistedObject({
  mode: z.enum(["active", "read_only"]),
});
const entitlementSnapshot = allowlistedObject({ entitlements: idList });
const balanceSnapshot = allowlistedObject({
  balance: z.number().int().nonnegative(),
});
const creditAfterSnapshot = allowlistedObject({
  balance: z.number().int().nonnegative(),
  applied: z.number().int(),
  reason: shortString,
});
const licenseBeforeSnapshot = allowlistedObject({
  major: z.number().int().nonnegative(),
});
const licenseIdSnapshot = allowlistedObject({
  major: z.number().int().nonnegative(),
  licenseId: opaqueId.nullable(),
});
const licenseRotateAfterSnapshot = allowlistedObject({
  major: z.number().int().nonnegative(),
  licenseId: opaqueId,
  deniedLicenseIds: idList,
  reason: shortString.nullable(),
});
const emailAfterSnapshot = allowlistedObject({
  orderId: opaqueId,
  entitlementCount: z.number().int().nonnegative(),
});
const purchaseBeforeSnapshot = allowlistedObject({
  entitlements: idList,
  balance: z.number().int().nonnegative(),
});
const purchaseAfterSnapshot = allowlistedObject({
  entitlements: idList,
  balance: z.number().int().nonnegative(),
  purchaseId: opaqueId,
  revoked: z.number().int().nonnegative(),
  clawedBack: z.number().int().nonnegative(),
  deniedLicenseIds: idList,
  reason: shortString.nullable(),
});
const affiliateAfterSnapshot = allowlistedObject({
  code: opaqueId,
  discountId: opaqueId,
  affiliateName: shortString,
});
const intelBeforeSnapshot = allowlistedObject({ status: shortString });
const reviewedAfterSnapshot = allowlistedObject({
  status: z.literal("reviewed"),
});
const dismissedAfterSnapshot = allowlistedObject({
  status: z.literal("dismissed"),
});
const kmsDeletionReceipt = z.union([
  allowlistedObject({
    state: z.enum(["destroyed", "purged"]),
    irreversible: z.literal(true),
  }),
  allowlistedObject({
    state: z.enum(["pending-deletion", "destroy-scheduled", "soft-deleted"]),
    irreversible: z.literal(false),
    scheduledFor: timestamp.optional(),
  }),
]);

function adminEventShape<Action extends AdminWormAction>(
  action: Action,
  before: z.ZodType,
  after: z.ZodType,
  extra: z.ZodRawShape = {},
): z.ZodType {
  return allowlistedObject({
    source: z.literal("admin_action"),
    action: z.literal(action),
    actorEmail: z.string().min(1).max(320),
    targetAccountId: opaqueId,
    before,
    after,
    at: timestamp,
    ...extra,
  });
}

const adminAuditExportSchemas = {
  entitlement_grant: adminEventShape(
    "entitlement_grant",
    entitlementSnapshot,
    entitlementSnapshot,
  ),
  entitlement_revoke: adminEventShape(
    "entitlement_revoke",
    entitlementSnapshot,
    entitlementSnapshot,
  ),
  credit_adjust: adminEventShape(
    "credit_adjust",
    balanceSnapshot,
    creditAfterSnapshot,
  ),
  license_reissue: adminEventShape(
    "license_reissue",
    licenseBeforeSnapshot,
    licenseIdSnapshot,
  ),
  purchase_revoke: adminEventShape(
    "purchase_revoke",
    purchaseBeforeSnapshot,
    purchaseAfterSnapshot,
  ),
  license_first_mint: adminEventShape(
    "license_first_mint",
    licenseIdSnapshot,
    licenseIdSnapshot,
  ),
  email_resend: adminEventShape("email_resend", z.null(), emailAfterSnapshot),
  system_mode: adminEventShape("system_mode", modeSnapshot, modeSnapshot),
  license_rotate: adminEventShape(
    "license_rotate",
    licenseIdSnapshot,
    licenseRotateAfterSnapshot,
  ),
  intel_review: adminEventShape(
    "intel_review",
    intelBeforeSnapshot,
    reviewedAfterSnapshot,
    { findingId: opaqueId },
  ),
  intel_dismiss: adminEventShape(
    "intel_dismiss",
    intelBeforeSnapshot,
    dismissedAfterSnapshot,
    { findingId: opaqueId },
  ),
  affiliate_mint: adminEventShape(
    "affiliate_mint",
    z.null(),
    affiliateAfterSnapshot,
  ),
} satisfies Readonly<Record<AdminWormAction, z.ZodType>>;

type FirstPartyAuditKind = (typeof FIRST_PARTY_AUDIT_EXPORT_KINDS)[number];
type FirstPartyAuditEvent = (typeof FIRST_PARTY_AUDIT_EXPORT_EVENTS)[number];

const kindAuditExportSchemas = {
  "impersonation.operator": allowlistedObject({
    kind: z.literal("impersonation.operator"),
    sessionId: opaqueId,
    operatorId: opaqueId,
    action: shortString,
    reason: shortString,
    expiresAt: timestamp,
  }),
  "impersonation.tenant": allowlistedObject({
    kind: z.literal("impersonation.tenant"),
    sessionId: opaqueId,
    targetAccountId: opaqueId,
    action: shortString,
  }),
  "access-review.campaign.opened": allowlistedObject({
    kind: z.literal("access-review.campaign.opened"),
    campaignId: opaqueId,
    reviewerId: accessReviewMemberId,
    reviewees: accessReviewMemberList,
    openedAt: timestamp,
    deadlineAt: timestamp,
  }),
  "access-review.decision": allowlistedObject({
    kind: z.literal("access-review.decision"),
    campaignId: opaqueId,
    reviewerId: accessReviewMemberId,
    revieweeId: accessReviewMemberId,
    decision: z.enum(["approve", "revoke"]),
  }),
  "access-review.campaign.closed": allowlistedObject({
    kind: z.literal("access-review.campaign.closed"),
    campaignId: opaqueId,
    closedAt: timestamp,
    reason: z.enum(["completed", "deadline"]),
    unresolved: accessReviewMemberList,
  }),
  "retention.escalated": allowlistedObject({
    kind: z.literal("retention.escalated"),
    key: z.string().min(1).max(4096),
    versionId: z.string().min(1).max(1024).optional(),
    from: timestamp.nullable(),
    to: timestamp,
    mode: z.enum(["GOVERNANCE", "COMPLIANCE"]).nullable(),
  }),
  "risk.residual-overridden": allowlistedObject({
    kind: z.literal("risk.residual-overridden"),
    riskId: opaqueId,
    computed: z.number().int().min(1).max(25),
    override: z.number().int().min(1).max(25),
    who: z.string().min(1).max(200),
    why: z.string().min(1).max(2000),
    at: timestamp,
  }),
  "artifact.locked": allowlistedObject({
    kind: z.literal("artifact.locked"),
    artifactId: opaqueId,
    artifactHash: z.string().regex(/^[0-9a-f]{64}$/u),
  }),
} satisfies Readonly<Record<FirstPartyAuditKind, z.ZodType>>;

const eventAuditExportSchemas = {
  "erasure.crypto-shred": allowlistedObject({
    event: z.literal("erasure.crypto-shred"),
    deletion: kmsDeletionReceipt,
    method: z.literal("kms-key-deletion"),
    tenantId: opaqueId,
    subjectId: opaqueId,
    reason: z.string().min(1).max(512),
    occurredAt: timestamp,
    shreddedThroughVersion: z.number().int().nonnegative(),
  }),
} satisfies Readonly<Record<FirstPartyAuditEvent, z.ZodType>>;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function containsDroppedFields(original: unknown, exported: unknown): boolean {
  if (Array.isArray(original)) {
    if (!Array.isArray(exported) || original.length !== exported.length) {
      return true;
    }
    return original.some((value, index) =>
      containsDroppedFields(value, exported[index]),
    );
  }
  const originalObject = objectRecord(original);
  const exportedObject = objectRecord(exported);
  // Every registered export schema emits an object. A primitive or array therefore changed when it
  // failed closed to `{}` and must be marked undisclosed; otherwise the verifier would recompute the
  // original row hash against `{}` and falsely report a valid legacy row as tampered.
  if (originalObject === null) return original !== exported;
  for (const [key, value] of Object.entries(originalObject)) {
    if (exportedObject === null || !Object.hasOwn(exportedObject, key)) {
      return true;
    }
    if (containsDroppedFields(value, exportedObject[key])) {
      return true;
    }
  }
  return false;
}

function ownSchema(
  schemas: Readonly<Record<string, z.ZodType>>,
  discriminator: unknown,
): z.ZodType | undefined {
  return typeof discriminator === "string" &&
    Object.hasOwn(schemas, discriminator)
    ? schemas[discriminator]
    : undefined;
}

const UNRECOGNIZED_FIELDS_SENTINEL = "$.unrecognized";

export interface AuditExportPayload {
  readonly payload: JsonValue;
  /** Fixed metadata only: unknown attacker-controlled key names are never echoed across the boundary. */
  readonly droppedPaths: readonly string[];
}

/**
 * Fail-closed export projection. Only a real registered admin WORM event with a valid per-action
 * schema emits fields. Unknown event types or schema-invalid known events emit `{}`.
 */
export function allowlistAuditExportPayload(
  input: JsonValue,
): AuditExportPayload {
  const record = objectRecord(input);
  const action = record?.["action"];
  const kind = record?.["kind"];
  const event = record?.["event"];
  let schema: z.ZodType | undefined;
  if (record !== null && Object.hasOwn(record, "source")) {
    schema =
      record["source"] === "admin_action" &&
      !Object.hasOwn(record, "kind") &&
      !Object.hasOwn(record, "event")
        ? ownSchema(adminAuditExportSchemas, action)
        : undefined;
  } else if (record !== null && Object.hasOwn(record, "kind")) {
    schema = !Object.hasOwn(record, "event")
      ? ownSchema(kindAuditExportSchemas, kind)
      : undefined;
  } else if (record !== null && Object.hasOwn(record, "event")) {
    schema = ownSchema(eventAuditExportSchemas, event);
  }
  const parsed = schema?.safeParse(input);
  const payload = parsed?.success === true ? jsonValue(parsed.data) : {};
  return {
    payload,
    droppedPaths: containsDroppedFields(input, payload)
      ? [UNRECOGNIZED_FIELDS_SENTINEL]
      : [],
  };
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
