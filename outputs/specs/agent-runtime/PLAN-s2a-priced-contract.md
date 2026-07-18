# PLAN — S2a: `priced` BillingStatus contract amendment (CAISSON-111 slice 1 of 6)

- **Executes:** ADR-0360 U-4 · SPEC `SPEC-caisson-111-loop-slices.md` §5 (S2a).
- **Branch:** `admin/caisson-111-s2a-priced-billing-status` (main checkout, one PR).
- **Slice boundary:** contract + consumer-impact ONLY. No adapter package (S2b), no loop
  (S2), no pricebook import — `priced` is defined here, produced only from S2b onward.

## Tasks

1. **`packages/agent-trajectory/src/schema.ts`**
   - `BillingStatus` gains `"priced"` (metered · priced · estimated · unsupported), doc
     comment: pricebook-computed integer credits attached to real adapter-extracted
     counts; never ledger-settled — `metered` stays ledger-truth only.
   - `ModelUsagePayload` gains optional `priceBookVersion` (non-empty string) —
     provenance stamp, expected iff `priced`.
   - `.superRefine` lands the previously comment-only invariant:
     `credits > 0` permitted iff `billingStatus ∈ {metered, priced}`;
     `estimated`/`unsupported` ⇒ `credits === 0`. Also: `priceBookVersion` present ⇒
     `billingStatus === "priced"` (provenance can't decorate other bands).
2. **`packages/agent-trajectory/src/replay.ts`** — `usageTotals` gains the `priced` band
   (zero-init, fixed key order metered → priced → estimated → unsupported); comment
   updated from "all three" to "all four". This deliberately changes projection bytes —
   the recorded U-4 consumer impact; S4 must not change them further.
3. **Tests** — schema: refine accept/reject matrix (metered>0 ok · priced>0 ok ·
   estimated>0 REJECT · unsupported>0 REJECT · priceBookVersion on non-priced REJECT);
   replay: priced band folds + four-key deterministic order + byte-identity re-pin.
4. **README** field-classification table: `priced` + `priceBookVersion` rows.
5. **Changeset** — `@caisson/agent-trajectory` minor, buyer prose, no tracker ids.
6. **Verify** — `bunx turbo run build lint test --filter=@caisson/agent-trajectory...`
   (dependents ai-kit + agent-runner included), standards-gate, sot. EVAL: the `ai` tag
   fires; slice-1 eval surface = the package tests (no baselines exist for the contract).

## Routing

Main-thread EXECUTE (context-bearing contract edit, <150 LOC). SHIP audit: gw-code-reviewer
on the diff; the `security`/`billing` tags ride the S3/S5 dedicated reviews per U-1 —
S2a's refine is money-adjacent, so the reviewer is asked to check the invariant direction
explicitly.
