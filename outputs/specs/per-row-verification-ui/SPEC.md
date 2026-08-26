# SPEC — Per-row tamperproof verification UI (audit surfaces)

- **Status:** SHIPPED — proof primitives and endpoint in PR #240 (forks locked → ADR-0331, PLAN locks ADR-0344); the residual admin page wiring, provenance, redacted export/count and tenant self-service integration landed under ADR-0379 as T5B/T5C/T5E in PR #335 (T5 recorded **complete** in `docs/state/outstanding-work.md`). Status line corrected 2026-08-26 — it had stayed PARTIAL after the work merged.
- **Tags:** `frontend` `ui` `security` (security tag fires the SHIP audit; this amendment adds a dedicated `gw-security-auditor` pass before PLAN per the adversarial review's own recommendation)
- **Repo:** caisson · **Packages touched:** `kernel` (pure check helpers) · `audit-worm` (+ its `src/ui`) · `ui-pro` (audit-timeline, payload-viewer) · `apps/admin` (proof-bundle endpoint + consuming UI) · evidence-pack format
- **Prior art:** Pangea `react-mui-audit-log-viewer` (`verificationOptions.onFetchRoot` → client-side per-row `membership_proof` checks against a published root; `fpeOptions.highlightRedaction` for redaction display)
- **Sibling spec:** `SPEC-rekor-anchoring.md` — external anchoring. Interface between them: this spec's **chain-level** proof receipt gains one more leg ("root externally anchored") when that ships — the leg attaches at chain level, not per-row (see "External (Rekor-level) status framing" below; per CR-04, a hash chain has no compact per-row external proof). Nothing here blocks on it; sequencing per FORK-LOCKS ✅ re-lock ("Grade-split + Rekor v1.1").

## Amendment record (2026-07-13)

Post-audit adversarial round (18-lane red-team + Codex `gpt-5.6-sol` cross-vendor review, `codex-adversarial-review.md`) verdicted this SPEC **rethink** and contested three locks plus one smuggled-scope note (`AUDIT-SYNTHESIS.md` §B, "Per-row verification"). The operator re-locked all four in the same sitting (`FORK-LOCKS.md` ✅ RE-LOCKS, "Per-row + attest — Accept all four amendments"). This revision folds them in; nothing else in the prior DRAFT changed in substance. Locks recorded as ADR-0331.

1. **New state `anchor-confirmed-original-not-disclosed` + hardened receipts** (codex CR-06) — redacted rows can pass the per-length anchor check but can never recompute the hash client-side from a redacted payload, so the locked "verified locally" claim was impossible as specified for them. The state model grows a sixth entry; the local-verification seal is never rendered for it. Receipts additionally now carry versioned raw proof material rather than trusted verdicts (`checks`/`verifiedAt` are explicitly derived/untrusted display fields).
2. **"Verified locally" provenance distinction made deliberate v1 scope, not deferred** (`AUDIT-SYNTHESIS.md` §B: "Lock b's note smuggled deferred b3 scope … make deliberate or drop") — the prior DRAFT's fork (b) recommendation footnoted a "do later if buyers ask" client-verified/server-asserted distinction while the state and receipt model already depended on it. It is now explicit v1 scope: chips and receipts state which one they are.
3. **Proof-bundle endpoint authorization contract specified** (codex CR-07) — the prior DRAFT named the endpoint as in-scope (it's in the header's Packages touched and the Non-goals boundary) but specified no auth boundary. `accountId` is now session-derived only, `seq` is a strict bounded sequence, WORM keys are constructed server-side, responses are Zod-strict, and cross-tenant-denial + missing-anchor-fail-closed tests are required before ship — per `identity/security.md`'s route-level auth floor.
4. **External (Rekor-level) per-row proof descoped to chain-level v1** (codex CR-04) — a hash chain has no compact per-row inclusion proof against a later external checkpoint; v1 renders external status at chain/checkpoint level only, with a stated replay caveat. A Merkle commitment for compact per-row external proofs, and budgeted prefix replay, are both recorded as explicit future forks rather than built now.

## Goal

Upgrade caisson's audit surfaces from a **chain-level verdict** (ChainViewer's single MetricStat) and **anchor-blind link badges** (AuditTimeline's presentation-side check) to **per-row, anchor-aware verification status with clickable proof detail** — so an auditor can point at any single row and see _why_ it's trustworthy, and an exported evidence pack carries the same per-entry verifiability. This is the hero-screen differentiator buyers evaluate; it turns audit-worm's existing cryptographic machinery into visible product.

## Why now / the found leverage

The grounding pass found the expensive part is **already built**: `AuditChainStore.append` mints a **write-once WORM anchor at every chain length** (`{account}/audit-chain/anchors/<len>.json`, `chain-store.ts:86-94,230-247`). Row `seq = i` was the tip of the chain at length `i+1`, so **`anchor(i+1).tipHash === row.hash` is a genuine per-row commitment check** — no Merkle tree, no schema change, no new writes. The per-length anchors ARE the per-row proofs; nothing renders them today.

## Current state (verified in code)

| Surface                                             | What it shows today                                                                                      | Gap                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `kernel/audit-chain.ts`                             | `verifyChain(entries, anchor?)` → `{valid, brokenAt}`; documented LIMIT: consistency-only without anchor | no per-row helper                                                            |
| `audit-worm/chain-store.ts`                         | `verify()` = full chain vs current anchor + truncation guard (length oracle)                             | chain-level verdict only                                                     |
| `audit-worm/src/ui/chain-viewer.tsx` (ADR-0250)     | headline Verified/Broken stat + `brokenAt` chip in a DataTable                                           | no per-row status, no proof detail                                           |
| `ui-pro audit-timeline.tsx`                         | per-link badges (genesis/verified/broken) from its own presentation-side `lib/audit-chain`               | **anchor-blind** — truncation + wholesale rewrite render as fully "verified" |
| `ui-pro payload-viewer.tsx`                         | redaction masking exists (`DEFAULT_REDACT_KEYS`, `REDACTED`, redacted raw view)                          | no redaction-count affordance; redaction↔hash tension undocumented           |
| `apps/admin business/audit`, site `audit-worm-demo` | consume ChainViewer                                                                                      | inherit chain-level-only verdict                                             |

## The trust claim — stated precisely (chip copy must not overclaim)

- **Level 1 (exists):** "this row links correctly to its neighbors" — internal consistency. Blind to tail-truncation and wholesale rewrite (kernel header documents this).
- **Level 2 (THIS SPEC):** "this row's `(prevHash, payload)` recomputes to its stored hash, **and** that hash equals the tip committed in the write-once WORM anchor minted when it was appended; the full chain also matches the current anchor (length + tip + genesis)." Trust root = the WORM store's write-once property (S3 Object Lock / GCS retention / R2 lock). **Not proven:** that the store wasn't compromised before first write; wall-clock accuracy of timestamps; anything about redacted-away content beyond its hash. **Redacted rows can only satisfy the anchor-equality half** — the recompute half requires the original payload the client never receives; see Per-row states (`anchor-confirmed-original-not-disclosed`).
- **Level 3 (sibling spec):** "the anchor set is externally anchored — retroactive rewriting is detectable by outside parties." As of this amendment, rendered at **chain/checkpoint level only** (CR-04) — see "External (Rekor-level) status framing" below.

UI copy: "Verified against write-once anchor" — never "impossible to tamper." For the redaction state: "Anchor confirmed — original not disclosed" — never "verified."

## Per-row states

Six states. `verified` (link recompute ✓ + per-length anchor ✓ — requires the client to hold the original payload; never assigned to a redacted row) · **`anchor-confirmed-original-not-disclosed`** (per-length anchor check confirms the stored hash, but the client cannot recompute that hash from a redacted payload — the local-verification seal is NEVER rendered for this state; CR-06) · `tampered` (either check ✗ — the proof panel names WHICH) · `unverifiable` (anchor unreadable / store unreachable — fail-closed display, never fake-verified) · `pending` (check running) · `genesis` (root chip, same checks apply, subject to the same redaction split as any other row). A mid-chain break does **not** poison earlier rows: rows before `brokenAt` that pass their own per-length anchor check stay `verified` (or `anchor-confirmed-original-not-disclosed` if redacted) — per-length anchors localize tamper, which is exactly their value.

Every UI surface, receipt shape, and copy string that names the five-state model in this document has been updated to the six-state model; there is no remaining reference to the old set.

## Buyer story

Auditor opens the admin audit page → every row carries a shield/alert chip → clicks row #412 → proof panel: recomputed link hash, prevHash binding, the anchor commitment (length, tipHash, WORM key, retain-until), "copy proof receipt (JSON)" → exports the evidence pack → the pack embeds the same receipts + a standalone verifier so a third party re-verifies without trusting caisson's UI. The Seal-on-Proof motion moment (design kickoff) fires on `verified` render — **sequencing gate:** see "Cross-doc sequencing notes" below; that moment currently targets `apps/admin` (which the motion kickoff's scope excludes) and a state that does not exist in the product until this spec ships.

## UX sketch

- **Rows** (ChainViewer + AuditTimeline): StatusChip per state above (now six); `data-status` attr already exists on timeline items — extend, don't rebuild.
- **Proof panel** (click/expand): the three assertions with pass/fail each — link recompute · per-length anchor equality · chain-vs-current-anchor — plus anchor metadata and a copyable JSON receipt `{seq, hash, prevHash, anchor: {length, tipHash, key}, raw: {...}, checks: {...}, verifiedAt}`. For `anchor-confirmed-original-not-disclosed` rows the link-recompute assertion renders as "not applicable — payload redacted," never as a pass.
- **Header**: keep the MetricStat; add anchor provenance line ("chain anchored at length N in write-once storage · retained until YYYY-MM-DD"); when the chain-level external leg from the sibling spec exists, add a second provenance line at chain level only (never per-row).
- **PayloadViewer**: `highlightRedaction`-style distinct styling (class exists) + "N fields redacted" count; redacted rows render the `anchor-confirmed-original-not-disclosed` chip inline, never the `verified` chip; proof panel notes the redaction↔hash rule (below).
- **Evidence pack** (fork c): per-entry receipts + verifier script + site demo; pack README states the trust claim verbatim, including the six-state model and the chain-level (not per-row) external-status caveat.
- **Verified-locally vs server-asserted (deliberate v1 scope, amendment #2):** every chip and receipt states which mode produced it — "verified locally" (the client re-ran the pure kernel checks against the fetched proof bundle) or "server-asserted" (the server ran the check and the client displays the verdict, e.g. before the WebCrypto path loads, or on a surface that intentionally stays server-side per fork b). The two are visually and textually distinct; neither is silently upgraded to the other.

## Failure / edge states

- **Broken chain:** rows ≥ `brokenAt` flagged; earlier anchor-passing rows stay verified (or anchor-confirmed-original-not-disclosed); banner states first-divergence index (kernel already reports it).
- **Store unreachable / anchor missing:** `unverifiable` + reason; never downgrade silently to link-only "verified."
- **Poisoned length** (chain-store's documented KNOWN BOUND — an anchor put that outlived a rollback): surfaces as anchor-mismatch at one length → `unverifiable` with the known-bound explanation, matching the store's fail-closed direction.
- **Redaction vs verifiability (must be explicit):** the hash commits to the ORIGINAL payload; a redacted view cannot recompute it. Receipts for redacted entries mark "hash over original content; recomputable only with unredacted payload" and the row's state is `anchor-confirmed-original-not-disclosed`, never `verified` (fork e, extended by amendment #1 / CR-06).

## Non-goals

External per-row anchoring beyond chain-level status (sibling spec's remaining scope) · full Merkle-tree chain rewrite (per-length anchors already commit every prefix — rejected on found leverage; distinct from the scoped Merkle _commitment_ recorded as an explicit future fork for compact per-row external proofs, see below) · retroactive redaction semantics · server API redesign beyond the proof-bundle endpoint (whose auth contract is now specified below) · admin-app IA changes.

## Implementation note (named, not designed)

`kernel`'s `hashChainLink` uses `node:crypto` `createHash` — **browser re-verification needs a WebCrypto path** (`crypto.subtle.digest` is async → new async helper, not a signature change to the sync one) or verification stays server-side (fork b, now locked to client-side with the deliberate verified-locally/server-asserted distinction — see UX sketch). No new dependency for the server path.

## Proof-bundle endpoint — authorization contract (2026-07-13 amendment, CR-07)

Fork (b)'s client-side re-verification requires a server endpoint that reads tenant-scoped WORM anchors — new attack surface the prior DRAFT named but never bounded. Binding per `identity/security.md` (route-level Bearer/session auth is never optional, and unknown-field rejection is mandatory at every API boundary):

- `accountId` is derived EXCLUSIVELY from the authenticated session — never accepted as a client-supplied field, query param, or body field. The request schema has no such field to begin with (`z.object({...}).strict()` with no `accountId` key).
- `seq` is accepted only as a strict bounded row sequence (non-negative integer, `<= current chain length` for the caller's own account) — never as a raw string, never as a path fragment that reaches key construction directly.
- The WORM anchor key (`{account}/audit-chain/anchors/<len>.json`) is constructed SERVER-SIDE from the session-derived `accountId` and the validated `seq` — the client never supplies or influences a WORM key (`assertSafeKey` discipline: reject before construction, never sanitize after).
- The response body is Zod `.strict()` — unknown fields rejected on the way out as well as in.
- **Required tests before ship:** cross-tenant denial (account A's session cannot fetch account B's proof bundle for any `seq`, including guessed/adjacent ones) and missing-anchor fail-closed (a `seq` with no corresponding anchor returns `unverifiable`, never a 200 with fabricated or partial content).

## Proof receipt hardening (2026-07-13 amendment, CR-06)

The receipt JSON is not itself proof — it is a display convenience the standalone verifier must not trust blindly:

- Receipts carry **versioned raw proof material** (the actual hash-chain link fields and anchor fields needed to recompute), not just precomputed verdicts.
- `checks` and `verifiedAt` are explicitly **derived/untrusted display fields** — they describe what the _issuing_ run computed, not a claim the verifier is entitled to accept as-is.
- The standalone verifier (fork d — open in kernel) recomputes every assertion it can from the raw material (link hash, anchor-tip equality) and never trusts the embedded `checks` block. For `anchor-confirmed-original-not-disclosed` rows, the verifier checks the anchor-equality leg only and reports the hash-recompute leg as "not applicable — payload redacted," matching the UI's honest-marking rule (fork e).

## External (Rekor-level) status framing (2026-07-13 amendment, CR-04)

A SHA-256 hash chain has no compact per-row inclusion proof against a LATER externally-anchored checkpoint: proving row `s` belongs under tip `L` (`L > s`) requires replaying every intervening entry. Fetching only `anchor(s+1)` proves the row against the buyer's own WORM domain — it does not prove it against an external checkpoint minted later. v1 does **not** claim per-row external anchoring:

- **External status renders at chain/checkpoint level only.** A chain-level receipt states "this chain's tip at length N is anchored externally at checkpoint C, retrieved <date>," with the replay caveat spelled out in the receipt text: "verifying an individual row against this checkpoint requires replaying entries `s+1..N`; this receipt does not include that replay."
- The per-row chip may show an "externally anchored" badge derived from the chain-level receipt (the row is provably part of a chain whose CURRENT tip is externally anchored) — it never claims a compact per-row external inclusion proof.
- **Two options are recorded, not built:** (1) a Merkle commitment (deployment-wide or per-window) for compact per-row external inclusion proofs — a WRITTEN explicit future fork, additive to the existing per-length anchors rather than a chain-format break; (2) budgeted prefix/range replay (verify a bounded window of intervening entries on demand) — cheaper to build, O(window) cost per check. Neither ships in this spec.
- **Sibling-spec interface, updated:** `SPEC-rekor-anchoring.md`'s "root externally anchored" leg attaches to THIS spec's chain-level receipt, not to any per-row proof. Nothing here blocks on that spec's sequencing (FORK-LOCKS ✅ re-lock: "Grade-split + Rekor v1.1").

## Forks (LOCKED — ADR-0331)

**(a) Verification claim level — LOCKED: per-row anchor-aware via existing per-length anchors.** Zero schema change; per-length anchors already commit every prefix. Rejected: link-badges-only (leaves the timeline's truncation blindness in place); Merkle upgrade (chain-format break, invalidates every stored hash — unwarranted absent a buyer demand for standard CT proofs); defer everything to the Rekor spec (conflates two claims; external anchoring strengthens, doesn't replace, per-row checks).

**(b) Where verification runs — LOCKED: server ships proof bundle (rows + anchors), client re-runs pure kernel checks locally** (the Pangea pattern; WebCrypto async hash helper). **The "verified locally" vs server-asserted distinction is now deliberate v1 scope** (amendment #2 — previously a deferred footnote, un-smuggled per the FORK-LOCKS ✅ re-lock): chips and receipts state which one produced the verdict. Rejected: server-verifies-client-displays-only (simplest, but trust = caisson's server — the weakest story to sell).

**(c) Scope — LOCKED: UI + evidence-pack receipts + standalone verifier script + site demo** (bias upgrade). The evidence pack is what auditors actually take away — the sellable differentiator. The site demo ties into the Living Chain motion moment and is **sequenced after product surfaces** (see Cross-doc sequencing notes). Rejected: product-UI-only (loses the pack differentiator).

**(d) Which tier carries it — LOCKED: pure check helpers (`verifyEntryAgainstAnchor`, receipt builder) open in Apache-2.0 `kernel`; UI in commercial `ui-pro`/`audit-worm/ui`** (ADR-0094 open-core split; buyers/third parties can independently verify with open code — that IS the trust story — while the polished surfaces stay paid). Rejected: everything commercial (weakens "verify without trusting us"); everything open (erodes ui-pro differentiation for no trust gain beyond option d-1).

**(e) Redaction vs verifiability — LOCKED: honest marking, extended by the new `anchor-confirmed-original-not-disclosed` state** (amendment #1 / CR-06). Receipts for redacted entries mark "hash over original; not client-recomputable"; the row is never assigned `verified`. Rejected: dual-hash (chain-format change — revisit only if auditors reject honest marking in practice); FPE-style structure-preserving redaction (heavy crypto surface, not warranted by any current buyer signal).

**(f) Anchor fetch cost — LOCKED: fetch the row's anchor on proof-panel open; chain-level verdict uses only the current anchor.** One WORM GET per inspected row, zero cost for passive viewing. Rejected: prefetch all anchors per page (N WORM reads per render — revisit only if proof-panel latency proves annoying).

## Cross-doc sequencing notes (2026-07-13 amendment)

- **Living Chain motion moment** (design-motion kickoff, feeds the site demo in fork c): must consume THIS spec's per-row state vocabulary (the six states above) — or the motion component stays swap-ready (props typed against the state enum, no motion-side reimplementation of verification logic) — so the eventual site-demo integration (sequenced after product surfaces per fork c) doesn't fork the vocabulary.
- **Seal-on-Proof motion moment** (design-motion kickoff): fires on the `verified` state, which does not exist in the product until THIS spec ships, and is specced against `apps/admin`, which the motion kickoff's scope currently excludes. **Sequencing gate:** the Seal-on-Proof moment cannot land before either (1) this spec ships `verified` rendering on a surface the motion kickoff is actually scoped to touch, or (2) the motion kickoff's scope is amended to include `apps/admin`, or (3) the moment is retargeted to a surface it already covers (e.g. the site demo, once fork c's site-demo leg ships).
