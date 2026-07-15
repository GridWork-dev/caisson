# PLAN — External anchoring, Rekor v1.1 leg (`externally-transparent` grade)

- **Act:** 2 (PLAN) · **Status:** plan-ready with gates — see §5. EXECUTE is a later session.
- **SPEC:** `outputs/specs/external-anchoring/SPEC.md` (LOCKED, amended 2026-07-13 → ADR-0332)
- **Primary input:** `outputs/specs/external-anchoring/SPIKE-rekor-v2-protocol.md` (COMPLETE — **GO**, with one correction + two conditions)
- **Scope:** the Rekor v1.1 leg ONLY — the `externally-transparent` grade. The v1 TSA leg (`TrustedTimestampLog`/`TsaAnchorLog`, the durable outbox, `verifyExternal` existence-check, the receipt schema, the checkpoint job, job-ownership boundary) is a **separate, prior** plan and is a hard precondition here (§2 P1).
- **Tags (from SPEC):** `security` · `external-system` · product. SHIP fires the security audit lane.

---

## 1. Goal restatement (goal-backward)

Make `@caisson/audit-worm`'s chain-anchor checkpoints provable to a party who holds **nothing** of the buyer's, by committing the already-produced canonical anchor bytes (`encodeAnchor()` → `{length, tipHash, genesisHash}`, hashes only, no PII) into a **public append-only transparency log (Rekor v2)** and independently **verifying the returned inclusion proof offline** in `verifyExternal`. Success = a persisted, self-contained WORM receipt whose checkpoint + inclusion proof verify against the log's own key with no live lookup, years after submission and after the shard has been retired; the `externally-transparent` grade is the _only_ grade the sellable "even a root-privileged insider can't rewrite history without it being provable" line attaches to, and it is **strictly opt-in, never default-on** (Fork D). Everything rides behind the same target-agnostic port family as the v1 TSA leg, with `OpenTimestampsAnchorLog` as a documented drop-in. The leg is done when a buyer who opts in gets a Rekor receipt Caisson has _independently verified_ (not merely "submission recorded" — Fork E), the outbox never blind-retries a lost response into a duplicate irrevocable public entry, and CI proves the whole verify path hermetically against committed fixtures with zero live TUF/Rekor fetch.

---

## 2. Preconditions & premise checks

Verified against the real tree (2026-07-13):

| #      | Precondition / premise                                                                                                                                                                                                                                                                                                                        | State                                                                                                                                                                                                                                           | Consequence                                                                                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | **v1 TSA leg is merged** — the `ExternalAnchorSubmission`/`TransparencyLog` sibling port, the durable outbox state machine (`pending/submitted/receipted/failed`, keyed `(accountId, target, anchorLength, anchorDigest)`), `verifyExternal` (existence + byte-match), the receipt schema, the checkpoint job, and the job-ownership boundary | **NOT MET** — `outputs/plans/external-anchoring/` is empty; no `anchor-transparency.ts`, no `verifyExternal`, no `AnchorReceipt` type anywhere in `packages/audit-worm/src` or `packages/compliance-core/src`. v1 is neither built nor planned. | **HARD BLOCKER.** v1.1 EXECUTE cannot begin until v1 lands. Every task below is written against v1's _committed_ interfaces (SPEC §Design + ADR-0332), which do not yet exist in code. If v1's shapes drift during its build, re-baseline R3/R5/R7/R11. |
| **P2** | Operator lock on **tenant-key-via-ed25519ph vs deployment-level anchoring key** (spike open Q1)                                                                                                                                                                                                                                               | **OPEN**                                                                                                                                                                                                                                        | Gates R2/R4 (§5 Fork R-α). Changes the signer surface materially.                                                                                                                                                                                       |
| **P3** | **Live ed25519ph round-trip de-risk** (spike Condition 1): ed25519ph `hashedrekord` interop from JS/Bun against `log2025-1.rekor.sigstore.dev` + Bun-compat of `@sigstore/{sign,verify}` + a captured golden bundle                                                                                                                           | **NOT DONE**                                                                                                                                                                                                                                    | Planned as **R1** (gating). Decides Fork R-β (libs vs hand-roll) and produces the CI golden fixture.                                                                                                                                                    |
| **P4** | Scope lock on **OTS shipped as code vs docs-only** (SPEC: "documented v1.1+ drop-in"; spike: "safer-to-ship-first")                                                                                                                                                                                                                           | **OPEN**                                                                                                                                                                                                                                        | Gates R9 (§5 Fork R-γ).                                                                                                                                                                                                                                 |
| **P5** | SigningConfig public-distribution status (spike open Q6 — Sigstore planned "end-2025/early-2026"; "cheap to check at PLAN time")                                                                                                                                                                                                              | **UNCHECKED** (build-time check)                                                                                                                                                                                                                | Buyer-supplied SigningConfig works regardless; if distributed by EXECUTE, the buyer-config step simplifies. Check at EXECUTE start, not a fork.                                                                                                         |
| PC1    | All packages this leg touches are **commercial** (`LicenseRef-Caisson-Commercial`): `signing-primitive`, `audit-worm`, `compliance`, `compliance-core`. `jobs`/`kernel` are Apache-2.0.                                                                                                                                                       | VERIFIED                                                                                                                                                                                                                                        | No open-core no-depend-up violation as long as anchoring logic stays OUT of `jobs`/`kernel`. Guarded by R13.                                                                                                                                            |
| PC2    | No `@sigstore/*`, `@noble/curves`, or `opentimestamps` dep exists; only `@noble/ed25519 ^3.1.0` (PureEdDSA only) in `signing-primitive/package.json:25`.                                                                                                                                                                                      | VERIFIED                                                                                                                                                                                                                                        | ed25519ph needs a **new** dep (`@noble/curves`, which ships `ed25519ph`). `@sigstore/*` are new deps pending R1's Bun-compat verdict. New deps land in a commercial package → pin-registry awareness, no license conflict.                              |
| PC3    | **Spike correction:** the RFC-6962 merkle inclusion-proof verify is **NOT** "the same algorithm caisson already ships in `audit-chain.ts`." `packages/kernel/src/audit-chain.ts` is a `prevHash`-linked list (`hashChainLink` over `[prevHash, payload]`), not an RFC-6962 binary Merkle tree; there is no inclusion-proof code in the repo.  | VERIFIED                                                                                                                                                                                                                                        | The hand-roll fallback (Fork R-β) is **new** RFC-6962 §2.1.1 node-hashing + C2SP signed-note checkpoint verify — small and well-spec'd, but a fresh implementation. Budget R5 accordingly (§6).                                                         |
| PC4    | Fork D opt-in pattern to mirror already exists: `irreversibleComplianceOptIn` / `COMPLIANCE_ACKNOWLEDGEMENT` (`packages/audit-worm/src/store.s3.ts:56-95`, ADR-0051).                                                                                                                                                                         | VERIFIED                                                                                                                                                                                                                                        | R10 reuses this exact typed-irreversible-consent shape for the public-log opt-in (ladder rung 2).                                                                                                                                                       |
| PC5    | Anchor bytes source is `encodeAnchor()` (`chain-store.ts:96`, canonical `{length, tipHash, genesisHash?}`); the anchor already commits the full chain prefix via `tipHash`.                                                                                                                                                                   | VERIFIED                                                                                                                                                                                                                                        | Nothing new is hashed; the ed25519ph digest + submission are over these same bytes (SPEC §Design 2).                                                                                                                                                    |
| PC6    | `packages/ui` + `apps/site` are **FROZEN this wave** (Kickoff S owns them).                                                                                                                                                                                                                                                                   | GIVEN                                                                                                                                                                                                                                           | No buyer-dashboard/per-row grade rendering in this leg. The sibling spec owns rendering; SPEC Fork E forbids over-rendering the interim state. Any UI touch is planned but sequenced **after** Kickoff S (see R11 note).                                |
| PC7    | Evidence-pack anchor seam is `evidencePackChainAnchor` / `chainAnchor` in `compliance-core/src/evidence/pack-format.ts:~78,181`.                                                                                                                                                                                                              | VERIFIED                                                                                                                                                                                                                                        | R11 extends this to flow the `externally-transparent` grade tag (small).                                                                                                                                                                                |
| PC8    | ADR ceiling per CLAUDE.md is 0333; `docs/adr-index.md` catalog is the numbering SOT.                                                                                                                                                                                                                                                          | VERIFIED                                                                                                                                                                                                                                        | EXECUTE files a v1.1-lock ADR extending ADR-0332 at the next available number (≥0334); collisions renumber-by-meaning at merge (ADR-0088).                                                                                                              |

---

## 3. Task decomposition (atomic)

Lane key: **sonnet** = bounded implementation; **opus** = review-grade (money/crypto/security seams). Never fable for fan-out. Every task inherits the engineering invariants (TS-strict, Bun-only, Zod `.strict()` at boundaries, `crypto.timingSafeEqual` for secret compares, `fetchWithTimeout` for outbound, integer money units [n/a here], append-only versions, open-core no-depend-up).

### Gate tasks (not code)

**R0 — Operator lock: tenant-key-via-ed25519ph vs deployment-level anchoring key**

- Files: none (records into the EXECUTE ADR).
- What: resolve Fork R-α (§5). This is `security`/`external-system` — an operator decision, not mechanical.
- Verify: an ADR line (extending ADR-0332) states the chosen signer model.
- Size: — · Lane: operator gate.

**R1 — De-risk: live ed25519ph round-trip + Bun-compat + capture golden bundle** _(Condition 1 pre-work)_

- Files: throwaway spike script (scratchpad) → outputs a short findings note under `outputs/specs/external-anchoring/` + the committed golden fixture into `packages/audit-worm/src/__fixtures__/rekor-v2/` (fixture is the durable deliverable).
- What changes: construct an `ed25519ph` `HashedRekordRequestV002` (`keyDetails: PKIX_ED25519_PH`, `data.algorithm: SHA2_512`, `digest = base64(SHA-512(sampleAnchorBytes))`, `sig = ed25519ph(testSeed, sampleAnchorBytes)` via `@noble/curves/ed25519`); `POST` to `log2025-1.rekor.sigstore.dev/api/v2/log/entries` with `fetchWithTimeout(..., 20_000)`; persist the returned `TransparencyLogEntry`; verify its inclusion proof + checkpoint **offline** against a pinned `trusted_root.json`. Simultaneously exercise `@sigstore/sign` `TLogV2Client.createEntry` + `@sigstore/verify` 3.1.x under Bun.
- Outputs (gating): (a) ed25519ph JS/Bun interop verdict → else ECDSA-P256 fallback; (b) `@sigstore/*`-on-Bun verdict → **decides Fork R-β**; (c) the golden `TransparencyLogEntry` bundle + a pinned `trusted_root.json`, committed as R6's fixtures.
- ⚠️ This posts an **irrevocable public entry** (test key, sample hashes-only bytes, no PII) — a deliberate one-time public egress; `external-system`, operator-gated.
- Verify: the offline verify of the captured bundle passes with zero network; findings note records both verdicts.
- Size: M · Lane: sonnet (investigative; escalate to opus only on an interop surprise).

### Implementation tasks (all in commercial packages)

**R2 — ed25519ph signing mode on the `Signer` port** _(gated on R0)_

- Files: `packages/signing-primitive/src/sign.ts`, `sign.test.ts`, `package.json` (add `@noble/curves`).
- What: add an ed25519ph-mode sign (e.g. `signAnchor(bytes): Promise<Uint8Array>` on `Signer`, or a sibling primitive) using `@noble/curves/ed25519`'s `ed25519ph`, reusing the same 32-byte `#secretKey` seed — same `keyId`, same public key. The existing pure-Ed25519 `sign()` (evidence packs) is untouched. Fail-closed: unavailable/malformed tenant key throws (→ outbox `failed`, never a substitute key). If R0 = deployment-key, this instead binds a deployment/ephemeral anchoring key and the per-tenant-access surface disappears.
- Verify: `bun test packages/signing-primitive` — a round-trip test signs sample anchor bytes with ed25519ph and verifies with `@noble/curves` ed25519ph over the same public key; wrong-length seed fails closed.
- Size: M · Lane: sonnet (impl) → **opus at SHIP** (crypto seam).

**R3 — `ExternalAnchorSubmission` + `TransparencyLog` port + self-contained receipt schema** _(depends v1 port family; P1)_

- Files: `packages/audit-worm/src/anchor-transparency.ts` (the v1 file this leg extends), its test.
- What: land the SPEC's v1.1 signed shape — `ExternalAnchorSubmission { anchorBytes, digest, signature, verifier: PublicKeyMaterial, target }` and `TransparencyLog.submit(entry): Promise<TransparencyReceipt>`. Define the **self-contained** `TransparencyReceipt`/`RekorReceipt` Zod `.strict()` schema (spike decision #2): `{ checkpoint (signed note), inclusionProof.hashes[] + logIndex, leaf inputs (digest/signature/verifier publicKey/keyDetails) OR canonicalizedBody, the log's checkpoint-signing public key + origin string, RFC-3161 token }`. `PublicKeyMaterial` carries `keyDetails: PKIX_ED25519_PH` (or ECDSA per R0).
- Verify: `bun test` — schema round-trips the R1 golden bundle; `.strict()` rejects an unknown field; a receipt missing the embedded checkpoint key fails validation.
- Size: M · Lane: sonnet.

**R4 — `RekorAnchorLog` (submission construction + live transport)** _(depends R1, R2, R3)_

- Files: `packages/audit-worm/src/anchor-transparency.ts` (or `anchor-rekor.ts`), test + a network-free double.
- What: build the `HashedRekordRequestV002` (ed25519ph digest+sig+verifier from R2/R3), read the write URL from a **deployment-supplied SigningConfig** (never hardcoded — spike decision #3), submit via the R1-chosen path (`TLogV2Client.createEntry` or hand-rolled `POST`), `fetchWithTimeout(..., ≥20_000)` (spike decision #7, hard requirement), parse the `TransparencyLogEntry` into the R3 self-contained receipt (snapshot the checkpoint key + origin into it). Ignore the duplicative `inclusionProof.rootHash/treeSize/logIndex` (spike Q1 delta 4). Test double in CI; live transport un-exercised (ADR-0047 ethos, same as the TSA seam).
- Verify: `bun test` — the double produces a receipt that R5 verifies; a submit whose response is lost resolves to the outbox operator-reconciliation state (R7), not a retry; timeout is ≥20s.
- Size: L · Lane: sonnet (impl) → **opus at SHIP** (external-system + crypto seam).

**R5 — Offline inclusion-proof verification in `verifyExternal` (v1.1 depth)** _(depends R1, R3, R6)_

- Files: `packages/audit-worm/src/anchor-transparency.ts` (the `verifyExternal` from v1), test.
- What: deepen `verifyExternal(accountId)` from v1's existence+byte-match to the full offline check (SPEC §Design 5, spike Q5): (1) verify the C2SP signed-note **checkpoint** against the **receipt-embedded** log key + expected origin — **without** enforcing TUF timestamp freshness (receipts outlive roots — spike decision #2); (2) reconstruct/confirm the leaf; (3) verify the RFC-6962 **inclusion proof** using top-level `logIndex` + `hashes[]` + the checkpoint's `treeSize`/`rootHash`; (4) confirm the leaf `digest == SHA-512(WORM anchor bytes)` (the byte-match to the chain v1 already does). Fail-closed at every step. Path chosen per Fork R-β: `@sigstore/verify` 3.1.x internals, else the hand-rolled RFC-6962 + signed-note verify (**new code** per PC3, not `audit-chain.ts` reuse).
- Verify: `bun test` — the R1/R6 golden bundle verifies; a tampered `rootHash`, a flipped proof hash, a wrong-origin checkpoint, and a digest mismatch each fail closed; **zero network**.
- Size: L · Lane: sonnet (impl) → **opus at SHIP**.

**R6 — TUF root pinning + hermetic CI fixtures** _(depends R1)_

- Files: `packages/audit-worm/src/__fixtures__/rekor-v2/{trusted_root.json, signing_config.json, golden-entry.json}`, a fixture-loader + its use in R5's test, a `README`/refresh-cadence note beside the fixtures.
- What: commit the pinned `trusted_root.json` (all log keys incl. inactive shards) + a caisson SigningConfig (`log2025-1` prepended) + the R1 golden `TransparencyLogEntry`. Verify runs either `getTrustedRoot({ rootPath, cachePath, forceCache: true })` or (preferred, fully hermetic) feeds the committed root straight to the verifier (the sigstore-js verify tests' own pattern). Refresh-cadence note: TUF targets expire; the offline-verify-of-a-stored-receipt path must NOT enforce TUF freshness (PC3/decision #2), so a stale pinned root does not break stored-receipt verify — it only affects re-pinning for new golden captures. Ownership: refreshed on the pinned-registry sweep cadence.
- Verify: `bun test packages/audit-worm` passes with the network unplugged (no live TUF/Rekor fetch — assert via a fetch-blocking test harness or `forceCache`).
- Size: M · Lane: sonnet.

**R7 — Rekor-specific outbox recovery semantics** _(depends R3 + v1 outbox; P1)_

- Files: `packages/audit-worm/src/anchor-transparency.ts` (target-specific recovery hook on the v1 outbox), test.
- What: the v1 outbox state machine ships target-agnostic; wire Rekor's recovery (SPEC §Design 3): Rekor v2 exposes **no** lookup-by-digest and **no** idempotency key (spike Q1 delta 1 — online proof retrieval removed), so a response lost after the log accepts but before the receipt is durably written resolves to the **operator-reconciliation `failed`** state — surfaced, **never blind-retried** (a blind retry risks a duplicate irrevocable public entry, worse than a delayed checkpoint). Contrast: OTS recovery (R9) is idempotent-ish (re-submit just re-aggregates).
- Verify: `bun test` — a simulated post-accept crash lands the row in `failed`/reconciliation, not `submitted→retry`; no second submit fires.
- Size: M · Lane: sonnet → **opus at SHIP** (external-system correctness).

**R8 — Shard-rotation handling (verify + test, not reimplement)** _(depends R5, R6)_

- Files: R5's test + a fixture for a retired-shard key; small wiring in `RekorAnchorLog`/`verifyExternal` if needed.
- What: confirm the client reads the write URL from SigningConfig and the verify key from TrustedRoot **by `logId.keyId`** — Caisson does not reimplement sharding (spike Q4). The load-bearing test: a receipt whose checkpoint was signed by a **now-inactive** shard key still verifies offline, because the receipt embeds that key (decision #2). No `log2025-1…` hardcode anywhere (grep-assert).
- Verify: `bun test` — offline verify of a receipt against an "inactive-shard" embedded key passes; `grep -r "log2025" packages/audit-worm/src` returns only fixtures/config, never source.
- Size: S · Lane: sonnet. _(May fold into R4/R5/R6; kept separate for the rotation-specific test.)_

**R9 — `OpenTimestampsAnchorLog` drop-in** _(depends R3; gated on R0-adjacent Fork R-γ)_

- Files: (if code) `packages/audit-worm/src/anchor-ots.ts` + test + double; (if docs-only) a `docs/` section only.
- What: an `OpenTimestampsAnchorLog` behind the same `TransparencyLog` port — `signature`/`verifier` fields **unused** (OTS needs no per-entry signature; sidesteps the ed25519ph problem entirely — spike Q8), `submitted` (PendingAttestation held) → `receipted` (after `ots upgrade` lands the Bitcoin proof). Verify needs Bitcoin block headers. Spike flags OTS as the **safer-to-ship-first** `externally-transparent` proof (idempotent-ish, free aggregation). Scope (code vs docs-only) is Fork R-γ.
- Verify: (if code) `bun test` — a double round-trips submitted→receipted; the port shape matches `TransparencyLog` exactly. (if docs-only) the drop-in contract is documented against the port.
- Size: M (code) / S (docs) · Lane: sonnet.

**R10 — Fork D strictly-opt-in public-log surfacing** _(depends R3, R4)_

- Files: `packages/audit-worm/src/anchor-transparency.ts` (typed consent), test; wiring in the RekorAnchorLog/target-selection path.
- What: a typed **irreversible-publicity consent** mirroring `irreversibleComplianceOptIn`/`COMPLIANCE_ACKNOWLEDGEMENT` (`store.s3.ts:56-95`, PC4/ADR-0051) — the only constructor demands the exact acknowledgement string; `RekorAnchorLog`/any public-log target **refuses to submit** without it. **Never default-on** (Fork D); TSA stays the default. This is the guard that makes the irreversible public egress safe.
- Verify: `bun test` — submit without the typed consent fails closed; the wrong acknowledgement string fails; the default target with no opt-in is TSA, never a public log.
- Size: M · Lane: sonnet → **opus at SHIP** (this is the security gate on irreversible public egress).

**R11 — Evidence-pack `externally-transparent` grade tag** _(depends R3 + v1 receipt inclusion; P1)_

- Files: `packages/compliance-core/src/evidence/pack-format.ts` (+ `generate.ts`), tests, `__golden__` refresh.
- What: flow the `externally-transparent` grade value through the receipt inclusion the v1 leg adds beside `chainAnchor` (PC7), so an exported pack is tagged with which grade backs its proof (SPEC §Design 6). Small — a schema value + generator wiring; golden-file regression before/after.
- Verify: `bun test packages/compliance-core`; `__golden__/evidence-pack.manifest.json` regenerates byte-stably with the grade tag.
- ⚠️ **Rendering** of this grade (buyer dashboard / per-row) is **out of scope** — `packages/ui`/`apps/site` are frozen (Kickoff S), and SPEC Fork E forbids over-rendering the interim state. This task ships only the pack-format/generator data, not UI.
- Size: S · Lane: sonnet.

**R12 — Docs: egress sink, Trust-grades honesty, private-Rekor guide, refresh cadence**

- Files: `docs/security/` (buyer-facing egress-sink row for `sigstore.dev` / OTS calendars), a Trust-grades honesty section, the **private-Rekor-per-buyer** docs-only deployment guide (Fork C), the fixture refresh-cadence note (cross-links R6).
- What: land the SPEC's data-custody/egress-check requirement — the new external egress sink (`sigstore.dev` at v1.1; OTS calendars) in buyer-facing security docs the same change; `externally-transparent` copy says "provable to a party who holds nothing of yours," never conflated with `trusted-timestamped`'s "private, third-party-clock-attested receipt."
- ⚠️ **Cross-repo:** for Caisson's _own_ deployment a row must also land in gridwork's `identity/security-surfaces.md` (external to this repo, `/home/gw/lab/gridwork-core/`) — this is an **operator/cross-repo action**, NOT edited from this session's tree. Flag it in the SHIP note.
- Verify: `bun run sot` green; the egress sink is documented; grade copy passes the honesty guard (no "externally verifiable" on TSA).
- Size: M · Lane: sonnet (or haiku for the prose-heavy parts).

**R13 — Boundary guard + changeset + ADR draft**

- Files: `.changeset/*.md` (commercial packages touched), the v1.1-lock ADR draft (`knowledge/decisions/ADR-0334+…`), a standards-gate assertion.
- What: confirm no anchoring/ed25519ph/Rekor/OTS logic leaked into Apache-2.0 `jobs`/`kernel` (PC1 — `bun run` the standards-gate open↔commercial check); land changesets for `signing-primitive`/`audit-worm`/`compliance-core` (append-only versions); draft the ADR recording the R0 signer decision, the Fork R-β lib/hand-roll outcome, and the Fork R-γ OTS scope, extending ADR-0332.
- Verify: `bun run --filter '@caisson/standards-gate' check` (or repo equivalent) green; `changeset status --since=origin/main` clean; ADR number un-collided vs `main` (ADR-0088 check).
- Size: S · Lane: sonnet → **opus** for the ADR (decision-grade).

---

## 4. Task ordering / dependency graph

```
P1 (v1 merged) ─── hard gate on ALL implementation tasks ───┐
                                                            │
R0 (operator: signer model) ──┐                             │
                              ├─> R2 (ed25519ph signer) ──┐  │
R1 (de-risk; Fork R-β) ───────┼──────────────────────────┼──┼─> R4 (RekorAnchorLog) ─> R7 (outbox recovery)
                              │                           │  │           │
                              │   R3 (port + receipt) ────┴──┴───────────┼─> R10 (opt-in, Fork D)
                              │        │  │  │                           │
R6 (TUF fixtures) <── R1 ─────┘        │  │  └─> R11 (evidence grade tag) │
   │                                   │  └────> R5 (offline verify) <────┘
   └──────────────────────────────────┴────────> R5 ─> R8 (shard rotation test)
Fork R-γ (OTS scope) ─> R9 (OTS drop-in)   [parallel to Rekor path]
R12 (docs)  <── after R4 + R10             R13 (guard/changeset/ADR) <── LAST, after all
```

- **Gate first:** R0 + R1 before any signer/submit/verify work; P1 before everything.
- **Critical path:** R1 → R3 → R4 → R7, and R6 → R5 → R8. R2 feeds R4; R10 gates the public egress; R13 closes.
- **Parallelizable (distinct files, worktree-isolated writers per doctrine):** R6 (fixtures) ∥ R2 (signer) ∥ R9 (OTS); R11 (compliance-core) ∥ R12 (docs) once R3/R4 land.

---

## 5. Open forks & operator gates

Per the one-operator rule — **never auto-decide a fork.** Each carries a labeled recommendation; the lock is the operator's.

> **LOCKED 2026-07-13 (operator picker) → ADR-0346.** Fork R-α = **deployment-level ed25519ph
> anchoring key** (R2/R4 take the deployment-key path; the per-tenant-key-access plumbing is
> deleted from scope; ECDSA-P256 stays the R1-failure fallback). Fork R-γ = **minimal
> OpenTimestampsAnchorLog shipped as code** (R9 is M, not S). Fork R-β stays evidence-resolved
> by R1 as planned.

### Fork R-α — Signer model: tenant-key-via-ed25519ph **vs** deployment-level anchoring key

- **Recommendation:** _deployment-level (or per-deployment) anchoring key via ed25519ph_ — **confidence: medium.**
- **Evidence:** spike open Q1 (flagged "the single highest-leverage open call"): `externally-transparent` trust comes entirely from **log inclusion** (checkpoint + proof), and the anchor bytes already commit the tenant chain tip via `tipHash` — Rekor only needs _some_ valid verifier material, not authorship trust. A deployment-level key eliminates the hardest surfaces: reaching a BYOK/KMS/crypto-shredded tenant key from a background job, and the fail-closed-on-unavailable-tenant-key failure mode. **Counter-weight:** SPEC §Design 1 + ADR-0332 explicitly _want_ the per-tenant binding ("binding to the existing per-tenant Ed25519 signer"); the spike calls that binding possibly "ceremony without security value." This is a `security`/`external-system` judgment, not mechanical.
- **Impact if flipped:** changes R2's surface (tenant-seed ed25519ph vs a deployment key) and deletes/keeps the per-tenant-key-access path in R4.
- **OPERATOR LOCK REQUIRED before EXECUTE.**

### Fork R-β — Client: `@sigstore/{sign,verify}` libraries **vs** hand-rolled v2 submit + RFC-6962/checkpoint verify

- **Recommendation:** _try `@sigstore/*` first, hand-roll as the documented fallback_ — **confidence: medium; resolved by R1's evidence, not taste.**
- **Evidence:** the libs support v2 submit + offline verify today (spike Q2), but declare `engines: node` and are **unproven on Bun** (spike open Q2). R1 settles it. **Correction (PC3):** the hand-roll is **not** `audit-chain.ts` reuse — it is new RFC-6962 §2.1.1 + C2SP signed-note code (small, well-spec'd), so the fallback costs more than the spike's "algorithm already in the repo" framing implies.
- **Impact:** decides the R4/R5 implementation path + whether `@sigstore/*` deps land.
- **Gated on R1** (evidence-resolved; surface the outcome to the operator, but no taste-lock needed unless R1 is ambiguous).

### Fork R-γ — OTS: shipped as code in v1.1 **vs** docs-only drop-in

- **Recommendation:** _ship a minimal `OpenTimestampsAnchorLog` behind the port_ — **confidence: low-medium.**
- **Evidence:** spike Q8/decision #6: OTS sidesteps the ed25519ph problem entirely (no per-entry signature), is idempotent-ish (safer outbox recovery), gets free aggregation, and is "arguably safer-to-ship-first" — a low-risk way to prove the `externally-transparent` grade end-to-end before betting on ed25519ph interop. **Counter-weight:** SPEC says "documented v1.1+ drop-in" (docs-only is the literal SPEC floor); shipping code widens v1.1 scope + adds a Bitcoin-header verify dependency.
- **Impact:** R9 is M (code) or S (docs).
- **OPERATOR LOCK REQUIRED before EXECUTE.**

_(P5 — SigningConfig public-distribution status — is a cheap build-time check, not an operator fork; resolve at EXECUTE start.)_

---

## 6. Risks & unknowns

1. **Bun-compat of Node-targeted `@sigstore/*`** — unproven (PC2, spike open Q2). Mitigation: R1 resolves; hand-roll fallback (Fork R-β).
2. **ed25519ph JS/Bun interop vs the live public instance** — proven in Go (#520) + the server allowlist, unobserved from JS/Bun (spike Q6). Mitigation: R1 resolves; ECDSA-P256 dedicated-key fallback (spike decision #1).
3. **Hand-roll ≠ reuse (PC3)** — the RFC-6962 merkle + C2SP checkpoint verify is fresh code if Fork R-β falls back. Small but must carry its own money/security self-checks; budget R5 as L, not S.
4. **Irreversible public egress** — every Rekor/OTS entry is permanently public (existence, cadence, rough volume leak). Guard: R10's typed opt-in (Fork D). Note R1 itself posts one deliberate public test entry.
5. **Receipt longevity vs shard/root turndown** — shards retire ~6mo, roots expire, receipts are WORM-retained for years. Mitigation: self-contained receipt embeds the checkpoint key + origin (decision #2, R3/R8); `verifyExternal` must NOT enforce TUF freshness (R5) — a years-old-but-valid checkpoint must still verify.
6. **Response-loss → duplicate public entry** — Rekor has no idempotency/lookup (spike Q1). Guard: R7 resolves to operator-reconciliation, never blind retry.
7. **v1 shape drift (P1)** — v1.1 is planned against v1's _committed but unbuilt_ interfaces. If v1's port/outbox/receipt shapes change during its build, re-baseline R3/R5/R7/R11. Biggest schedule risk.
8. **Pinned-fixture staleness** — TUF targets expire; new golden captures need a fresh root. Mitigation: R6 refresh-cadence note on the pinned-registry sweep; stored-receipt verify is freshness-independent by design.
9. **Cross-repo egress ledger (R12)** — gridwork `identity/security-surfaces.md` row is outside this tree; easy to forget. Guard: surface it in the SHIP note as an operator action.

---

## 7. Goal-backward verification plan (Act 4)

VERIFY re-asks the SPEC Goal + the SPEC's own §Acceptance / Forks A–F, not a task checklist:

- **Does an opted-in buyer get a receipt Caisson _independently verified_, not "submission recorded"? (Fork E)** — `verifyExternal` runs the full offline checkpoint + inclusion-proof + digest-match (R5) against a real receipt; a receipt that only reached `submitted` never renders `externally-transparent`.
- **Is the anchor bytes-only, no PII? (SPEC data-custody)** — the submitted digest is over `encodeAnchor()` output (`{length, tipHash, genesisHash}`); grep confirms no payload/PII path (R4).
- **Is it strictly opt-in, never default-on? (Fork D)** — R10 test: default target is TSA; public-log submit fails closed without the typed consent.
- **Do receipts verify after shard turndown, offline, with nothing of the buyer's? (Goal)** — R8 test: inactive-shard-key receipt verifies with the network unplugged.
- **No duplicate irrevocable public entry on crash? (CR-02)** — R7 test: post-accept crash → reconciliation, not retry.
- **Open-core boundary intact? (ADR-0094)** — R13 standards-gate: no anchoring logic in `jobs`/`kernel`.
- **Hermetic CI? (spike decision #4)** — the whole verify suite passes with zero live TUF/Rekor fetch (R6).
- **`fetchWithTimeout ≥20s`? (spike decision #7)** — grep/test asserts the Rekor submit timeout.
- **Tags fire correctly:** `security` + `external-system` → SHIP runs `gw-security-auditor` (opus/fable on the crypto+egress seam) alongside `gw-code-reviewer`. VERIFY partial/fail → new PLAN cycle, do not SHIP; a public-egress or opt-in defect is a fail-stop.

---

## 8. Out-of-scope confirmations (SPEC non-goals as guards)

- **Per-row external inclusion proof (CR-04):** a SHA-256 linked chain has no compact per-row proof. External status is chain/checkpoint-level ONLY. R11 ships pack-format data, not a per-row badge; the Merkle/super-root future fork is the sibling spec's, not this leg's.
- **The per-row verification UI:** sibling spec owns rendering. `packages/ui`/`apps/site` are frozen (Kickoff S). No UI here; the sibling must not render checkpoint-level trust as row-level.
- **Changing the per-append WORM anchor mechanics (`chain-store.ts`):** untouched — anchoring is additive and **never inside the append transaction** (the KNOWN-BOUND discipline, `chain-store.ts:21-24`).
- **DSSE/in-toto envelopes for evidence signatures:** stays the separate ADR-0056 seam. Caisson anchors raw anchor bytes, not DSSE (spike Q1 delta 2).
- **Running/operating log infrastructure:** no witness/monitor network; Caisson produces verifiable receipts, does not run a log. Witnessing (spike open Q5) is a future simplification, out of scope.
- **A Caisson-operated anchoring relay (Fork C):** deferred until a buyer asks — no new Caisson egress/custody surface or SLO taken on here. Private-Rekor-per-buyer is **docs-only** (R12).
- **RFC-3161 TSA integration time:** Rekor v2 gives `integratedTime = 0`; the TSA leg (v1) supplies time. The two grades **compose** at the wire level (a Rekor receipt can also carry a TSA token) — but the TSA leg is not re-built here.
- **v1 TSA leg itself:** not in scope — it is the precondition (P1), a separate plan.
