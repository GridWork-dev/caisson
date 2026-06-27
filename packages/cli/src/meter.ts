// The codegen credit-debit seam (ADR-0049/0024/0007). Every generation meters a credit DEBIT
// BEFORE any file is written (debit-before-spend): a short balance returns 402 and nothing is
// written; a retried generation with the same `idempotencyKey` debits once. Both `create-caisson`
// and the buyer MCP call `runGeneration`, minting/accepting one `idempotencyKey` (UUID) per
// generation. Runs inside `withTenant` so the debit + the ledger are tenant-scoped (ADR-0005).
import type { CreditResult } from "@caisson/credits";
import { debit } from "@caisson/credits";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import type { RegistryIndex } from "@caisson/registry";
import {
  type GeneratedFileSet,
  type GeneratorEngine,
  type Selection,
  generate,
} from "./generate.ts";

/** A generation's billing identity. `idempotencyKey` is a caller-minted UUID, one per generation. */
export interface MeterInput {
  accountId: string;
  idempotencyKey: string;
  /** Credits per generation. Integer (ADR-0007). Defaults to 1. */
  amount?: number;
}

/** Debit one codegen charge. Throws `InsufficientCreditsError` (402) on a short balance. */
export function meterGeneration(
  tx: TenantExecutor,
  input: MeterInput,
): Promise<CreditResult> {
  return debit(tx, {
    accountId: input.accountId,
    amount: input.amount ?? 1,
    eventType: "codegen_debit",
    idempotencyKey: input.idempotencyKey,
  });
}

/** The disk-write seam (P5). Default: none ships in Wave 0 (generation returns the file set only). */
export type FileSetWriter = (
  targetDir: string,
  files: GeneratedFileSet,
) => Promise<void>;

export interface GenerationDeps {
  index: RegistryIndex;
  engine?: GeneratorEngine;
  /** Injected at P5 to materialize to disk (re-asserts path safety). Omitted → nothing is written. */
  writeFileSet?: FileSetWriter;
  /** Where a P5 writer would materialize. Unused until a writer is injected. */
  targetDir?: string;
}

export interface GenerationOutcome {
  selection: Selection;
  files: GeneratedFileSet;
  balance: number;
  idempotent: boolean;
}

/**
 * The full gated generation flow, in one `withTenant` transaction:
 *   1. validate + allowlist-gate the selection (throws before any side effect),
 *   2. DEBIT before spend (402 aborts the whole transaction — nothing is written),
 *   3. write the file set (P5 seam; only if a writer is injected).
 * A retried call with the same `idempotencyKey` debits once (ADR-0024). The debit strictly precedes
 * the write: on a 402, step 3 is never reached, so a failed generation writes nothing.
 */
export async function runGeneration(
  tx: TenantExecutor,
  deps: GenerationDeps,
  raw: unknown,
  meter: MeterInput,
): Promise<GenerationOutcome> {
  const { selection, files } = generate(deps.index, raw, deps.engine);
  const result = await meterGeneration(tx, meter); // debit-before-spend; 402 throws here
  if (deps.writeFileSet) {
    await deps.writeFileSet(deps.targetDir ?? selection.projectName, files);
  }
  return {
    selection,
    files,
    balance: result.balance,
    idempotent: result.idempotent,
  };
}
