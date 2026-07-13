# PLAN — Per-row tamperproof verification UI (audit surfaces)

- **SPEC:** `outputs/specs/per-row-verification-ui/SPEC.md` (LOCKED, amended 2026-07-13; forks → ADR-0331)
- **Security pre-pass (BINDING):** `outputs/plans/per-row-verification-ui/SECURITY-PREPLAN.md` — every HIGH item mapped below.
- **Tags:** `frontend` `ui` `security` → SHIP fires `gw-code-reviewer` + `gw-security-auditor`.
- **Wave freeze (Kickoff S):** `@caisson/ui` and `apps/site` are FROZEN this wave. `@caisson/ui-pro`, `@caisson/audit-worm`, `@caisson/kernel`, `apps/admin` are NOT frozen. Every task touching a frozen tree is marked `[FROZEN — seq after Kickoff S]`.
- **PLAN-only session:** no code is modified here. EXECUTE is a later session.

---

## 1. Goal restatement (goal-backward)

An auditor must be able to point at **any single audit-chain row** and see _why_ it is trustworthy — a per-row, anchor-aware verification chip plus a clickable proof panel that shows the three concrete assertions (link recompute · per-length WORM-anchor equality · chain-vs-current-anchor), the anchor metadata, and a copyable JSON receipt — and an **exported evidence pack** must carry the same per-entry receipts plus a standalone verifier so a third party re-verifies without trusting caisson's UI. The expensive machinery already exists: `AuditChainStore.append` mints a write-once WORM anchor at every chain length, so `anchor(seq+1).tipHash === row.hash` is a genuine per-row commitment check with **zero schema change**. VERIFY passes when the admin audit surface renders the **six-state** model per row, the proof panel is honest for redacted rows (`anchor-confirmed-original-not-disclosed`, recompute leg shown "not applicable"), the proof-bundle endpoint enforces the auth contract (server-side key construction, `.strict()` both ways, redaction on the wire, fail-closed on missing anchors), and the pack's standalone verifier recomputes every assertion it can from raw material without trusting the receipt's `checks` block — with the local-verification seal's **claim strength matching the anchor's actual provenance** (GATE-1).

---

## 2. Preconditions & premise checks (verified in code)

| #   | Premise (SPEC/preplan claim)                                                                                                                      | Verified? | Evidence                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Per-length WORM anchor minted at every append                                                                                                     | ✅        | `audit-worm/src/chain-store.ts:224-247` (`anchorChain(entries)` → write-once `anchorKey(len)` put)                                                        |
| P2  | `anchor(i+1).tipHash === row(i).hash` is a real per-row check                                                                                     | ✅        | `chain-store.ts:225` anchors over full chain; kernel `anchorChain` tip = `entries[len-1].hash` (`audit-chain.ts:147-152`)                                 |
| P3  | Kernel hashing is `node:crypto` sync (needs async WebCrypto for browser)                                                                          | ✅        | `audit-chain.ts:20,86-93` (`createHash`) — top-level `node:crypto` import taints the module                                                               |
| P4  | Kernel `.` barrel is node-tainted (can't enter browser bundle)                                                                                    | ✅        | `kernel/src/index.ts:32-40` (`fetch`/`ssrf`→`node:dns`); site demo comment `apps/site/components/audit-worm-demo.tsx:6-9` confirms                        |
| P5  | Kernel exports only `.` and `./fetch` — **no browser-safe verify subpath exists**                                                                 | ✅        | `kernel/package.json:11-22`                                                                                                                               |
| P6  | Redaction is a ui-pro presentation util today (pure, node-free)                                                                                   | ✅        | `ui-pro/src/lib/redact.ts` (`DEFAULT_REDACT_KEYS`/`redactValue`); consumed by `payload-viewer.tsx:8-12`                                                   |
| P7  | `apps/admin` is an **operator** app; audit page takes `searchParams.account` (client-supplied target is the design)                               | ✅        | `apps/admin/src/app/business/audit/page.tsx:19,32-35`; H1                                                                                                 |
| P8  | Route-level `requireAdmin` re-checks better-auth+allowlist in-handler (not the proxy header)                                                      | ✅        | `apps/admin/src/lib/admin-route.ts:67-70` + `admin-session.ts:29-54`                                                                                      |
| P9  | `admin-route.json()` already sets `nosniff`/`DENY`/`no-store`                                                                                     | ✅        | `admin-route.ts:13-24` (M2 reuse target)                                                                                                                  |
| P10 | Server-side WORM key construction path exists (`buildArtifactKey`/`assertSafeKey`, UUID-scoped, traversal-safe)                                   | ✅        | `audit-worm/src/store.ts:93-164`; `chain-store.ts:87-94` (`anchorKey`)                                                                                    |
| P11 | Ed25519 sign/verify machinery exists (issuer keypair, baked-key offline verify)                                                                   | ✅        | `license-issue/src/signer.ts` (`Ed25519Signer`), `license-verify/src/verify.ts:99-152` (`crypto.verify`) — reuse target IF GATE-1 = signed anchors        |
| P12 | Rate-limit primitive exists as a real package                                                                                                     | ✅        | `packages/rate-limit/src/{token-bucket,account-store,account-hook}.ts` (preplan's `mcp-server/src/rate-limit.ts` path is stale — that's a port test only) |
| P13 | ADR ceiling                                                                                                                                       | ✅        | highest is `ADR-0333`; new locks land `ADR-0334+` (collision-check `main` at EXECUTE)                                                                     |
| P14 | audit-worm deps `@caisson/ui` (frozen) but NOT `@caisson/ui-pro`                                                                                  | ✅        | `audit-worm/package.json` — GATE-4 relevance                                                                                                              |
| P15 | Redaction is **presentation-side only** — the store/DB hold the original payload; the endpoint would ship cleartext unless it redacts server-side | ✅        | H3; `chain-store.ts:204-214` stores canonical original `payload::jsonb`                                                                                   |

**Premise conclusion:** the found leverage (P1–P2) holds. The one structural blocker is P4/P5 — the browser verify path must be a **new node-free kernel subpath**, not reachable through the tainted `.` barrel.

---

## 3. Task decomposition

Lane key: **sonnet** = bounded implementation; **opus** = review-grade (auth/tenant/crypto/money seam). Never fable for fan-out. Size: S ≤ ~80 LOC · M ~80–250 · L ~250–450 · XL > 450.

### Phase A — Kernel open helpers (Apache-2.0 base, node-free; fork d)

**T-K1 · Extract pure canonicalization to a node-free module**

- Files: `packages/kernel/src/canonical.ts` (new) · `packages/kernel/src/audit-chain.ts` (re-point) · `kernel/package.json` exports (add `./canonical` if the web module needs a subpath, else internal only).
- Change: move `sortValue`, `canonicalize`, and the pure types (`JsonValue`, `AuditChainEntry`, `AuditChainAnchor`, `ChainVerification`) into `canonical.ts` with **no `node:crypto` import**. `audit-chain.ts` imports them back and re-exports so the `.` barrel API is byte-identical. This is a pure move — the load-bearing canonical bytes must not change.
- Verify: `bun test packages/kernel/src/audit-chain.test.ts` green incl. `__golden__` (proves canonical bytes unchanged); `grep -L "node:" packages/kernel/src/canonical.ts` (asserts node-free).
- Size: S · Lane: sonnet.

**T-K2 · Browser-safe per-row verify + receipt builder (fork d core)**

- Files: `packages/kernel/src/audit-verify.ts` (new) · `kernel/package.json` (add `./audit-verify` export mapping) · `packages/kernel/src/audit-verify.test.ts` (new).
- Change (imports ONLY `./canonical.ts` — node-free, P4):
  - `hashChainLinkAsync(prevHash, payload)` — `await crypto.subtle.digest("SHA-256", TextEncoder().encode(canonicalize([prevHash, payload])))` → lowercase hex. New async helper, **not** a signature change to sync `hashChainLink` (SPEC impl note).
  - `verifyEntryAgainstAnchor(entry, anchorForLen)` → `{ linkRecompute: "pass"|"fail"|"na", anchorEquality: "pass"|"fail" }` — leg 1 recompute (async), leg 2 `anchorForLen.tipHash === entry.hash` (plain `===`; public integrity tags, **not** secrets — see §Clarification below).
  - `classifyRowState(legs, { redacted })` → the **six** states (`verified` | `anchor-confirmed-original-not-disclosed` | `tampered` | `unverifiable` | `pending` | `genesis`). Redacted ⇒ leg 1 is `na` ⇒ never `verified`; both-pass non-redacted ⇒ `verified`; any leg `fail` ⇒ `tampered` (naming WHICH leg).
  - `buildRowReceipt(...)` → `{ v: <schemaVersion>, seq, hash, prevHash, anchor: { length, tipHash }, raw: {...}, redacted, checks, verifiedAt }` — **versioned raw proof material**; `checks`/`verifiedAt` documented derived/untrusted (CR-06). **Omit `anchor.key`** (L2).
- Verify: `bun test packages/kernel/src/audit-verify.test.ts` — cases: link pass/fail; anchor-equality pass/fail; redacted → `anchor-confirmed…` with leg1 `na`; tampered names the failing leg; receipt carries raw material sufficient to recompute both legs; `crypto.subtle` recompute matches a node `createHash` fixture (cross-impl agreement).
- Size: M · Lane: sonnet.

**T-K3 · Move redaction predicate into kernel (node-free) so the endpoint can redact server-side (H3, binding #3)**

- Files: `packages/kernel/src/redact.ts` (new) · `kernel/package.json` (`./redact` export) · `packages/ui-pro/src/lib/redact.ts` (re-export from `@caisson/kernel/redact` — keeps ui-pro API + `payload-viewer.tsx` imports stable).
- Change: relocate `REDACTED`, `DEFAULT_REDACT_KEYS`, `isRedactedKey`, `redactValue` (all already pure) to kernel. ui-pro/lib/redact.ts becomes a one-line re-export. **Rationale:** the endpoint lives in `apps/admin`, which already deps `@caisson/kernel` but NOT `@caisson/ui-pro` (P14) — putting the predicate in the open base avoids adding a commercial-UI dep to admin AND aligns with fork d's open-core split. (See GATE-3.)
- Verify: `bun test packages/ui-pro/src/lib/redact.test.ts` green (unchanged behavior); `grep -L "node:" packages/kernel/src/redact.ts`.
- Size: S · Lane: sonnet.

**T-K4 · Standalone offline verifier (self-contained, zero-dep; fork c/d, CR-06)**

- Files: `packages/kernel/src/evidence/standalone-verifier.mjs` (new asset/template) · `packages/kernel/src/evidence/standalone-verifier.test.ts` (new golden).
- Change: a single self-contained `.mjs` (no `@caisson/*` import — a third party will not `bun install` the monorepo) that: reads a pack of receipts, **inlines** canonicalize + SHA-256 (Web `crypto.subtle` with a `node:crypto` fallback — L4/P3), recomputes leg 1 (link) + leg 2 (anchor-tip equality) from `raw` material, and **never trusts** the embedded `checks` block. Redacted rows: report leg 1 as "not applicable — payload redacted," check leg 2 only (matches the UI rule). Prints per-row PASS/FAIL/NA and an aggregate.
  - `// ponytail: inlined canonicalize is a deliberate duplicate of kernel/canonical.ts — pinned by the golden test below; upgrade path = codegen from canonical.ts if a third divergence appears.`
- Verify: golden test asserts the verifier's inlined `canonicalize(x)` byte-matches `kernel/canonical.ts` `canonicalize(x)` over the golden corpus (drift guard); an integration case runs the verifier over a real pack (from T-E1) and asserts correct PASS + a tamper case FAILs + a redacted case reports leg1 NA.
- Size: M · Lane: sonnet.

### Phase B — audit-worm data path (commercial; not frozen)

**T-W1 · `AuditChainStore.getRowProof(accountId, seq)` — single-row proof read (fork f, L1, binding #5/#6)**

- Files: `packages/audit-worm/src/chain-store.ts` · `packages/audit-worm/src/chain-store.integration.test.ts`.
- Change: new method returning `{ entry: AuditChainEntry (raw, unredacted at this layer), anchorForRow: AuditChainAnchor, chainLength, currentAnchorMissing?: boolean }`:
  - Resolve target chain length (single `COUNT`/tip `seq+1`, or reuse `loadEntries` length).
  - **Bound `seq` server-side to `0 ≤ seq < length`** (L1 — reject `seq == length`, the truncation-probe key `anchor(length+1)`; reject `seq > length`). Out-of-range → throw `ValidationError` (→ 400 at the route), never a silent `unverifiable`.
  - Fetch `anchor(seq+1)` via the existing `anchorKey` + `store.get` + `decodeAnchor` (server-side key construction only — CR-07 §5). Missing anchor → return a structured `{ unverifiable: true, reason }`, **never** a fabricated pass (binding #6, matches `verify()`'s fail-closed direction).
  - Read the single entry by `seq` (targeted `WHERE account_id=$1 AND seq=$2`) rather than the full chain (fork f cost discipline). Reuse `withTenant`.
- Verify: `bun test packages/audit-worm/src/chain-store.integration.test.ts` — valid seq returns entry+anchor; `seq == length` rejected (L1); `seq > length` rejected; missing `anchor(seq+1)` → `unverifiable` (fail-closed); tenant scoping holds (a different accountId sees only its own).
- Size: M · Lane: sonnet (crypto-adjacent read path; review-grade covered at SHIP).

**T-W2 · [CONDITIONAL on GATE-1 = signed anchors] Sign anchors at mint**

- Files: `packages/audit-worm/src/chain-store.ts` (`encodeAnchor`/`append`) · kernel `anchorSchema`/`AuditChainAnchor` (optional `sig`+`keyId`) · signer wiring · migration doc.
- Change: at anchor mint, sign the canonical anchor bytes with the **anchor-signing identity** (GATE-1a); store `sig`+`keyId` **additively** (optional fields — old anchors stay valid unsigned; NOT a chain-format break). Client/verifier check the signature against a pinned public key. **Only executes if the operator locks GATE-1 = option 2.**
- Verify: signed-anchor round-trip (sign→store→read→`crypto.verify` pass); an unsigned legacy anchor still verifies structurally; a forged anchor (wrong sig) → verify fail. Tests + a dedicated `gw-security-auditor` pass (append is the money/integrity seam; secrets tag fires).
- Size: L–XL · Lane: **opus** (crypto + append + secret-surface). Guard: `secrets`/`security` tag → own SHIP audit.

### Phase C — Admin proof-bundle endpoint (operator surface — H1, binding #1)

**T-A1 · `GET /api/admin/audit/proof` route (operator, target account is a validated input)**

- Files: `apps/admin/src/app/api/admin/audit/proof/route.ts` (new).
- Change:
  - `requireAdmin(req)` re-checked **in the handler** (binding #1; P8) → 401 on no verified allowlisted session. **This is the operator surface: the target `accountId` is an explicit `z.string().uuid()` input** (operator cross-tenant inspection is the design, H1) — not "session-derived." "Session-derived" tenant semantics apply only to the deferred tenant route (GATE-2).
  - Zod `.strict()` query: `{ account: z.string().uuid(), seq: z.number().int().nonnegative() }` (coerce seq from the query string, then `.int().nonnegative()`; reject strings/floats — CR-07 §5). Unknown fields rejected (binding #6).
  - Call `getRowProof(account, seq)` (T-W1); on its `ValidationError` (seq range) → 400; on `unverifiable` → **200 with `{ state: "unverifiable", reason }`** (fail-closed, binding #6).
  - **Redact server-side (H3, binding #3):** run kernel `redactValue`/`DEFAULT_REDACT_KEYS` (T-K3) on `entry.payload` BEFORE it crosses the wire; stamp `redacted: true` + `redactedPaths` when anything was masked. The original never leaves the server.
  - Build the receipt via kernel `buildRowReceipt` (T-K2) — **no `anchor.key`** (L2).
  - Response via `admin-route.json()` (M2 floor headers — nosniff/DENY/no-store; P9) + `Vary` on the auth dimension; Zod `.strict()` response shape.
  - **Rate-limit (M4, binding #9):** `@caisson/rate-limit` token-bucket keyed on `actor+account` (P12).
  - **Access-log (M1):** write an `admin_action_log` read entry (actor email, target account, seq, ts) — reuse the admin write path (`intel-triage.ts` `withAdminWrite` pattern is the closest precedent).
- Verify: `bun test` the route (T-A2) + a manual `curl` against a seeded PGlite chain (documented in the task).
- Size: L · Lane: **opus** (auth + cross-tenant + redaction seam).

**T-A2 · Endpoint security tests (binding #10 — superset of CR-07's list)**

- Files: `apps/admin/src/app/api/admin/audit/proof/route.test.ts` (new).
- Cases (each a named test): (1) **operator non-allowlisted-session → 401** (operator-route denial — the operator-surface analogue of cross-tenant denial); (2) **missing-anchor fail-closed** → 200 `unverifiable`, never a fabricated 200 pass; (3) **redacted-value-absent** — a row with a `password`/`token` field: assert the response body AND the built receipt contain none of the original secret values (H3); (4) **seq out-of-range** (`seq == length` and `seq > length`) → 400 (L1); (5) **server-side key construction** — a crafted `seq`/account cannot influence the WORM key beyond `buildArtifactKey`'s UUID+segment discipline (assert `assertSafeKey` rejects, no interpolation); (6) **`.strict()` both ways** — unknown query field and unknown response field both rejected.
- Verify: `bun test apps/admin/src/app/api/admin/audit/proof/route.test.ts` all green.
- Size: M · Lane: **opus** (adversarial test authoring).

### Phase D — UI surfaces (commercial; consume frozen `@caisson/ui` WITHOUT modifying it)

**T-U1 · Client verify hook + ProofPanel (audit-worm/ui; M3, L4)**

- Files: `packages/audit-worm/src/ui/proof-panel.tsx` (new) · `packages/audit-worm/src/ui/use-row-verify.ts` (new) · `packages/audit-worm/src/ui/index.ts` (export) · tests.
- Change:
  - `useRowVerify(receipt)` — runs kernel `verifyEntryAgainstAnchor` + `classifyRowState` **client-side** (M3: the chip enum comes from the client recompute, **never** from the receipt's `checks`). On `crypto.subtle` missing / exception / canonicalization mismatch → resolve `unverifiable` (or explicit `server-asserted` if a server verdict is present) — **never** `verified` (L4). `checks`/`verifiedAt` are display-only strings, never fed to the state decision.
  - `ProofPanel` — renders the three assertions (link recompute · per-length anchor equality · chain-vs-current-anchor) each pass/fail; anchor metadata (length, tipHash, retain-until); "copy proof receipt (JSON)". For `anchor-confirmed-original-not-disclosed` the link-recompute row renders **"not applicable — payload redacted,"** never a pass. Fetch the row's anchor on panel open (fork f) — the panel calls the T-A1 endpoint on expand.
  - Reuse ui-pro `PayloadViewer` for the redacted payload display (GATE-4 — introduces an `audit-worm/ui → ui-pro` dep; both commercial, no open-core violation).
- Verify: component tests — verified/anchor-confirmed/tampered/unverifiable render distinctly; `crypto.subtle` stubbed to throw → chip is `unverifiable`/`server-asserted`, never `verified`; redacted → recompute row "not applicable."
- Size: M–L · Lane: sonnet.

**T-U2 · ChainViewer six-state chips + expand-to-ProofPanel + provenance header (audit-worm/ui)**

- Files: `packages/audit-worm/src/ui/chain-viewer.tsx` · tests.
- Change: add a per-row six-state `StatusChip` (reuse **existing** `@caisson/ui` tones — see freeze guard below); expandable row → `ProofPanel`; header gains an anchor-provenance line ("chain anchored at length N in write-once storage · retained until YYYY-MM-DD"); when the sibling Rekor chain-level leg exists, a second **chain-level** provenance line (never per-row — CR-04). Chip copy is provenance-honest and **gated by GATE-1** (see T-F1). A mid-chain break does not poison earlier rows (SPEC Per-row states).
- **Freeze guard:** map the six states to **existing** `@caisson/ui` `StatusChip` tones (positive→verified, neutral/muted→anchor-confirmed, critical→tampered, warning→unverifiable, info→pending, accent→genesis). If a state genuinely needs a new tone, that is a `@caisson/ui` change → **BLOCKED by the freeze**, sequence after Kickoff S or negotiate the tone with that session. Do **not** edit `@caisson/ui` in this wave.
- Verify: `bun test packages/audit-worm/src/ui/chain-viewer.test.tsx` — six states render; no `@caisson/ui` source touched (`git diff --stat` scoped check at EXECUTE).
- Size: M · Lane: sonnet.

**T-U3 · PayloadViewer "N fields redacted" affordance (ui-pro; not frozen)**

- Files: `packages/ui-pro/src/components/payload-viewer.tsx` · `.css` · test.
- Change: count masked fields (from the shared redaction predicate) and show "N fields redacted"; keep the existing distinct redaction styling (`highlightRedaction`-style class already exists). Redacted rows surface the `anchor-confirmed-original-not-disclosed` chip inline, never `verified`.
- Verify: test asserts the count matches the number of masked keys.
- Size: S · Lane: sonnet.

**T-U4 · AuditTimeline anchor-awareness (ui-pro; not frozen) — fixes the anchor-blindness gap**

- Files: `packages/ui-pro/src/components/audit-timeline.tsx` · `packages/ui-pro/src/lib/audit-chain.ts` · tests.
- Change: `AuditTimeline` today runs its own **presentation-side** `verifyChain` (`lib/audit-chain.ts`) that is anchor-blind (truncation + wholesale rewrite render as "verified" — SPEC Current-state). Make it accept optional **per-row statuses as props** (the six-state enum, computed by the caller from real anchors); when provided, badge from them instead of the blind check. **No new dependency** (statuses passed in, not computed here) — keeps the component portable. When statuses are absent, keep the blind check but relabel its badge to "link-only" honesty (never bare "verified").
- Verify: test — with anchor-derived statuses a truncated chain shows `unverifiable`/`tampered`, not `verified`; without statuses the badge reads link-only.
- Size: S–M · Lane: sonnet.

**T-U5 · Wire the admin audit page to the endpoint + per-row proof + pack export (apps/admin; not frozen)**

- Files: `apps/admin/src/app/business/audit/page.tsx` (+ a small client island for the proof panel/fetch) · possibly a route-handler `route.ts` for pack export.
- Change: keep the existing operator "enter target account" flow (P7); render the six-state `ChainViewer`; row expand → `ProofPanel` fetching `GET /api/admin/audit/proof`; add an "export evidence pack" action (→ T-E1). **No admin-app IA change** (SPEC non-goal) — additive to the existing page.
- Verify: dev-run the admin audit page against a seeded chain; row chips + proof panel render; pack downloads.
- Size: M · Lane: sonnet.

### Phase E — Evidence pack + site demo (fork c)

**T-E1 · Evidence-pack builder (open; fork c/d)**

- Files: `packages/kernel/src/evidence/pack.ts` (new) + `./evidence` export · README template · wire into T-U5 export action.
- Change: `buildEvidencePack(receipts[], meta)` → a bundle containing per-entry receipts (T-K2), the standalone verifier (T-K4), and a **README stating the trust claim verbatim**: the six-state model, the **chain-level-only** external-status caveat (CR-04), and the **honest provenance line gated by GATE-1** (H4/binding #4 — if anchors are unsigned, the README claims only internal-consistency + link-hash verification, NOT "independent" tamper-evidence). Pack is deterministic (canonical ordering) so it is itself hashable.
- Verify: `bun test` — pack round-trips through the standalone verifier (T-K4) with correct PASS; a tamper case FAILs; the README string contains no "impossible to tamper" / no unqualified "independently verified" when provenance is server-only.
- Size: M · Lane: sonnet.

**T-E2 · [FROZEN — apps/site; seq after Kickoff S AND after product surfaces] Site demo leg**

- Files: `apps/site/components/audit-worm-demo.tsx` · `apps/site/remotion/AuditWormDemo.tsx` (+ any Living Chain motion glue).
- Change: extend the existing baked-chain demo to show the six per-row states + a sample proof panel; align the motion vocabulary with THIS spec's state enum (Living Chain sequencing note — the motion component stays swap-ready, props typed against the state enum, no motion-side reimplementation of verification logic).
- **Sequencing constraints (hard):** (a) `apps/site` is FROZEN this wave — this task lands only after Kickoff S releases the tree or via explicit coordination with that session; (b) fork c sequences the site-demo leg **after product surfaces** (T-U1..T-U5, T-E1) ship; (c) the **Seal-on-Proof** motion moment is separately gated (SPEC Cross-doc) — it fires on `verified`, which does not exist until this spec ships, and targets `apps/admin` which the motion kickoff excludes; it cannot land until (1) `verified` renders on a motion-kickoff-scoped surface, or (2) the motion kickoff scope is amended to include `apps/admin`, or (3) it is retargeted to the site demo once this leg ships.
- Verify: site e2e (`apps/site/e2e/browser-audit-p1.e2e.test.ts` extended) shows six states; no verification logic duplicated in the motion layer.
- Size: S–M · Lane: sonnet.

### Phase F — Provenance copy, ADRs, changesets

**T-F1 · [GATED on GATE-1] Provenance-honest seal copy across chips/receipts/pack**

- Files: chip copy (T-U1/T-U2), receipt/README strings (T-K2/T-E1).
- Change: apply the copy that matches the locked provenance option. **Option 3 (honest-downgrade):** local seal reads "locally recomputed — consistent with the anchor this server provided" (a self-consistency claim); the strong "verified against write-once anchor" seal is withheld until signed anchors / external anchoring exist. **Option 2 (signed anchors):** local seal reads "verified against write-once anchor (signature-checked)." Never "impossible to tamper" (SPEC copy law). The `anchor-confirmed-original-not-disclosed` chip reads "Anchor confirmed — original not disclosed," never "verified."
- Verify: `grep -r` the surfaces for banned strings ("impossible to tamper"; unqualified "independently verified" when unsigned); assert the copy matches the GATE-1 lock.
- Size: S · Lane: sonnet.

**T-F2 · Lock the PLAN-time forks as ADRs + update the fork board**

- Files: `knowledge/decisions/ADR-0334+…` (append-only; collision-check `main` first, ADR-0088 discipline) · `docs/state/decisions-and-forks.md`.
- Change: record the GATE-1 (anchor provenance), GATE-2 (v1 admin-only endpoint scope; tenant route deferred), and GATE-3/GATE-4 (minor design) locks once the operator sets them. **Do NOT pre-write the ADR content — these are operator locks (see §5).**
- Verify: `bun run sot` green (ADR-ceiling parity, frontmatter, tracker reality).
- Size: S · Lane: sonnet.

**T-F3 · Changesets for touched packages**

- Files: `.changeset/*.md` for `@caisson/kernel`, `@caisson/audit-worm`, `@caisson/ui-pro` (+ any other `packages/*` touched). apps/services are changeset-exempt but still covered by the site/admin coverage gate.
- Change: minor bumps with prose describing the per-row verification surface (the changeset-prose gate scans pending prose).
- Verify: `bunx changeset status --since=origin/main` passes; `bun run sot` changeset preflight green.
- Size: S · Lane: sonnet.

---

## 4. Task ordering / dependency graph

```
GATE-2 (endpoint scope) ─┐            GATE-1 (anchor provenance) ─┐  GATE-1a ─┐
                         │                                       │           │
T-K1 ─► T-K2 ─► T-K4     │            T-F1 (copy) ◄───────────────┘   T-W2 ◄──┘ (only if opt 2)
   └──► T-K3             │
                         ▼
T-K2,T-K3 ─► T-W1 ─► T-A1 ─► T-A2
                         │
T-K2 ─► T-U1 ─► T-U2 ────┤
T-K3 ─► T-U3             │
        T-U4 (indep)     │
T-A1 + T-U2 + T-E1 ─► T-U5
T-K4 + T-K2 ─► T-E1
                         ▼
                 [product surfaces done] ─► T-E2 [FROZEN: after Kickoff S]
                         ▼
                 T-F1 ─► T-F2 ─► T-F3 (close-out)
```

- **Kernel foundation first:** T-K1 → {T-K2, T-K3} → T-K4. Everything downstream imports these.
- **Data path:** T-W1 (needs T-K2 receipt shape) → T-A1 (needs T-W1 + T-K3 redaction) → T-A2.
- **UI:** T-U1 (needs T-K2) → T-U2; T-U3/T-U4 parallel; T-U5 integrates T-A1+T-U2+T-E1.
- **Gate-blocked:** T-W2 runs **only** if GATE-1 = signed anchors; T-F1's exact copy is chosen by GATE-1; GATE-2 confirms only the admin endpoint ships in v1 (tenant route deferred).
- **Frozen:** T-E2 is last and blocked on the Kickoff S freeze release.
- **Close-out:** T-F1 → T-F2 (ADRs) → T-F3 (changesets) → `bun run sot`.

Parallelizable clusters (if run as a worktree wave, ADR-0328): {T-K1,K2,K3,K4} kernel · {T-U3,T-U4} independent ui-pro · then the A/U integration cluster serially. One PR (push-not-merge per wave convention).

---

## 5. Open forks & operator gates

Per the one-operator rule, **no fork below is decided here.** Each carries a recommendation + confidence + evidence and the explicit lock line.

### GATE-1 (PRIMARY / load-bearing) — Anchor trust-root provenance (H2 + H4, binding #2/#4)

The client "local-verify" seal is cryptographic theater if the client obtains **both** `row.hash` and `anchor.tipHash` from the **same** proof-bundle response — a compromised/MITM'd server forges a self-consistent triple and the local check passes without the WORM store ever being consulted. For redacted rows (anchor-equality is the _only_ leg) this collapses to "the server says so." Three sanctioned mitigations (SECURITY-PREPLAN §H2/H4):

- **Option 2 — Signed anchors** _(security pre-pass's recommendation)_: sign anchors at mint; client + offline verifier check the signature against a pinned public key delivered out-of-band. The only option that makes the claim true everywhere (live UI, redacted rows, offline pack) in one move and reuses the P6 Ed25519 machinery. **Cost:** adds T-W2 (append-path signing), a new keypair (GATE-1a), an unsigned-legacy-anchor migration wrinkle, and is itself a `security`/`secrets`-tagged change needing its own SHIP audit.
- **Option 3 — Honest downgrade** _(PLAN author's recommendation)_: ship v1's product surfaces now with a seal that states what it actually proves — "internally consistent with the provided bundle + WORM-read anchor" — and reserve the strong "independently verifiable" claim for a signed-anchor / external-anchoring fast-follow (the natural pairing with the sibling Rekor spec). The pack README claims only internal-consistency + link-hash correctness (binding #4). **Cost:** the "verify without trusting caisson" headline is softened for v1.
- **Option 1 — Independent WORM read**: verifier fetches the anchor object directly from a read-only WORM endpoint (different origin/credential than the row API). **Weak:** no independent root for the _offline_ pack, and on the operator surface the anchor still flows through caisson's own server — limited gain.

**Recommendation: Option 3 for v1 (confidence: med-high).** Evidence: (a) per H1 the v1 endpoint is the **operator** surface — an internal integrity spot-check where the operator inspects their _own_ system; the adversary-server threat H2 names is far more material on the _offline pack_ and the (deferred) _tenant_ surface than on an operator tool; (b) the pack README honestly scopes its v1 claim, so nothing overclaims; (c) signed anchors expands the append path's secret/crypto blast radius (new key material on the WORM-write path) — a security-tagged change that merits its own kickoff rather than a rider on a UI-focused one; (d) Option 3 keeps every product surface shippable now and makes Option 2 a clean additive follow-on (the `sig` field is additive, not a chain-format break). **Note the tension honestly:** the security pre-pass recommends Option 2 as the smallest change that makes the claim _true_; if the operator weights "the demo an auditor evaluates must be genuinely tamper-evident on day one" above scope, Option 2 is the correct lock. This is a trust-story-vs-scope business call, not a technical one — hence an operator gate.
**OPERATOR LOCK REQUIRED before EXECUTE.**

- **GATE-1a (only if GATE-1 = Option 2) — anchor-signing key identity.** Recommendation: a **dedicated anchor-signing keypair**, NOT the license issuer key (confidence: high) — domain separation; do not widen the license key's blast radius onto the WORM-write path. **OPERATOR LOCK REQUIRED before EXECUTE** (if reached).

### GATE-2 — v1 endpoint scope: operator-only vs also a tenant self-service route (H1, binding #1)

`apps/admin` is an operator app (RLS-bypassing `TO admin USING (true)`); the SPEC specs only the admin surface. A tenant/buyer self-service audit view (`apps/site/app/dashboard/*`, strictly session-derived RLS-scoped `accountId`) is a **separate** endpoint the SPEC does not define.
**Recommendation: ship the admin (operator) endpoint only in v1; record the tenant self-service route as an explicit future fork (confidence: high).** Evidence: the buyer dashboard has no audit view today (SECURITY-PREPLAN §H1); CR-07's "never client-supplied accountId" prose applies only to that future tenant route, and conflating the two is the exact IDOR risk H1 flags. The admin endpoint therefore takes the target `accountId` as a validated UUID input (operator cross-tenant inspection is the design), gated by in-handler `requireAdmin` + access-logging.
**OPERATOR LOCK REQUIRED before EXECUTE.**

### GATE-3 (minor / design) — redaction predicate home

**Recommendation: move the pure redaction predicate to `@caisson/kernel/redact`, ui-pro re-exports (confidence: high).** Evidence: `apps/admin` deps kernel but not ui-pro (P14) — kernel keeps the endpoint's server-side redaction dependency-clean and aligns with fork d's open-core split. Alternative (leave in ui-pro, add ui-pro dep to admin) is lazier in LOC but dirtier in dependency direction.
**OPERATOR LOCK REQUIRED before EXECUTE** (low-stakes; a one-line default if the operator defers).

### GATE-4 (minor / design) — ProofPanel component home + audit-worm→ui-pro dep

**Recommendation: ProofPanel + client verify hook in `audit-worm/ui` (the admin-consumed hero surface), reusing ui-pro `PayloadViewer` for redacted display — accepting a new `audit-worm/ui → ui-pro` dependency (confidence: med).** Both are commercial (no open-core violation). Alternative: duplicate a minimal payload view in audit-worm to avoid the dep (more LOC, drift risk). AuditTimeline (T-U4) takes statuses as props to avoid any new dep in the reverse direction.
**OPERATOR LOCK REQUIRED before EXECUTE** (low-stakes default).

---

## 6. Risks & unknowns

- **R1 — Kernel node-taint (P4/P5):** `audit-verify.ts` / `redact.ts` MUST be reachable only via node-free subpaths and never pulled through the `.` barrel into a browser/Next-client bundle. _Mitigation:_ T-K1 extracts canonical to a node-free module; add an import/bundle test asserting `./audit-verify` imports zero `node:` specifiers. A regression here is caught by the site demo (T-E2) failing to bundle.
- **R2 — `crypto.subtle` secure-context requirement (L4):** absent in `file://`-opened pack HTML and non-secure contexts. _Mitigation:_ the standalone verifier (T-K4) carries a `node:crypto` fallback; the live UI hook (T-U1) fails to `unverifiable`/`server-asserted`, never `verified`.
- **R3 — Canonicalize drift** between kernel `canonical.ts` and the inlined verifier (T-K4). _Mitigation:_ golden test pinning the two; `ponytail:` comment names the upgrade path.
- **R4 — `@caisson/ui` freeze:** if the six states need a new `StatusChip` tone the design freeze blocks it. _Mitigation:_ T-U2 maps to existing tones; a genuine new-tone need escalates to Kickoff S, not an edit in this wave.
- **R5 — apps/site freeze:** T-E2 is blocked until Kickoff S releases the tree. _Mitigation:_ T-E2 is last and explicitly sequenced; product surfaces do not depend on it.
- **R6 — Signed-anchor path (if GATE-1 = Option 2)** touches `append` (the money/integrity seam) and introduces key material on the WORM-write path. _Mitigation:_ T-W2 is opus-lane + a dedicated `gw-security-auditor` SHIP pass; additive optional `sig` field avoids a chain-format break.
- **R7 — Access-log write path (M1):** the exact `admin_action_log` read-mode insert helper is not yet pinned. _Mitigation:_ reuse `intel-triage.ts`'s `withAdminWrite` precedent; a small EXECUTE-time detail, not a design unknown.
- **R8 — Seal-on-Proof / Living Chain cross-doc sequencing:** the motion moment fires on a state/surface that doesn't exist until this ships. _Mitigation:_ captured as hard sequencing constraints on T-E2; the motion kickoff owns the resolution (amend scope / retarget).
- **R9 — Rate-limit ergonomics on a Next route handler:** `@caisson/rate-limit` is DB/hook-oriented (`account-hook`). _Mitigation:_ a minimal per-actor token-bucket keyed in the route; operator surface is low-cardinality so an in-memory bucket is adequate (`ponytail:` note the ceiling — swap to the account-store limiter if a tenant route ever ships).

---

## 7. Goal-backward verification plan (Act 4)

VERIFY re-asks the SPEC Goal — _can an auditor point at any single row and see why it's trustworthy, and does an exported pack carry the same per-entry verifiability?_ — against the merged diff, not the task checklist:

1. **Per-row status renders** — on the admin audit page each row shows one of the **six** states; clicking opens a proof panel with the three assertions each pass/fail + anchor metadata + copyable receipt. _Command:_ dev-run admin audit page over a seeded chain; inspect a healthy row, a tampered row (mutate one payload), a redacted row.
2. **Redaction honesty** — the redacted row shows `anchor-confirmed-original-not-disclosed`, the recompute leg reads "not applicable — payload redacted," and the response body + receipt contain **none** of the original masked values. _Command:_ `bun test` T-A2 case 3 + T-U1 redacted case.
3. **Endpoint auth contract** — operator-route non-allowlisted denial, missing-anchor fail-closed (200 `unverifiable`), seq out-of-range 400, server-side key construction, `.strict()` both ways. _Command:_ `bun test apps/admin/.../proof/route.test.ts` (T-A2).
4. **Receipt hardening (CR-06)** — receipt carries versioned raw material; the standalone verifier recomputes both legs from raw material and ignores `checks`/`verifiedAt`; live chip state comes from the client recompute (M3), never the receipt. _Command:_ `bun test` T-K2 + T-K4; grep T-U1 for any path feeding `checks` into the state decision (must be none).
5. **Pack verifiability (fork c/d)** — the exported pack's standalone verifier re-verifies without any `@caisson/*` import and its claim matches the locked provenance (GATE-1). _Command:_ run the verifier over a built pack (T-E1); confirm PASS on healthy, FAIL on tampered, NA on redacted; grep the README for banned overclaim strings.
6. **Six-state completeness** — no five-state remnant anywhere. _Command:_ `grep -rn` the touched surfaces for the old state set.
7. **External framing (CR-04)** — external status appears only at chain/checkpoint level; any per-row "externally anchored" badge is derived from the chain-level receipt, never a per-row external inclusion proof.
8. **SPEC's own Verification obligations** — cross-tenant/operator denial + missing-anchor fail-closed tests exist and pass (SPEC §Proof-bundle endpoint); provenance seal never rendered off an unauthenticated same-API anchor (binding #2).

Partial → enumerate gaps + queue follow-ups (e.g. tenant route, signed anchors if Option 3). Fail → new PLAN cycle, do not SHIP.

---

## 8. Out-of-scope confirmations (SPEC non-goals restated as guards)

- **G1** — No external per-row anchoring beyond chain-level status (sibling Rekor spec owns it). External status stays chain/checkpoint level; the per-row "externally anchored" badge is derived, never a compact per-row external proof (CR-04).
- **G2** — No full Merkle-tree chain rewrite. Per-length anchors are reused as-is. If GATE-1 = Option 2, the anchor `sig` field is **additive/optional** — explicitly NOT a chain-format break, and distinct from the scoped Merkle _commitment_ recorded as a future fork.
- **G3** — No retroactive redaction semantics.
- **G4** — No server API redesign beyond the one proof-bundle endpoint (whose auth contract is specified). No new tenant route in v1 (GATE-2 defers it).
- **G5** — No admin-app IA changes (T-U5 is additive to the existing page).
- **G6** — No `@caisson/ui` modification (freeze) and no `apps/site` changes except the sequenced, coordinated T-E2 after Kickoff S.
- **G7** — No `crypto.timingSafeEqual` on hash/tipHash/prevHash equality — these are public integrity tags, not secrets (kernel `audit-chain.ts:16-19`; SECURITY-PREPLAN §Clarification). `timingSafeEqual` stays mandatory only for actual secrets in adjacent code; the sole new secret-comparison surface this feature could add is Ed25519 anchor-signature verification (GATE-1 Option 2), which uses `crypto.verify` (constant-time by construction), never a hand-rolled compare.
- **G8** — Engineering invariants bind every task: TypeScript strict, Bun-only, Zod `.strict()` at the endpoint boundary both directions, `fetchWithTimeout` on any outbound fetch, integer money units (none introduced here), append-only versions, one standards gate (`tooling/`), open-core no-depend-up (kernel Apache-2.0 never deps a commercial package — the new kernel modules import only kernel-internal node-free code).
