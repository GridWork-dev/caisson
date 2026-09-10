# S8 task 1 diagnostic plan

Implements the operator-authorized direct-measurement task described in the matching SPEC. Later release tasks remain sequenced after task 1.

1. Preserve SOT corrections and outstanding receipts: complete at `3e549193`.
2. Apply the frozen temporary diagnostic to the three named source files. Add focused coverage in shared limiter, license integration and Ask AI handler tests. Keep source selection and all verdicts unchanged. Main-thread context-bearing edits; no parallel writers.
3. Verify with `bun test packages/rate-limit/src/token-bucket.test.ts services/license/src/issue-app.integration.test.ts apps/site/lib/ask-ai/handler.test.ts --timeout 60000`, changed-file lint/format and affected workspace builds/typecheck. Predict each run first. Any failed gate stops; do not silently repair after the stop.
4. Commit the diagnostic as one logical change. Run `gw-review` and its security audit via governed dispatch, then prepare the PR under R203. Required CI: check, standards-gate, registry-index, oscal-conformance, deterministic, support-bot. Record each result against the actual head. The temporary change must never be published as a package.
5. Hold merge at the green PR for the required per-PR ruling. Prepare exact operator deployment instructions once a deployable reviewed ref exists. Deployments are not lane-authorized.
6. Recheck A ingress, measure B ingress and write B's exact expected key before its application request. Send one normal and one forged-header request per client/service, collecting direct application values with deployment/instance and marker correlation. Predict 401 for unsigned license issue and 403 for Ask AI without challenge token. Any divergence stops.
7. Matching per-client A/B evidence closes task 1 NO DEFECT; contradictory evidence is a finding. Remove temporary diagnostic before proceeding to release cut.

## Review routes

Both routes are read-only and return artifacts; the main thread owns all external effects and persistence.

| Capability     | Role                | Lane / model            | Concurrency  | Isolation   | permission_profile | Evidence                                                                       |
| -------------- | ------------------- | ----------------------- | ------------ | ----------- | ------------------ | ------------------------------------------------------------------------------ |
| code_review    | gw-code-reviewer    | deep / gpt-5.6-sol high | asynchronous | shared-read | repo-read          | REVIEW with exact head/base and structural findings                            |
| security_audit | gw-security-auditor | deep / gpt-5.6-sol high | asynchronous | shared-read | repo-read          | SECURITY with exact head/base, marker/expiry/error and output-scope assessment |

Resolve through `identity/orchestration.toml`; `gw codex limits` precedes `gw dispatch`. No direct ungoverned child spawn.
