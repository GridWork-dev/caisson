---
phase: design-research-engineering-review
reviewed: 2026-07-13T18:33:09Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - KICKOFF-gw-core-security-ops.md
  - KICKOFF-caisson-design-motion.md
  - KICKOFF-caisson-platform.md
  - SPEC-agent-ready-ds-surface.md
  - SPEC-per-row-verification-ui.md
  - SPEC-rekor-anchoring.md
  - SPEC-compliance-crosswalk.md
  - SPINE-hybrid-oscal-research.md
  - FORK-LOCKS.md
findings:
  critical: 16
  warning: 10
  info: 0
  total: 26
status: issues_found
verdict: fail
---

# Adversarial Engineering Review

## Verdict: FAIL

The documents are not ready for PLAN fanout. The strongest product ideas are salvageable, but several locked designs are cryptographically incomplete, contradict actual package boundaries, or select incompatible v1 scope. The external-anchoring, per-row-verification, named-attestation, and session-taint designs require architectural correction before estimates or task decomposition.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 — [BLOCKER] The Rekor port cannot submit a valid Rekor v2 entry

**Attacks:** `SPEC-rekor-anchoring.md:21-29,52-60` — Design, Effort sketch, Fork A  
**Reality check:** The proposed `ExternalAnchorLog.submit(anchorBytes)` supplies neither a signature nor verifier material. Rekor v2 accepts `hashedrekord` entries containing an artifact digest, signature, and certificate/public key. Verification also requires shard-aware SigningConfig/TrustedRoot handling. The existing signer is per-tenant Ed25519, but the spec never binds it into this port. See `caisson-pack.xml:554-607` → ADR-0056 and the [official Rekor v2 client contract](https://github.com/sigstore/rekor-tiles/blob/main/CLIENTS.md#rekor-v2-api).

**Fix:** Prototype the real request before PLAN. Redesign the port around a signed submission:

```ts
interface ExternalAnchorSubmission {
  anchorBytes: Uint8Array;
  digest: Uint8Array;
  signature: Uint8Array;
  verifier: PublicKeyMaterial;
  target: TransparencyTarget;
}
```

Include SigningConfig discovery, TUF trust roots, rotating shards, checkpoint verification, and supported key-format tests. Do not estimate this as “one module approximately the size of `sign.ts`.”

### CR-02 — [BLOCKER] The checkpoint job has an unrecoverable external-side-effect window

**Attacks:** `SPEC-rekor-anchoring.md:23-30` — checkpoint job  
**Reality check:** The sequence is “submit externally, then write the receipt to WORM.” A crash or timeout after Rekor accepts the entry but before receipt persistence loses the only bundle needed to verify it. Rekor v2 removed online search and proof-retrieval APIs; clients must retain the returned proof and checkpoint. See [Rekor v2 “Removing Online Verification and Search”](https://github.com/sigstore/rekor-tiles/blob/main/CLIENTS.md#removing-online-verification-and-search).

**Fix:** Add a durable outbox keyed by `(accountId, target, anchorLength, anchorDigest)` before egress, with explicit `pending/submitted/receipted/failed` states. Resolve response-loss behavior in a live protocol spike. If the target cannot offer idempotency or recovery, surface an operator-reconciliation state rather than blind retrying duplicate public entries.

### CR-03 — [BLOCKER] TSA-default does not deliver the feature’s stated trust upgrade

**Attacks:** `SPEC-rekor-anchoring.md:8-12,30,75-78`; `FORK-LOCKS.md:28-37`  
**Reality check:** The spec correctly admits that a TSA receipt stored inside the buyer’s trust domain does not defeat an insider who destroys both history and receipts. The fork board nevertheless makes TSA default-on while retaining the sellable claim that outside parties can detect rewriting. ADR-0056 already countersigns evidence-pack signatures with RFC-3161 (`caisson-pack.xml:573-601`); this default mostly duplicates an existing timestamp tier.

**Fix:** Split the product claims:

- `trusted-timestamped`: RFC-3161, private receipt, weaker trust claim.
- `externally-transparent`: public Rekor/OTS receipt, typed opt-in, actual outside detectability.

Default external anchoring off unless irreversible-public-log consent is recorded. Never market the TSA-only state as transparency anchoring.

### CR-04 — [BLOCKER] A hash chain cannot provide the proposed succinct per-row external proof

**Attacks:** `SPEC-rekor-anchoring.md:48-50`; `SPEC-per-row-verification-ui.md:42-50,95-98`  
**Reality check:** To prove row `s` belongs to a later externally anchored tip `L`, a verifier must replay the chain through the intervening entries. A SHA-256 linked list has no compact inclusion proof. Fetching only `anchor(s+1)` proves that row against the buyer-controlled WORM domain, not against the later Rekor checkpoint.

**Fix:** Choose one honest shape:

1. Render external status only at chain/checkpoint level.
2. Accept and budget full-prefix/range replay.
3. Add a Merkle commitment or deployment-wide super-root specifically for compact external inclusion proofs.

Do not claim per-row external anchoring while rejecting the data structure that would make it compact.

### CR-05 — [BLOCKER] The “named-person Ed25519 attestation” has no named-person identity

**Attacks:** `SPEC-compliance-crosswalk.md:25-31,69-71`  
**Reality check:** `{slotId, statement, attestor:{name,role}, signedAt, sig}` omits tenant, evidence digest, pack ID, key ID, algorithm/version, public-key material, enrollment authority, and revocation state. ADR-0056’s existing key is per-tenant, not per-person (`caisson-pack.xml:567-600`; `packages/signing-primitive/package.json` at `caisson-pack.xml:8674-8709`). A tenant key signing a self-asserted name does not prove which person attested, and a stable slot statement is replayable across packs.

**Fix:** Prefer the cheaper honest design unless buyers require individual cryptographic identity: record the authenticated actor and evidence digest in the manifest, then rely on the existing tenant pack signature. If individual signatures are required, define a versioned attestation envelope with tenant/pack/evidence binding, key ID, public-key provenance, enrollment and revocation.

### CR-06 — [BLOCKER] Redacted rows cannot satisfy the locked “verified locally” state

**Attacks:** `SPEC-per-row-verification-ui.md:28-38,52-57,90-93`; `FORK-LOCKS.md:17-26`  
**Reality check:** Level 2 requires recomputing the hash from the original payload. The client receives a redacted payload and therefore cannot recompute it. “Hash covers original; not client-recomputable” is honest prose, but it contradicts the locked local-verification claim and the five-state model, which has no distinct redacted/partially-verifiable state.

**Fix:** Add a state such as `anchor-confirmed-original-not-disclosed`; do not render the local-verification seal for it. Proof receipts must carry versioned raw proof material, treat `checks` and `verifiedAt` as derived/untrusted fields, and require standalone verifiers to recompute every possible assertion.

### CR-07 — [BLOCKER] The proof-bundle endpoint has no authorization contract

**Attacks:** `SPEC-per-row-verification-ui.md:40-50,59-65`  
**Reality check:** The design necessarily introduces a server endpoint that reads tenant-scoped WORM anchors, but it does not specify how tenant identity is derived or how `seq` is bounded. GridWork’s hard floor requires route-level Bearer/session authentication (`gridwork-core-pack.xml:8312-8360` → `identity/security.md`). Accepting an account ID or raw WORM key from the client creates an IDOR/path-boundary risk.

**Fix:** Specify the boundary before PLAN: derive `accountId` exclusively from the authenticated session, accept only a strict bounded row sequence, construct the WORM key server-side, return a Zod-strict response, and test cross-tenant denial and missing-anchor fail-closed behavior.

### CR-08 — [BLOCKER] The gated doctor conflicts with the actual open CLI package boundary

**Attacks:** `SPEC-agent-ready-ds-surface.md:41-45,65-81`; `FORK-LOCKS.md:6-15`  
**Reality check:** The fork locks commercial-gated doctor logic into `packages/cli`, but the actual package is Apache-2.0 and exposes only `create-caisson`, not a `caisson` binary (`caisson-pack.xml:7233-7274`). Shipping the shared doctor data layer there either gives away gated logic or creates an undocumented remote-service dependency.

**Fix:** Pick a boundary explicitly:

- Keep `@caisson/cli` open as a thin authenticated client to buyer-MCP doctor tools; or
- Add a separate commercial CLI/package; or
- Make static doctor open and monetize only pro manifests/runtime checks.

Also resolve bin compatibility before promising `caisson ui doctor`.

### CR-09 — [BLOCKER] The new open MCP server has no safe transport/auth decision

**Attacks:** `SPEC-agent-ready-ds-surface.md:53-58`; `FORK-LOCKS.md:8-13`  
**Reality check:** “Open, unauthenticated MCP” is locked without stating stdio versus remotely reachable HTTP. An unauthenticated HTTP server violates `identity/security.md`; the existing MCP package is deliberately auth-gated (`caisson-pack.xml:8293-8330`).

**Fix:** Make the open discovery server local stdio-only, or require Bearer authentication and rate limiting for HTTP. Record which tools can expose pro metadata and add entitlement-negative tests before implementing a second server.

### CR-10 — [BLOCKER] `verified: boolean` cannot substantiate an audit-facing mapping

**Attacks:** `SPEC-compliance-crosswalk.md:27-30,41-46,59-64`; `SPINE-hybrid-oscal-research.md:37-41`  
**Reality check:** A boolean loses source version, relationship semantics, reviewer, review date, and stale-on-update behavior. The official NIST OLIR mapping explicitly warns that its mappings are subjective, incomplete, and not equivalence claims. See the [NIST OLIR record](https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=155).

**Fix:** Replace the boolean with structured provenance:

```ts
verification: {
  status: "unreviewed" | "reviewed" | "expert-reviewed";
  relationship: "related" | "partial" | "equivalent";
  sourceId: string;
  sourceVersion: string;
  sourceDigest: string;
  reviewedBy: string;
  reviewedAt: string;
}
```

Any catalog or source-digest change must invalidate dependent verification automatically.

### CR-11 — [BLOCKER] The locked crosswalk design contradicts its SPEC and ADR source of truth

**Attacks:** `SPEC-compliance-crosswalk.md:3-5,33-39,52-57`; `SPINE-hybrid-oscal-research.md:31-41`; `FORK-LOCKS.md:39-48`  
**Reality check:** The SPEC says it does not replace ADR-0057, ingests no 800-53 catalog, and adds no frameworks. The lock instead vendors the full NIST OSCAL catalog, adds an ISO axis, and requires ADR-0057 supersession. ADR-0057 presently requires an own-authored canonical catalog and in-house crosswalk references (`caisson-pack.xml:610-666`).

**Fix:** Stop before PLAN. Amend the SPEC and land an accepted ADR that distinguishes:

- Caisson’s own authored control catalog.
- Vendored CC0 reference catalogs.
- Externally seeded mappings versus authored claims.
- ISO identifier/paraphrase licensing rules.

Then re-run architecture review against the amended source of truth.

### CR-12 — [BLOCKER] The MCP “fallback” cannot produce the promised migration telemetry

**Attacks:** `KICKOFF-gw-core-security-ops.md:15-19`  
**Reality check:** If the existing `initialize` probe runs first, a dual-stack server succeeds there and `server/discover` is never exercised, so the recorded result says nothing about stateless readiness. The 2026 protocol also requires client/version metadata in `_meta`, not only the named HTTP headers. See the [official MCP 2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) and [discovery contract](https://modelcontextprotocol.io/specification/draft/server/discover).

**Fix:** Probe `server/discover` first with complete `_meta`, validate `supportedVersions`, and fall back to legacy `initialize` only on the specified unsupported-version/method-not-found outcomes. Record modern and legacy capability separately. Add tests for modern-only, legacy-only, dual-stack, malformed discovery, auth failure, and version mismatch.

### CR-13 — [BLOCKER] The proposed session-taint gate is bypassable and breaks runtime parity

**Attacks:** `KICKOFF-gw-core-security-ops.md:22-24`  
**Reality check:** `hooks.py` is only the Claude ingress. Codex uses a separate adapter, while doctrine promises identical hooks and permissions (`gridwork-core-pack.xml:8047,8996`). The proposal also gates “web fetch/external MCP writes,” missing hosted read/search tools whose arguments egress. Path-only taint misses shell/tool output containing secrets and requires persistent state, lifecycle cleanup, concurrency, and one-shot declassification—not approximately 50 lines. The repo already has `tools/lib/egress-guard.ts` consumed by multiple egress callers (`gridwork-core-pack.xml:5448,5629,6600`).

**Fix:** Design one shared policy engine used by both hook adapters. Classify all off-box tool arguments, combine content scanning with sensitive-source taint, key state by validated session ID, make acknowledgements one-call and destination-scoped, and test Codex/Claude parity, indirect reads, concurrent sessions, restart recovery, and false-positive recovery.

### CR-14 — [BLOCKER] The motion kickoff authorizes work before the required ADR amendment

**Attacks:** `KICKOFF-caisson-design-motion.md:12-21`  
**Reality check:** Task 1 says amend ADR-0307 first; task 2 says three moments can land ahead of that amendment. Current ADR-0307 requires CSS-only, dependency-free, transform/opacity-only motion (`caisson-pack.xml:1220-1260`). SVG dash animation and a scroll-fed WebGL uniform already exceed that binding even before the `motion` dependency lands.

**Fix:** No motion implementation lands before the amendment. The ADR must identify each permitted non-transform property, canvas-uniform path, library-bearing component, reduced-motion behavior, and bundle/performance budget.

### CR-15 — [BLOCKER] The security/ops kickoff cannot be one STANDARD execution phase

**Attacks:** `KICKOFF-gw-core-security-ops.md:1-56`  
**Reality check:** It combines protocol migration, supply-chain CI, secret scanning, host package management, systemd removal, database maintenance, backups, browser credential storage, remote AI, embeddings, eval tooling, and service deployment across three machines. Doctrine requires phase isolation and one active phase per workstream (`gridwork-core-pack.xml:8070,8149`).

**Fix:** Split at minimum into separate phases for MCP compatibility, supply-chain CI, host reliability/backups, memory/Graphify, browser security, and mini/local-AI. Each receives its own SPEC tags, rollback, verification commands, and DEPLOY gate.

### CR-16 — [BLOCKER] The external-anchor job ownership can violate open-core dependency direction

**Attacks:** `SPEC-rekor-anchoring.md:23-29,52-54`  
**Reality check:** `packages/jobs` is Apache-2.0 (`caisson-pack.xml:7566+`), while `audit-worm` is commercial (`caisson-pack.xml:7015-7054`). Implementing the scheduled handler directly in `packages/jobs` would make an open package depend upward on commercial code, violating ADR-0094’s boundary.

**Fix:** Keep only generic scheduling ports in `packages/jobs`. Register the concrete audit-worm anchoring handler from the commercial `packages/compliance` composition package, which already depends on jobs-adjacent commercial modules, or keep the adapter inside `audit-worm`.

## Warnings

### WR-01 — [WARNING] Socket protection is installed on machines that are not the stated exposure

**Attacks:** `KICKOFF-gw-core-security-ops.md:22-23`  
**Issue:** The doc says Railway builds are the exposure and dev machines are not, then scopes enforcement to global bunfig files on the box and MacBook. That does not constrain Railway’s build environment.

**Fix:** Verify Railway’s exact install command and bunfig discovery path. Put the scanner/policy in the repository or build image used by Railway; otherwise delete the task rather than claiming coverage.

### WR-02 — [WARNING] Hero lazy-loading appears already shipped, while performance is sequenced after motion

**Attacks:** `KICKOFF-caisson-design-motion.md:18,23-27`  
**Issue:** The kickoff orders view transitions after performance work but places performance as task 6, after the major motion tasks. Packed state says the hero already shipped behind poster-first, post-LCP idle hydration (`caisson-pack.xml:14564` → `docs/state/outstanding-work.md`), making task 6 potentially duplicate work.

**Fix:** At PLAN time inspect the live `apps/site` import graph, `.next` build manifest, and browser waterfall. Capture baseline first; perform only the delta that remains; then add motion one moment at a time.

### WR-03 — [WARNING] “Zero-dependency behavior” is false in the actual UI manifest

**Attacks:** `KICKOFF-caisson-platform.md:32-36`  
**Issue:** `@caisson/ui` currently declares both `radix-ui` and `zod` dependencies (`caisson-pack.xml:8788-8832`). Rewriting its description to “zero-dependency behavior” would publish a false package claim.

**Fix:** Audit actual imports. If only Slot is used, narrow the dependency to the Slot package first. Describe the package as “native-first” rather than zero-dependency unless the manifest truly reaches zero runtime dependencies.

### WR-04 — [WARNING] The locked shadcn install command is not how GitHub registries resolve

**Attacks:** `KICKOFF-caisson-platform.md:33-35`; `SPEC-agent-ready-ds-surface.md:47-51`  
**Issue:** A public GitHub `registry.json` installs as `owner/repo/item`; `@caisson/button` requires a configured or officially indexed namespace. The current `npx` spelling also conflicts with the repo’s Bun-only convention. See [shadcn GitHub registries](https://ui.shadcn.com/docs/registry/github).

**Fix:** Use a pinned GitHub address such as `bunx --bun shadcn@latest add owner/repo/button#<tag-or-sha>`, or explicitly add and document the `@caisson` namespace before advertising it.

### WR-05 — [WARNING] Sensitive-scope embeddings are substantially larger than the stated 15-line branch

**Attacks:** `KICKOFF-gw-core-security-ops.md:41-43`  
**Issue:** The current embedding choke point resolves an OpenRouter key and calls OpenRouter-specific transport, model, dimensions, and `input_type` behavior (`gridwork-core-pack.xml:6583-6675`). Scope is known at callers, not inside the transport. Switching vector models also creates incompatible vector spaces and requires atomic scoped backfill.

**Fix:** PLAN provider abstraction, caller scope propagation, auth/header differences, output-dimension validation, query/document prefix parity, provider/model metadata per vector, atomic re-embedding, and rollback to FTS. Do not mix vectors from different models in one unfiltered similarity query.

### WR-06 — [WARNING] The persistent browser profile becomes a credential-bearing security boundary

**Attacks:** `KICKOFF-gw-core-security-ops.md:38-40`  
**Issue:** A shared `--user-data-dir` exposes cookies and storage to every browser-capable session and risks profile locking/corruption if multiple engines attach. Merely adding a ledger row does not constrain access.

**Fix:** Use a dedicated least-privilege profile with mode `0700`, no browser password store, an allowlisted login playbook, concurrency locking, explicit teardown, and destination-scoped operator approval for credentialed actions.

### WR-07 — [WARNING] `--results=verified` does not “close” the secret-scan gap

**Attacks:** `KICKOFF-gw-core-security-ops.md:18-20`  
**Issue:** Verified-only TruffleHog scanning intentionally omits unverified candidates, including revoked, private, or unverifiable secret formats.

**Fix:** Keep verified findings blocking, but upload/redact unverified findings for review or add deterministic high-confidence patterns. State the residual gap accurately.

### WR-08 — [WARNING] The OSCAL spine lacks a coherent source-version lifecycle

**Attacks:** `SPINE-hybrid-oscal-research.md:24-41`; `FORK-LOCKS.md:41-47`  
**Issue:** The vendored NIST catalog, OLIR mappings, and Caisson mappings can be on different point releases. The current OLIR ISO mapping identifies SP 800-53 Rev. 5.1.1, while NIST’s catalog continues to rev. “Hash-pinned” ensures repeatability, not semantic compatibility. The claim that FedRAMP becomes “nearly free” also ignores the deferred 1.0.4 target and package-specific SSP/SAP/SAR/POA&M work in ADR-0179 (`caisson-pack.xml:839-876`).

**Fix:** Pin a coherent source bundle with catalog/mapping versions and hashes, define update/diff/re-review behavior, and remove the “nearly free” FedRAMP estimate.

### WR-09 — [WARNING, UNVERIFIABLE] Several key “grounded in code” claims are absent from the supplied pack

**Attacks:** All four product SPECs and both Caisson kickoffs  
**Issue:** Despite the briefing, the pack contains only `package.json` for `audit-worm`, `mcp-server`, `ui`, `ui-pro`, `frameworks-pack`, `compliance-core`, and `signing-primitive`; their cited source files are not present.

**Exact PLAN-time re-checks:**

- `audit-worm`: inspect `chain-store.ts` transaction ordering, anchor write on every length, poison-length recovery, retention metadata, and tenant-key construction.
- Agent-ready UI: enumerate exported components and hardest prop shapes; inspect `registerTool`, HTTP/stdio transports, entitlement gates, and current AGENTS/manifest generation.
- Crosswalk: script exact control IDs, duplicate-ID field differences, crosswalk counts, and byte-level pack goldens.
- Platform: validate `cacheMaxAge/cacheMaxSize` against the installed Turbo 2.10 schema; run `pgrls --help` against actual migrations; prove the Better-Auth/account-member decision with authorization tests.
- Motion: inspect actual hero dynamic import and current client chunks rather than trusting the 529 KB headline.

These are mandatory evidence gates, not reasons to guess.

### WR-10 — [WARNING] The fork board turns “future-proof” bias into an oversized v1

**Attacks:** `FORK-LOCKS.md:3-48`  
**Issue:** The board upgrades agent-ready delivery to two MCP servers plus CLI plus runtime axe, per-row scope to four product surfaces, external anchoring to TSA and Rekor transports, and crosswalk scope to full retrofit plus attestations. These are independent proof obligations, not modularity wins.

**Fix:** Reopen locks around vertical slices:

1. Manifest + deterministic CLI describe.
2. Static doctor.
3. Authenticated MCP adapter.
4. Runtime axe.
5. Separate named-attestation program.

Likewise ship one external-anchor target only after the protocol spike, and split crosswalk rollup from personal key custody.

## Per-document Verdicts

| Document                           | Verdict             | Reason                                                                                                                                 |
| ---------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `KICKOFF-gw-core-security-ops.md`  | **rethink**         | Violates phase isolation; taint gate is bypassable; Socket scope misses Railway; several host/security tasks need separate risk gates. |
| `KICKOFF-caisson-design-motion.md` | **needs-amendment** | Contradictory ADR sequencing, likely duplicate hero work, and performance baseline occurs too late.                                    |
| `KICKOFF-caisson-platform.md`      | **needs-amendment** | False zero-dependency claim, invalid shadcn delivery assumption, and several tool/config claims remain unverified.                     |
| `SPEC-agent-ready-ds-surface.md`   | **rethink**         | CLI licensing/bin boundary and open-MCP auth are unresolved; locked v1 spans too many fronts.                                          |
| `SPEC-per-row-verification-ui.md`  | **rethink**         | Redacted local verification is impossible as specified; endpoint authorization and external-row proof contracts are missing.           |
| `SPEC-rekor-anchoring.md`          | **rethink**         | Submission contract is incomplete, job is non-idempotent, TSA default misses the goal, and per-row external proof is not compact.      |
| `SPEC-compliance-crosswalk.md`     | **needs-amendment** | Rollup concept is viable, but provenance and named-person attestation are not audit-grade and should be separated.                     |
| `SPINE-hybrid-oscal-research.md`   | **needs-amendment** | Direction is plausible, but it requires an ADR first, coherent source-versioning, and narrower FedRAMP claims.                         |
| `FORK-LOCKS.md`                    | **rethink**         | Reopen the full-feature bias upgrades; several locks force incompatible or unproven v1 commitments.                                    |

Security-tagged amendments should receive a dedicated `gw-security-auditor` pass before PLAN. No source files were modified.

---

_Reviewed: 2026-07-13T18:33:09Z_  
_Reviewer: Codex (gw-code-reviewer)_  
_Depth: deep_
