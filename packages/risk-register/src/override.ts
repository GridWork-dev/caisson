// src/override.ts — an operator override of a computed residual is a deliberate, WORM-logged
// exception, never a plain audit row and never a freeform edit to the entry itself: `RiskEntry`'s
// own `residual` field stays exactly what `computeResidual` derived (nothing outside model.ts can
// mint a `Residual` value any other way), and an override lives here as its own chained record —
// who asserted it, why, when, and the computed value it supersedes — appended to the tenant's WORM
// audit chain (`@caisson/audit-worm`) the same way a retention escalation is: the chain append IS
// the exception record, not a description of one filed somewhere else. The computed value rides
// alongside the override in the SAME record, so it stays recoverable straight off the chain even
// once an override is in force.
import { InternalError, ValidationError } from "@caisson/kernel";
import type { AppendResult, AuditChainStore } from "@caisson/audit-worm";
import {
  computeResidual,
  isResidual,
  type Impact,
  type Likelihood,
  type Residual,
} from "./model.ts";

const RESIDUAL_OVERRIDE_KIND = "risk.residual-overridden" as const;

export interface RecordResidualOverrideInput {
  /** The tenant's audit chain — the override is evidence, not a log line. Typed as a narrow
   *  `Pick` (mirrors `@caisson/audit-worm`'s own escalation helper) so a caller can inject a real
   *  `AuditChainStore` or a lightweight fake without pulling in a DB. */
  readonly chain: Pick<AuditChainStore, "append">;
  readonly accountId: string;
  readonly riskId: string;
  /** The value `computeResidual()` derived for this risk — carried forward untouched, never
   *  recomputed here, so the record always states exactly what it is overriding. */
  readonly computed: Residual;
  /** The operator's override judgment, expressed on the SAME likelihood x impact scale the
   *  computed score lives on — never a bare arbitrary number. */
  readonly overrideLikelihood: Likelihood;
  readonly overrideImpact: Impact;
  readonly who: string;
  readonly why: string;
  /** Injected clock — the instant is stamped by the caller, never read here. */
  readonly now: Date;
}

/** The chained exception record: computed value + override + who/why/when, all on one entry. */
export interface RiskResidualOverrideRecord {
  readonly kind: typeof RESIDUAL_OVERRIDE_KIND;
  readonly riskId: string;
  readonly computed: Residual;
  readonly override: Residual;
  readonly who: string;
  readonly why: string;
  readonly at: string;
}

export interface RecordResidualOverrideResult {
  readonly record: RiskResidualOverrideRecord;
  /** The chain entry + fresh WORM anchor evidencing this override. */
  readonly evidence: AppendResult;
}

/**
 * Record an operator override of a risk's computed residual on the tenant's WORM audit chain.
 *
 * EVIDENCE-GAP semantics (fail-loud, mirrors `@caisson/audit-worm`'s retention-escalation helper):
 * if the chain append throws, the WHOLE call throws — an override the chain cannot prove is no
 * override at all, so it must never be swallowed into a silent success.
 */
export async function recordResidualOverride(
  input: RecordResidualOverrideInput,
): Promise<RecordResidualOverrideResult> {
  const {
    chain,
    accountId,
    riskId,
    computed,
    overrideLikelihood,
    overrideImpact,
    who,
    why,
    now,
  } = input;

  if (riskId.trim().length === 0) {
    throw new ValidationError(
      "risk-register: an override requires a non-empty riskId",
    );
  }
  if (who.trim().length === 0) {
    throw new ValidationError(
      "risk-register: an override requires a recorded who",
    );
  }
  if (why.trim().length === 0) {
    throw new ValidationError(
      "risk-register: an override requires a recorded why",
    );
  }
  if (!isResidual(computed)) {
    throw new ValidationError(
      "risk-register: computed must be a value computeResidual() produced",
    );
  }

  const override = computeResidual(overrideLikelihood, overrideImpact);
  const at = now.toISOString();
  const record: RiskResidualOverrideRecord = {
    kind: RESIDUAL_OVERRIDE_KIND,
    riskId,
    computed,
    override,
    who,
    why,
    at,
  };

  let evidence: AppendResult;
  try {
    // A fresh object literal, not the pre-typed `record` above — matches every other chain-append
    // call site in this tree, so it type-checks against `JsonValue` with no cast.
    evidence = await chain.append(accountId, {
      kind: RESIDUAL_OVERRIDE_KIND,
      riskId,
      computed,
      override,
      who,
      why,
      at,
    });
  } catch (err) {
    throw new InternalError(
      "risk-register: residual override computed but the chain append failed — evidence gap; reconcile the chain before trusting this override",
      {
        accountId,
        riskId,
        cause: err instanceof Error ? err.message : String(err),
      },
    );
  }
  return { record, evidence };
}
