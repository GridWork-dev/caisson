# VERIFY — Stage-2 · Stream C (goal-backward, Act 4)

Re-asks the SPEC goal against the merged diff + tests — _did the code achieve the stated goal, or was it
already done and is the trail now honest?_ Verdict: **PASS.** Whole-monorepo gate green as a unit
(2026-07-01): `turbo run build lint test` **131/131**, kernel `bun run gate` **45 conform (ADR-0002)**,
tooling standards-gate **45 pkgs · 0 errors**, `depcruise` **0 violations (842 modules)**.

## Per-task goal-backward

| Task   | Goal re-ask                                                                                      | Evidence                                                                                                                                                                                                       | Verdict             |
| ------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **C1** | Is the P4a EVAL act recorded + a phase SECURITY.md authored?                                     | Both exist + PASS on `main` (`ac052f3`) — was already done; the stale "never authored" claim is struck (C9).                                                                                                   | **PASS (pre-done)** |
| **C2** | Does streaming `infer()` + a spend-counter concurrency test + a soft-cap warn test exist & pass? | `inferStream()`+both tests shipped (`261d7ba`); ai-kit 40/40 green. Already satisfied; optional extra hygiene not needed.                                                                                      | **PASS (pre-done)** |
| **C3** | Does the compliance edition generate a HIPAA evidence pack + an OSCAL bundle end-to-end?         | `apps/compliance/lib/leg.ts` builds a HIPAA pack (own control ids, same 3 collectors) + calls `toOscalBundle`; 11/11 leg tests, golden-pinned. OSCAL _push_ correctly left P7.                                 | **PASS**            |
| **C4** | Can two tenants NOT read each other's agent memory, fail-closed?                                 | `createAgentDevEdition({ tenant })` opens `tenantDbPath(root,tenantId)`; a malformed id throws pre-open; `tenant`+`memoryPath` rejected. 3 isolation tests + agent-dev 28/28.                                  | **PASS**            |
| **C5** | Does each new backend build the right adapter, env-gated, no live call?                          | `providerFor` builds Bedrock/Azure/Ollama `ProviderV2` per enum; 11 construction tests; drivers inert until config+creds; depcruise confirms the new `@ai-sdk/*` are confined to ai-kit (Gate-2).              | **PASS**            |
| **C6** | Does the HTTP transport auth-gate before build + isolate Bearer sessions?                        | `http.ts`: 401 before any `Server`; two Bearers → two non-cross-talking sessions; CORS+DNS-rebind allowlists required at construction; rate-limit+isError parity with stdio. 49/49 mcp tests.                  | **PASS**            |
| **C7** | Is a per-tenant key stored encrypted + resolved per tenant, RLS-isolated, metering untouched?    | `tenant_ai_credential` (field-crypto envelope + FORCE RLS); ciphertext-at-rest ≠ plaintext; tenant B can't read tenant A's key; `buildByokResolver` decrypts+builds+caches; env lane unchanged. 12 BYOK tests. | **PASS**            |
| **C8** | —                                                                                                | Operator-locked DEFER (external-account, DEPLOY-class). Correctly NOT built.                                                                                                                                   | **N/A (deferred)**  |
| **C9** | Are the stale act-trail claims reconciled to code truth?                                         | 4 backlog bullets struck to CLOSED w/ commit/ADR refs; EU-AI-Act "reserved slot" struck in compliance README/AGENTS.                                                                                           | **PASS**            |

## Risk-tag audits (SPEC tags: security · auth · secrets · ai · external-system)

- **C6 (security/auth)** — the network-reachable MCP surface `stdio.ts` deferred: reviewed firsthand.
  Auth-before-transport (401, no Server built), stateless per-request auth (ADR-0161), CORS allowlist
  never `*`/reflected, DNS-rebinding on, no localhost fallback, TLS terminated by host. Sound.
- **C7 (security/secrets)** — keys stored only as per-tenant AES-256-GCM envelopes under FORCE RLS;
  never logged; decrypt at the same edge the env read happens; the built-client cache holds no raw key
  bytes. `depcruise`+standards-gate confirm the down-only boundary. Sound.
- **C4 (security)** — file-per-tenant physical isolation (ADR-0073), fail-closed on a bad id. Sound.
- **C5 (ai/external-system)** — drivers dormant/env-gated, zero live CI call (ADR-0059 invariant).
  EVAL substituted by construction tests per the P4a precedent (no eval-runner dataset). Sound.

## Result

Every in-scope goal met with real, green tests; the two already-done tasks are verified pre-satisfied
and the trail is now honest. No gap blocks. Proceed to SWEEP.
