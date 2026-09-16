// ADR-0423: server-owned records bind an external approval round-trip to immutable input.
// A digest is not authentication of an untrusted store: adapters must keep this store private.
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CommandSpec } from "./propose.ts";

/** ADR-0427: pending approvals expire fifteen minutes after issuance, without renewal. */
export const APPROVAL_TTL_MS = 15 * 60 * 1000;

export const toolApprovalSchema = z
  .object({
    approvalId: z.uuid(),
    expiresAt: z.number().int().nonnegative().safe(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    policyVersion: z.string().min(1).max(200),
    name: z.string().min(1).max(256),
    command: z.string().min(1).max(4096),
    args: z.array(z.string().max(32768)).max(256),
    reason: z.string().max(4000).optional(),
  })
  .strict();

export type ToolApproval = z.infer<typeof toolApprovalSchema>;
export interface StoredToolApproval {
  readonly proposal: ToolApproval;
  /** Original input is retained to re-run object-to-argv transforms against the current schema. */
  readonly input: unknown;
  readonly policyFingerprint: string;
}

export interface ToolApprovalStore {
  /** Create only: reject duplicate IDs. Do not expose this method to an approval client. */
  put(record: StoredToolApproval): Promise<void>;
  /** Atomically get-and-delete; missing/already consumed IDs return undefined. */
  consume(approvalId: string): Promise<StoredToolApproval | undefined>;
  /** Atomically delete without returning an executable record; true only when pending. */
  reject(approvalId: string): Promise<boolean>;
}

/** Durable adapters must enforce expiry and mutually atomic consume/reject themselves. */
export function createMemoryApprovalStore(
  now: () => number = Date.now,
): ToolApprovalStore {
  const records = new Map<string, StoredToolApproval>();
  const pruneExpired = () => {
    const at = now();
    for (const [id, record] of records) {
      if (at >= record.proposal.expiresAt) records.delete(id);
    }
  };
  return {
    async put(record) {
      pruneExpired();
      if (now() >= record.proposal.expiresAt)
        throw new Error("Approval already expired");
      const id = record.proposal.approvalId;
      if (records.has(id) || records.size >= 1000) {
        throw new Error(
          "Approval store refused duplicate or excess pending record",
        );
      }
      records.set(id, structuredClone(record));
    },
    async consume(id) {
      const record = records.get(id);
      records.delete(id); // Before yielding: concurrent executions have at most one winner.
      return record && now() < record.proposal.expiresAt ? record : undefined;
    },
    async reject(id) {
      pruneExpired();
      return records.delete(id); // Competes atomically with consume; never spawns.
    },
  };
}

export function approvalDigest(proposal: Omit<ToolApproval, "digest">): string {
  // Fixed tuple order, string-only argv, and explicit absent reason avoid object-order ambiguity.
  return createHash("sha256")
    .update(
      JSON.stringify([
        proposal.approvalId,
        proposal.expiresAt,
        proposal.name,
        proposal.command,
        proposal.args,
        proposal.reason ?? null,
        proposal.policyVersion,
      ]),
    )
    .digest("hex");
}

export function commandPolicyFingerprint(spec: CommandSpec): string {
  const env =
    spec.env === undefined
      ? null
      : Object.entries(spec.env).sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256")
    .update(JSON.stringify([spec.command, spec.policyVersion ?? "1", env]))
    .digest("hex");
}

export function equalApprovalDigest(left: string, right: string): boolean {
  const hex = /^[a-f0-9]{64}$/;
  return (
    hex.test(left) &&
    hex.test(right) &&
    timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"))
  );
}
