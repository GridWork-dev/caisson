# C11 — share Intel's OpenRouter transport/parser

**Verdict:** VERIFIED FOLD-INTO private Intel helper  
**Size:** 91 gross duplicated lines; estimated 35–50 net  
**Risk:** medium

## Evidence

- Production transport/schema/parser:
  `services/intel/src/llm.ts:12-53,169-180,201-248`.
- Eval transport/schema/parser:
  `services/intel/src/eval/live-judge.ts:9-83,93-151`.
- Both repeat endpoint, 60-second timeout, response schema, content extraction, JSON recovery, and
  POST shape.
- Production caller: `services/intel/src/scheduler.ts:10`.
- Credentialed main-push eval caller:
  `services/intel/src/eval/intel-briefs.eval.test.ts:19-30` and
  `.github/workflows/quality.yml:111-129`.

## Safe shape

Share only OpenRouter request transport, response schema, content extraction, and JSON recovery.
Keep production prompt/rendering and fail-soft behavior (`llm.ts:270-280`) separate from judge
criteria, verdict validation, and fail-closed behavior (`live-judge.ts:134-150`).

## Registry/revenue

Private operator-intelligence service; absent from registry/bundles. No customer entitlement change.

## Refute attempt

A full production/eval merge was refuted because failure contracts differ. The transport-only fold
survived and keeps both call sites independently tested.

**Buyer/site notice:** none; operator intelligence output must remain byte/behavior equivalent.
