# SECURITY — Wave 0: shared substrate (adversarial audit + resolutions)

Act 7 (SHIP) conditional audit — tags `security` · `secrets` · `external-system`. A 13-agent
adversarial workflow: 2 code-review dimensions (correctness, discipline) + 11 threat-model skeptics
(TM1–TM11), each prompted to **refute** its mitigation claim against the real code (run + read, not
inspection). Verdict `holds:false` = the asserted guarantee does NOT hold as worded.

**Outcome:** 11 threats checked, **3 refuted** (TM2, TM6, TM8 — all medium, none high), 8 held. 5
review findings (1 medium, 2 low, 2 nit). Every confirmed item is resolved below; nothing blocks the
PR. No live cloud call runs in CI; no secret is logged or egressed; no service was touched.

## Threats held (8) — mitigations real

| ID   | Claim                                                                  | Verdict |
| ---- | ---------------------------------------------------------------------- | ------- |
| TM1  | Per-tenant HKDF keys are cryptographically distinct (info-injective)   | holds   |
| TM3  | Fresh CSPRNG 96-bit nonce per encrypt; no plaintext linkage / reuse    | holds   |
| TM4  | `MASTER_FIELD_KEY` read once, true-private `#field`, never logged      | holds   |
| TM5  | Generator allowlist-gates id+version BEFORE any path/subprocess        | holds   |
| TM7  | Codegen debit precedes write; 402 writes nothing; retry debits once    | holds   |
| TM9  | KMS seam makes no CI cloud call; wrapped-DEK envelope real; transient  | holds   |
| TM10 | Envelope parser throws on unknown ver/alg + malformed; no half-parse   | holds   |
| TM11 | Encryption boundary == RLS boundary; column fail-closed; non-superuser | holds   |

## Threats refuted (3) + resolution

### TM2 — AAD does not bind a row (medium) → **claim corrected**

The AAD binds `tenant∥key_version∥column` (`buildAad`) — **no row identity**. Cross-tenant
(per-tenant key + AAD) and cross-column (AAD) relocation are genuinely blocked, but two rows of the
same tenant+column+key_version share a byte-identical AAD, so an attacker with storage-write access
could swap/replay one cell's ciphertext into another row. The code comment over-claimed a cross-row
defense.

- **Fixed now:** `aad.ts` comment scoped honestly (binds tenant + column + key_version; **does NOT**
  prevent cross-row relocation). No false guarantee remains asserted in code.
- **Deferred (operator fork):** real row binding needs `encryptField(…, rowId)` at an explicit call
  site (the transparent Drizzle `customType` seam never sees the PK). Added to the decisions board
  Open table for the Compliance edition — not auto-decided.

### TM6 — index gate detects but does not prevent (medium) → **scoped honestly; operator action queued**

The byte-identical rebuild (`bun registry/scripts/build-index.ts && git diff --exit-code`) genuinely
**detects** a hand-edited `index.json` — empirically a tampered `latest` makes the diff non-zero, and
`build-index.ts` is the sole writer. But CODEOWNERS rides the `@stack-owner` placeholder and branch
protection is off, so a direct push to `main` or a merged red PR is an ungated write path — the check
just goes red, it does not block.

- **Fixed now:** `build-index.ts` header + the CI job comment corrected to say DETECT (not prevent)
  until enforcement is wired.
- **Deferred (operator action):** real CODEOWNERS handle + branch protection + required checks —
  added to the decisions board Open table (operator-owned GitHub settings; also SWEEP follow-up 3).

### TM8 — audit chain misses tail-truncation + wholesale rewrite (medium) → **anchored verify added**

`verifyChain` checked only INTERNAL self-consistency (seq, prevHash linkage, hash recompute) with no
trusted anchor. Demonstrated against the real module: `verifyChain(chain.slice(0,-1))` →
`{valid:true}` (tail truncation undetected) and a freshly rebuilt forged chain → `{valid:true}`
(wholesale rewrite undetected). The drop test only covered a MIDDLE drop.

- **Fixed now (kernel):** added `AuditChainAnchor` (`{length, tipHash, genesisHash?}`) + `anchorChain`
  (mint it after each append) + an optional `anchor` parameter to `verifyChain` that asserts the
  committed length, tip hash, and genesis after the consistency pass. Tail-truncation, wholesale
  rewrite, and re-rooting now fail when an anchor is supplied. Docstring rewritten to state the limit
  explicitly. Regression tests added: tail-drop passes unanchored (documented), fails anchored;
  forged rebuild fails anchored; genesis mismatch fails; `anchorChain([])` throws.
- **Deferred (P2):** wiring a WORM/append-only tip-store consumer that persists the anchor — the
  Compliance edition's job; the primitive is now in place.

## Review findings + resolution

| Sev    | File                              | Finding                                                                         | Resolution                                                                                                                                                           |
| ------ | --------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| medium | `registry/worker/handler.ts`      | `decodeURIComponent` outside try → `URIError` 500 on malformed `%`              | **Fixed** — moved inside the guard; returns 404. Regression test added.                                                                                              |
| low    | `registry/scripts/build-index.ts` | `compareSemver` truncated multi-seg prerelease + leaked build meta              | **Fixed** — split on first hyphen, strip `+build`. Regression test added.                                                                                            |
| low    | `packages/field-crypto/src/*`     | Plain `Error` ×23; declared `@caisson/kernel` dep never imported (phantom edge) | **Fixed** — adopted kernel typed errors (`ValidationError`/`ConfigError`/`NotFoundError`/`InternalError`); the dependency edge is now real (depcruise: 147 modules). |
| nit    | `packages/cli/src/generate.ts`    | Duplicate module id → inconsistent package.json/README                          | **Fixed** — `.refine` uniqueness on `Selection`. Regression test added.                                                                                              |
| nit    | `registry/worker/handler.ts`      | JSON responses omit `X-Frame-Options`/HSTS                                      | **Deferred** — un-deployed seam (ADR-0047); header floor applies at P5/P6 deploy (SWEEP).                                                                            |

## Exit gate

`bun run check` green (53/53 + standards-gate 0 err) · `eslint .` clean · depcruise 0 violations ·
`registry/index.json` byte-identical rebuild · format clean · 104 package tests pass. No DEPLOY.
