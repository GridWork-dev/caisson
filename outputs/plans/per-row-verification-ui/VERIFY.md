# VERIFY — Per-row tamperproof verification UI (Act 4, goal-backward)

- **SPEC:** `outputs/specs/per-row-verification-ui/SPEC.md` (LOCKED, amended 2026-07-13; forks → ADR-0331)
- **PLAN:** `outputs/plans/per-row-verification-ui/PLAN.md` (locks → ADR-0344)
- **Branch verified:** `feature/exec-per-row` (worktree `/home/gw/lab/caisson-exec-per-row`), 15 lane commits `b627ae9f..08aacb78` over `origin/feature/kickoff-t-platform`.
- **Verdict: PARTIAL.** The locked-claim-level machinery — signed anchors, honest redaction, the fail-closed strict endpoint, the independent offline verifier, and the cross-lane canonical seam — fully achieves the SPEC's trust claim and is proven green (118 unit tests, 0 fail; FULL TURBO across the 4 changed packages). The remaining gap is the **admin-surface integration (T-U5)** that makes the per-row proof _visible_ on the hero page and the pack exportable from it, plus the minor **T-U3** redaction-count affordance. Per doctrine, PARTIAL → gaps enumerated + follow-ups queued; the phase must not be represented as goal-complete until T-U5 lands.

---

## Goal restatement (from SPEC Goal)

> An auditor can point at **any single audit-chain row** and see _why_ it is trustworthy — a per-row, anchor-aware verification chip + a clickable proof panel (link recompute · per-length WORM-anchor equality · chain-vs-current-anchor + anchor metadata + a copyable receipt) — and an **exported evidence pack** carries the same per-entry receipts + a standalone verifier so a third party re-verifies without trusting caisson's UI.

Re-asked against the merged diff, not the task checklist.

---

## Evidence run (proof points executed this session)

| Suite                                                         | Command                                                                                                                                                                                         | Result                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Kernel goldens + verify + redact + pack + standalone verifier | `bun test packages/kernel/src/{audit-chain,audit-verify,redact}.test.ts packages/kernel/src/evidence/{pack,standalone-verifier}.test.ts`                                                        | **49 pass / 0 fail**              |
| audit-worm signer + integration + ProofPanel + ChainViewer    | `bun test packages/audit-worm/src/{anchor-signer.test.ts,chain-store.integration.test.ts,ui/proof-panel.test.tsx,ui/chain-viewer.test.tsx}`                                                     | **46 pass / 0 fail**              |
| Admin endpoint + transform + ui-pro timeline                  | `bun test apps/admin/.../audit/proof/route.test.ts apps/admin/src/lib/audit-proof.test.ts apps/admin/.../mutation-error-mapping.test.ts packages/ui-pro/src/components/audit-timeline.test.tsx` | **23 pass / 0 fail**              |
| Tree-wide gate                                                | `bunx turbo run build lint test --concurrency=25% --filter=@caisson/{kernel,audit-worm,ui-pro,admin}`                                                                                           | **39/39 successful (FULL TURBO)** |
| Node-free assertion                                           | `grep -L "node:" packages/kernel/src/{canonical,audit-verify,redact}.ts`                                                                                                                        | all three node-free               |
| Frozen-tree respect                                           | `git diff --name-only …HEAD -- packages/ui apps/site`                                                                                                                                           | **empty** (zero edits)            |

Total feature coverage: **118 unit tests green.**

---

## Per-clause verdict (SPEC Verification + PLAN §7)

### Clause 1 — Per-row status renders on the admin audit page · **PARTIAL (gap G1)**

Every underlying part is built and unit-tested green: `ChainViewer` gained a six-state per-row `StatusChip` column, an expand-to-`ProofPanel`, and an anchor-provenance header line (`chain-viewer.tsx`, `row-state-chip.tsx`); `ProofPanel` + `useRowVerify` client-recompute the chip from raw material (`proof-panel.tsx`, `use-row-verify.ts`); the `GET /api/admin/audit/proof` endpoint returns the proof bundle. **But `apps/admin/src/app/business/audit/page.tsx` was never rewired** — it still calls `<ChainViewer entries verification />` with none of `rowStatuses` / `fetchProof` / `anchorProvenance`, and ChainViewer is backward-compatible (degrades to the pre-existing chain-level-only view when those props are absent). On the live admin surface an auditor today sees the OLD single MetricStat, not per-row chips or a proof panel. **Machinery + endpoint proven; hero-surface wiring (T-U5) absent.**

### Clause 2 — Redaction honesty · **PASS**

Redaction is enforced **server-side in the endpoint** (`audit-proof.ts assembleProofSuccess` masks via kernel `redactValue`/`DEFAULT_REDACT_KEYS` before the wire, H3); the redacted row's state is `anchor-confirmed-original-not-disclosed` with leg 1 `na` (`audit-verify.ts classifyRowState`), never `verified`. Tests: `route.test.ts` "redacted row -> 200 and no secret value crosses the wire"; `audit-proof.test.ts` "secret values never appear in the body or receipt"; `audit-verify.test.ts` redacted→`na`→anchor-confirmed. All green.

### Clause 3 — Endpoint auth contract · **PASS**

`route.test.ts` names and passes: operator non-allowlisted → 401 (before any WORM read); unknown query field → 400; non-UUID account → 400; seq `== length` **and** `> length` → 400 (L1); missing anchor → 200 `unverifiable` (fail-closed, never a fabricated pass); healthy row → 200 re-verifiable receipt + access-logged (M1). In-handler `requireAdmin` (never the proxy header), rate-limit (`TokenBucketLimiter`), `.strict()` in and out, server-side WORM-key construction via `anchorKey`/`buildArtifactKey`.

### Clause 4 — Receipt hardening (CR-06) · **PASS**

Receipt carries versioned raw material (`raw.{prevHash,payload}` + `v`); `checks`/`verifiedAt` are documented derived/untrusted. The live chip comes from the **client** recompute (`useRowVerify` runs kernel `verifyEntryAgainstAnchor` + `classifyRowState`, never reads `checks`; fails closed to `unverifiable` on WebCrypto exception — M3/L4). The standalone verifier recomputes both legs from raw material and ignores the embedded `checks`. Tests green in `audit-verify.test.ts`, `standalone-verifier.test.ts`, `proof-panel.test.tsx`.

### Clause 5 — Pack verifiability (fork c/d) · **PARTIAL (surface half; gap G1)**

The machinery is complete and green: `buildEvidencePack` embeds per-entry receipts + the zero-dep standalone verifier + a README stating the trust claim; `pack.test.ts` round-trips a built pack through the verifier (PASS healthy, FAIL tampered, NA redacted) and greps the README for banned overclaim strings; `standalone-verifier.test.ts` proves the inlined `canonicalize` byte-matches kernel and that a forged signature FAILs even when link+anchor pass. **But `buildEvidencePack` is consumed by no surface** — the "export evidence pack" action on the admin page (part of T-U5) is not wired, so an auditor cannot yet produce a pack from the product. Verifiability proven; surface export absent.

### Clause 6 — Six-state completeness · **PASS**

`grep -rniE "five.state|5.state"` over the touched product trees returns nothing. The six-state enum (`RowState`) is the single vocabulary across kernel, audit-worm/ui, and ui-pro.

### Clause 7 — External (Rekor-level) framing (CR-04) · **PASS**

No per-row external inclusion proof is claimed anywhere in the built code. `ChainViewer` carries a documented hook for a future **chain-level** Rekor provenance line but fabricates none; external anchoring is the sibling lane's scope. The `audit-timeline.test.tsx` asserts no "impossible-to-tamper" / unqualified-independent claim. Nothing overclaims.

### Clause 8 — SPEC's own Verification obligations · **PASS**

Operator-route non-allowlisted denial + tenant scoping (a seq valid for one account is out-of-range for a shorter one — `chain-store.integration.test.ts`); missing-anchor fail-closed; the provenance seal is never rendered off an unauthenticated same-API anchor — GATE-1 **signed anchors** make the trust root independent (`anchor-signer.ts` + `verifyAnchorSignature`), and `useRowVerify` never emits `verified` on a recompute failure.

### Cross-lane seam (BINDING) · **PASS**

The additive `sig`/`keyId` anchor fields do **not** change the canonical anchor byte core: `encodeAnchor` (the signed/external core) serializes only `{length, tipHash, genesisHash?}`; the signature is computed over exactly those bytes; `encodeStoredAnchor` stores `sig`/`keyId` alongside. Proven by (a) the kernel canonical golden staying green (`audit-chain.test.ts` "the built chain matches its golden") and (b) `chain-store.integration.test.ts` "the signed anchor's CORE bytes are byte-identical to the legacy unsigned body (the seam)" + "a legacy UNSIGNED anchor stays structurally valid" + "a signed chain still verifies structurally". Unsigned legacy anchors and external canonical-core submissions stay byte-identical.

### GATE-1a — dedicated anchor-signing key · **PASS**

`anchor-signer.ts` loads key material from the injected env var **`CAISSON_ANCHOR_SIGNING_KEY`** (+ optional `CAISSON_ANCHOR_SIGNING_KEY_ID`), domain-separated from the license issuer key, held as an opaque `KeyObject`, fail-closed on missing/malformed key with a `ConfigError` that names the var but never echoes its value. No real key is generated or committed; tests use ephemeral keys. Verified: `anchor-signer.test.ts` (6 tests, incl. "never serializes the key material" + "never echoes the bytes").

---

## Gaps enumerated

| #      | Gap                                                                                                                                                                                                                                                                                                                       | Severity                                         | Follow-up                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | **T-U5 admin-surface integration absent.** `business/audit/page.tsx` renders the chain-level-only ChainViewer; the six-state chips, expand-to-ProofPanel, anchor-provenance header, and evidence-pack export are built + tested but not surfaced. Blocks clause 1 and the surface half of clause 5 on the live hero page. | **HIGH** (surface visibility; not new machinery) | Wire the page: compute `rowStatuses` from real anchors, pass `fetchProof` → `GET /api/admin/audit/proof`, pass `anchorProvenance`, add an export action → `buildEvidencePack`. Small client island; no new machinery. Follow-up task. |
| **G2** | **T-U3 PayloadViewer "N fields redacted" count affordance absent.** Redaction masking + server-side redaction both exist and pass; only the count UX nicety is missing.                                                                                                                                                   | **LOW**                                          | Add the masked-field count to `ui-pro payload-viewer.tsx` (predicate already shared via kernel).                                                                                                                                      |
| **G3** | **T-F2 fork-board sync** (`docs/state/decisions-and-forks.md`) not updated. ADR-0344 already records the GATE-1/1a/2/3/4 locks, so the decision record exists; only the live-board reflection is pending. Outside this VERIFY builder's write scope (docs/state frozen).                                                  | **INFO**                                         | Close-out/reconcile session syncs the board.                                                                                                                                                                                          |

---

## Freeze-deferred (sequenced-not-failed — NOT gaps)

- **T-E2 — site demo** (`apps/site`): FROZEN this wave (Kickoff S). Correctly skipped; sequenced after the freeze lifts AND after product surfaces per fork c. Frozen-tree diff empty (respected).
- **Tenant self-service proof route** (GATE-2, ADR-0344 §3): a SECOND endpoint with session-derived RLS-scoped `accountId`; its dashboard view touches `apps/site` (frozen), so per ADR-0344 it EXECUTEs after the Kickoff-S freeze lifts. The operator (admin) endpoint — the v1 surface this wave targets — is built and proven.
- No `packages/ui` edit was needed; the six states map to existing `@caisson/ui` `StatusChip` tones (freeze respected).

---

## Disposition

**PARTIAL.** The SPEC's trust claim is achieved at the locked claim level — genuinely tamper-evident on day one via signed anchors (GATE-1), honest redaction, a fail-closed strict endpoint, and an independent offline verifier — and the cross-lane canonical seam holds. The feature is **not yet visible on the admin hero surface** because T-U5 wiring (and the minor T-U3 affordance) are unbuilt. Per doctrine: enumerate gaps + queue follow-ups (G1 is the blocking one), and do not represent the phase as goal-complete until T-U5 lands. G1/G2 are additive wiring over proven, tested machinery — not a new PLAN cycle.
