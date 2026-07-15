# SECURITY-PREPLAN — Per-row tamperproof verification UI

**Pass:** dedicated pre-PLAN `gw-security-auditor` review mandated by `outputs/specs/per-row-verification-ui/SPEC.md` (amendment #3 / CR-07).
**Date:** 2026-07-13 · **Reviewer lane:** fable (money/license/crypto seam).
**Scope reviewed:** CR-07 proof-bundle endpoint authorization contract · the six-state model · CR-06 receipt hardening · the WebCrypto client-verification path.
**Reference floor:** `gridwork-core/identity/security.md`.
**Code read for ground truth:** `kernel/src/audit-chain.ts`, `audit-worm/src/chain-store.ts`, `audit-worm/src/store.ts` (`assertSafeKey`/`buildArtifactKey`), `apps/admin/src/lib/admin-route.ts` + `proxy.ts` + `admin-session.ts` (auth), `apps/admin/src/app/business/audit/page.tsx` (current audit surface), `apps/site/app/dashboard/*` (buyer session surface), `packages/mcp-server/src/{http,server}.ts` (existing per-request auth + timing-safe entitlement pattern).

**Verdict:** the SPEC's crypto machinery is sound and the CR-07 key-construction discipline is correct as far as it goes, but **the auth contract is written for the wrong consumer**, and **two claim-integrity gaps (independent trust root, server-side redaction) can make "verified locally" untrue in exactly the demo an auditor evaluates.** Do not enter PLAN without folding in the HIGH items below.

---

## Findings (severity-ranked; exploit path + required mitigation)

### H1 — CR-07's "session-derived accountId, never client-supplied" is architecturally impossible for the `apps/admin` endpoint it is written for (operator↔tenant conflation)

**What the SPEC says:** "`accountId` is derived EXCLUSIVELY from the authenticated session — never accepted as a client-supplied field, query param, or body field. The request schema has no such field to begin with." Endpoint location: header "Packages touched → `apps/admin` (proof-bundle endpoint + consuming UI)"; buyer story: "Auditor opens the **admin** audit page."

**Ground truth in code:** `apps/admin` is an **operator** app, not a tenant app. `proxy.ts` + `requireAdmin` gate on a GitHub-numeric-id **allowlist** (ADR-0283); the DB role is `TO admin USING (true)` — it **bypasses RLS and sees every tenant's rows** (`admin-read.ts`). The existing audit surface (`business/audit/page.tsx`) reads the target account from **`searchParams.account`** — the operator _types the tenant account id in_, then the server calls `wormAnchorAccount(targetAccountId)` and `deps.worm.load/verify`. Cross-tenant inspection **by a client-supplied account id is the entire purpose** of that page.

An admin session resolves to the **operator's** identity (`actor.email`), which has **no tenant `account_id` to derive**. So CR-07 as literally written yields one of two broken outcomes:

1. If you truly forbid a client-supplied account id, the admin endpoint **cannot address any tenant chain** — the feature does not function.
2. If you smuggle the target account back in some other way to make it work, you have re-introduced a client-supplied account id under a different name, and the "cross-tenant denial" test the SPEC mandates becomes self-contradictory (cross-tenant access is the _designed_ behavior for an operator).

Meanwhile the model CR-07 actually describes — accountId strictly session-derived, RLS-scoped — is the correct contract for the **buyer/tenant** surface (`apps/site/app/dashboard/*`, better-auth session), which the SPEC does **not** spec an endpoint for.

**Exploit / failure path:** without disambiguation the PLAN will implement one endpoint against a contradictory contract. The realistic failure is that the "session-derived only" language is quietly dropped to make admin work, the target account becomes a plain body/query field, and — because no one wrote the operator-scoped gate deliberately — the endpoint ends up **reachable by any authenticated better-auth session on whatever app it lands in, addressing any tenant by id** (a horizontal cross-tenant IDOR). This is the exact class the SPEC's own "cross-tenant denial" test is meant to stop, defeated by the ambiguity in the contract it is testing.

**Required mitigation (binding):** split the contract by consumer class before PLAN:

- **Operator surface (`apps/admin`):** the target `accountId` **is** an explicit, validated input (UUID, `z.string().uuid()`), because operator cross-tenant inspection is the design. The gate is **`requireAdmin` at the route level** (re-run the better-auth+allowlist check _in the handler_, never trust the proxy header — `admin-route.ts` already establishes this pattern), **plus** access-logging (see M1). "Session-derived" here means _operator-authenticated_, not _tenant-scoped_.
- **Tenant surface (if/when the buyer dashboard grows a real audit view):** a **separate** endpoint on the tenant app where `accountId` is strictly session-derived from the better-auth session and every DB/WORM read is RLS-scoped to that account. CR-07's original language applies **only here**.
- The SPEC must name which endpoint(s) v1 actually ships. If v1 is admin-only, say so and mark the tenant endpoint as an explicit future fork; do not ship the tenant-model prose against the operator endpoint.

---

### H2 — "Verified locally" is cryptographic theater unless the anchor is obtained from a trust root independent of the row-serving API

**What the SPEC claims:** trust root = "the WORM store's write-once property"; the client "re-ran the pure kernel checks against the fetched proof bundle" and earns a **local-verification seal**. Fork (b): "**server ships proof bundle (rows + anchors)**, client re-runs pure kernel checks locally."

**The gap:** if the client obtains **both** `row.hash` **and** `anchor.tipHash` from the **same** proof-bundle response, then the client's "anchor-tip equality" check compares two numbers the same server just handed it. A compromised or buggy server (or anyone who can MITM/replace that one JSON response) forges a fully self-consistent `(payload, hash, anchor)` triple, and the client's local verification **passes** — while the WORM store's write-once guarantee was never consulted. The write-once property only produces tamper-evidence when the verifier reads the anchor from a source the tamperer **cannot** rewrite: the WORM object directly, or a published/signed checkpoint. The Pangea prior art the SPEC cites gets this right — `verificationOptions.onFetchRoot` fetches the **published root** independently; the per-row `membership_proof` is checked _against that independently-fetched root_, not against a root embedded in the same row payload.

**Total collapse for redacted rows:** for `anchor-confirmed-original-not-disclosed` the client cannot recompute the hash from payload, so the anchor-equality leg is the **only** check. If the anchor comes from the same API, that state provides **zero** tamper-evidence over "the server says so" — yet the SPEC assigns it a distinct trustworthy-sounding chip ("Anchor confirmed").

**Exploit path:** operator/attacker with write access to the proof-bundle endpoint's code path (or the DB feeding it) serves a rewritten chain plus a matching forged anchor in the same response. Every row renders "verified locally" with a green seal. The buyer's auditor — the exact persona this hero screen targets — is shown a cryptographic pass over forged data. The feature's headline claim is false in the one scenario it exists to defend against (a caisson insider rewriting the log).

**Required mitigation (binding):** specify the anchor's provenance explicitly. Pick one and write it into the SPEC:

1. **Independent WORM read** — the verifier fetches the anchor object directly from the WORM store / a dedicated read-only anchor endpoint that serves the object body verbatim (ideally a different origin/credential than the row API), so the row API cannot substitute it; **or**
2. **Signed anchors** — anchors are signed at mint time with the issuer key (the Ed25519 issuer keypair already exists in this repo, P6), and the client/offline verifier checks the signature against a pinned public key delivered out-of-band. This is the only option that also fixes H4 (offline packs) and survives redaction; **or**
3. **Honest downgrade** — if neither ships in v1, the local-verify seal must be labeled for what it actually proves: _"internally consistent with the proof bundle this server provided"_ (a self-consistency check), and the strong tamper-evident claim is reserved for the evidence-pack + external-anchoring path (sibling Rekor spec) where an independent root exists. Do **not** render a "verified against write-once anchor" seal off an anchor the row API itself supplied.

Option 2 is the recommendation — it is the smallest change that makes the claim true everywhere (live UI, redacted rows, offline packs) and reuses issuer machinery already in the repo.

---

### H3 — Redaction is presentation-side only; the proof-bundle endpoint would ship the original unredacted payload over the wire

**Ground truth:** redaction today is a **PayloadViewer presentation concern** — `DEFAULT_REDACT_KEYS` / `REDACTED` masking in `ui-pro payload-viewer.tsx` (per the SPEC's Current-state table). The audit chain and DB store the **original** payload (`audit_chain_entry.payload` jsonb); the hash commits to the original. The new proof-bundle endpoint returns `raw: {...}` (the receipt shape) so the client can recompute the link hash.

**The leak:** if the endpoint returns the DB payload as-is, the "redacted" content is **fully present in the JSON response body**. The UI masks it visually; anyone who reads the network response, the copied receipt, or the exported evidence pack gets the cleartext. This defeats redaction entirely, and it directly contradicts the state definition — `anchor-confirmed-original-not-disclosed` is premised on "the original payload **the client never receives**." As specced, the client _does_ receive it.

**Exploit path:** an auditor (or anyone with the exported pack) opens DevTools / the receipt JSON / the pack file and reads every "redacted" PII/secret field. On the operator surface, an operator inspecting a customer's chain exfiltrates redacted customer content trivially.

**Required mitigation (binding):**

- Redaction must be **enforced server-side inside the proof-bundle endpoint** — the endpoint ships the masked payload for redacted rows and sets the row state to `anchor-confirmed-original-not-disclosed`; the original never crosses the wire. This requires moving/sharing the redaction predicate (currently `DEFAULT_REDACT_KEYS` in ui-pro) into a place the endpoint can call server-side (a shared kernel/audit-worm redaction helper), not leaving it in the presentation layer.
- **Required test (add to CR-07's test list):** for a row with redacted fields, assert the endpoint response body (and the built receipt) contain **none** of the original values for those fields.
- Consistency check: once the server ships the masked payload, the client genuinely cannot recompute the hash → the `anchor-confirmed-original-not-disclosed` state is honest. Good — but the state is only honest _because_ the server redacted; make that causal link explicit in the SPEC.

---

### H4 — Unsigned anchors make the offline evidence-pack verifier unable to establish anchor authenticity

**What the SPEC claims (fork c/d):** the evidence pack "embeds the same receipts + a standalone verifier so a third party re-verifies **without trusting caisson's UI**"; CR-06: the verifier "recomputes every assertion it can from the raw material … and never trusts the embedded `checks` block."

**The gap:** recomputing the **link** hash from the embedded payload proves the row is internally consistent with the embedded anchor — it does **not** prove the embedded anchor is the real WORM commitment. The anchor stored in WORM (`chain-store.ts` `encodeAnchor`) is a bare `{length, tipHash, genesisHash}` triple with **no signature**. An offline verifier, with no network and no independent root, is checking caisson's claim against caisson's own claim. CR-06 correctly removes trust in `checks`, but the anchor itself is the remaining unauthenticated link. This is the offline instance of H2.

**Exploit path:** caisson (or a reseller of a tampered pack) ships an evidence pack with a rewritten chain and a matching forged anchor. The bundled standalone verifier prints PASS. The third party believes they verified "without trusting caisson."

**Required mitigation (binding):** sign anchors at mint (H2 option 2) and ship the issuer public key + signature in the pack so the offline verifier checks anchor authenticity against a key trust-established out-of-band (fingerprint on the pricing/trust page, `.well-known`, etc.). Absent signing, the pack README must **not** claim independent verification — it must state the verifier proves internal consistency + link-hash correctness only, and that external tamper-evidence requires the Rekor checkpoint (sibling spec). Pick the honest claim that matches what ships.

---

### M1 — Operator cross-tenant reads of proof material are not access-logged

ADR-0220 dual-logs operator **mutations** to the WORM chain + `admin_action_log`. A **read** of a customer's cryptographic audit chain (the current `business/audit` page, and the new proof-bundle endpoint) is **not** logged. An operator pulling any tenant's full proof bundle is a sensitive cross-tenant data access that both the customer trust story ("we log every operator access to your audit data") and insider-threat detection want recorded.

**Mitigation:** log every operator proof-bundle fetch to `admin_action_log` (actor email, target account, seq/range, timestamp). Cheap — the mutation routes already have the logging path; reuse it in read mode. Not a floor violation, but a gap a buyer's security review will raise about a _tamper-evidence_ product.

---

### M2 — Response security headers and cache directives unspecified

The SPEC specifies request/response Zod `.strict()` but says nothing about HTTP headers. A proof bundle is sensitive (cross-tenant on the operator surface; per-account on the tenant surface) and must not be cached by shared caches.

**Mitigation (floor-mandated):** every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `Vary` on the auth dimension, and `Strict-Transport-Security` on any public/HTTPS surface (per `identity/security.md` Headers). Reuse `admin-route.ts`'s `json()` helper on the admin endpoint — it already sets nosniff/DENY/no-store; extend it or mirror it on the tenant endpoint. Precedent: the B2 entitlement-worker filtered responses were `private/no-store + Vary` for the same reason.

---

### M3 — The live chip's state must be driven by the client's own recomputation, never the receipt's `checks` block

CR-06 removes trust in `checks`/`verifiedAt` **for the offline verifier**. Extend the identical rule to the **live UI chip**: the "verified locally" state must be produced by the client's WebCrypto recomputation result, not by reading the server-supplied `checks`. Otherwise the chip renders "verified locally" while actually displaying a server verdict — a fail-open on the very provenance distinction amendment #2 makes deliberate v1 scope.

**Mitigation:** the chip enum value is computed client-side from the recompute outcome; `checks`/`verifiedAt` are display-only strings never fed into the state decision. Before the WebCrypto path resolves (or where it's unavailable), the chip shows `pending` or the explicitly-distinct **server-asserted** styling — never the local-verification seal.

---

### M4 — No rate limit on the proof-bundle endpoint (per-row WORM GET amplification)

Fork (f): one WORM GET per inspected row. An authenticated caller scripting rapid `seq` requests drives N WORM GETs → egress cost + possible store throttling → a cheap authenticated cost-DoS. The repo already has a rate-limit primitive (`mcp-server/src/rate-limit.ts`).

**Mitigation:** a per-session/per-account rate limit on the endpoint. Bounded, low-effort; reuse the existing limiter rather than inventing one.

---

### L1 — `seq` upper bound is off-by-one (admits the truncation-probe key)

CR-07: "`seq … <= current chain length`." Valid rows are `0 … length-1`. `seq == length` addresses `anchor(length+1)` — the **truncation-probe key** `chain-store.verify()` uses as its length oracle (`head(anchorKey(len+1))`). For a healthy chain that anchor is absent; allowing `seq == length` turns the endpoint into an anchor-existence probe at the boundary.

**Mitigation:** bound `seq < length` (i.e. `<= length - 1`) against the **target** account's chain length; reject out-of-range as 400, not a silent `unverifiable`. (For the operator surface "current chain length" is the _target_ account's length, not "the caller's own" — another consequence of H1's disambiguation.)

---

### L2 — The receipt exposes the internal WORM object key

The receipt shape includes `anchor: {length, tipHash, key}` where `key = {account}/audit-chain/anchors/<len>.json`. This leaks the tenant account UUID and the internal key layout into a **copyable, exportable, third-party-shared** artifact. `length` + `tipHash` are sufficient to verify; the raw key adds nothing a verifier needs and would aid enumeration if the WORM bucket were ever directly reachable.

**Mitigation (ponytail: drop the field):** omit `anchor.key` from the receipt. Keep `length` + `tipHash` (+ `retainUntil` if shown). If a stable per-row identifier is wanted, use `seq`, not the storage key.

---

### L3 — CORS unspecified for any cross-origin verifier / site-demo fetch

If fork (c)'s site demo or the standalone verifier fetches live anchors from a different origin, CORS applies. Floor rule: explicit origin allowlist, never `*`, never reflected origin.

**Mitigation:** keep the endpoint same-origin (admin fetches its own `/api`) so no CORS is needed — the lazy correct default. If a cross-origin fetch is genuinely required, an explicit allowlist only. Note the tension with H2/H4: the offline verifier should work from **embedded** material (no live fetch) _once anchors are signed_; signing is what lets the pack be both offline and trustworthy.

---

### L4 — WebCrypto unavailability / exceptions must fail to `unverifiable` or `server-asserted`, never `verified`

`crypto.subtle` is only present in **secure contexts** (HTTPS/localhost). The evidence-pack HTML opened as `file://` may have no `crypto.subtle`; a thrown `digest()` or a canonicalization mismatch must not be swallowed into a pass.

**Mitigation:** any exception or missing-primitive in the client verify path resolves to `unverifiable` (or explicitly `server-asserted` where a server verdict is available), and the local seal is withheld. This is fail-safe-direction only, but the state machine must encode it so a future refactor can't collapse the catch into a default-pass.

---

## Clarification — do NOT over-apply the secret-comparison rule (prevents a false SHIP finding)

`kernel/audit-chain.ts` documents this explicitly: chain/link/tip hashes are **public integrity tags, not secrets**, so plain `===` on `hash`/`tipHash`/`prevHash` equality is **correct**; `crypto.timingSafeEqual` is **not** required and should not be demanded on those compares at SHIP. `timingSafeEqual` remains mandatory for the actual secrets in adjacent code — license tokens, session tokens, HMACs (e.g. the mcp-server entitlement compare). No secret comparison is introduced by this feature itself, **unless** H2 option 2 (signed anchors) is chosen — in which case the signature verification uses the standard signature-verify API (Ed25519 `verify`), which is constant-time by construction and is the right tool, not a hand-rolled hash `timingSafeEqual`.

---

## Binding constraints for the PLAN

These are the non-negotiables. A PLAN that omits any HIGH item is not plan-complete.

1. **(H1) Two consumer classes, two contracts.** Name the v1 endpoint(s) explicitly. The `apps/admin` endpoint takes the target `accountId` as a validated UUID input, gated by route-level `requireAdmin` (re-checked in the handler, not the proxy) + access-logging (M1). Any tenant self-service endpoint is a _separate_ route with strictly session-derived, RLS-scoped `accountId`. CR-07's "never client-supplied" prose applies only to the tenant route.
2. **(H2) Anchor trust root is independent of the row API.** Specify provenance: independent WORM read, or **signed anchors** (recommended — reuses the P6 issuer keypair, fixes H4 and redaction-state trust in one move), or honestly downgrade the local-verify seal to "internally consistent with the provided bundle." The "verified against write-once anchor" seal may not be rendered off an anchor the row-serving API supplied unauthenticated.
3. **(H3) Redaction enforced server-side in the endpoint.** The original payload of a redacted row never crosses the wire; the redaction predicate lives where the endpoint can call it, not only in `payload-viewer`. Required test: redacted values absent from response body and receipt.
4. **(H4) Offline verifier claim matches reality.** Either ship signed anchors + pinned public key in the pack, or the pack README claims only internal-consistency + link-hash verification (not "independent" tamper-evidence).
5. **(CR-07, affirmed) Key construction stays server-side.** `seq` parsed to a JS integer via `z.number().int().nonnegative()` and bounded `< target chain length` (L1) **before** any interpolation; WORM key built only via `buildArtifactKey` from the resolved accountId + validated seq; never accept a string seq or a path fragment. `assertSafeKey` already rejects traversal — keep it as the single construction path.
6. **(CR-07, affirmed) Zod `.strict()` in and out**, unknown fields rejected both directions; missing anchor / seq-beyond-rows → a 200 `unverifiable` verdict (fail-closed), never a fabricated pass, never a silent link-only "verified."
7. **(M2) Floor headers on every response** (`nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `Vary`, HSTS on public surfaces) — reuse `admin-route.json()`.
8. **(M3) Chip state from client recomputation only** — `checks`/`verifiedAt` are display-only, never inputs to the state decision; exceptions/unavailable WebCrypto → `unverifiable`/`server-asserted`, never `verified` (L4).
9. **(M4) Rate-limit the endpoint** using the existing `mcp-server` limiter primitive.
10. **Required tests before ship (superset of CR-07's list):** cross-tenant denial _on the tenant route_ (session A cannot reach account B by any seq); operator-route non-allowlisted-session denial; missing-anchor fail-closed; **redacted-value-not-in-response** (H3); anchor-authenticity (signed-anchor verify, or a documented negative test proving the local seal is withheld when provenance is server-only, per H2 option 3); seq out-of-range rejected (L1).
