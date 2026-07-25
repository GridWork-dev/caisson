# ADR-0381 — Launch-gate picker locks: crypto-policy control content, grandfathering, Railway credential scope

- **Status:** LOCKED (operator picker, 2026-07-25)
- **Extends:** ADR-0106 (grandfathering, brought current here), ADR-0129 §4, ADR-0137,
  ADR-0245 (credits), ADR-0247 F7/F8 (snapshot-at-sale + upgrade credit), ADR-0257/0258
  (six-bundle catalog), ADR-0327 (branch posture), ADR-0373 ($1,449), ADR-0379 (the open
  fork it closes), ADR-0380
- **Grounds:** `docs/state/decisions-and-forks.md` · `docs/state/outstanding-work.md` ·
  `docs/ops/launch-runbook.md` · `packages/compliance-core/src/evidence/collectors/field-crypto-policy.ts` ·
  `packages/pricebook/src/upgrades.ts` · `apps/admin/src/lib/fleet-reads.ts`

## Context

A verified sweep of the fork board, the launch runbook, the credential inventory, and the live
public surface produced 77 candidate items; 66 survived adversarial verification. It found that the
critical path is **not** blocked by any decision fork — the remaining blockers are operator gates
and external parties — and that several tracker rows assert states the live system contradicts.

Four decisions came out of the 2026-07-25 picker. Three are recorded here; the fourth (which
browser and instruction work to author) is execution, not decision, and lands as work.

Findings that ground these locks:

- The `substrate.field-crypto-policy` collector ships complete with a hardcoded default control id
  (`field-crypto-policy.ts:43`), but no canonical control statement or evidence claim. ADR-0379
  forbade inventing them.
- A grandfathering policy already exists — ADR-0106 §Grandfathering, extended by ADR-0129 §4 and
  ADR-0137. It predates the six-bundle catalog, the $1,449 Compliance price, the credits model, and
  Paddle as merchant of record. The gap is currency, not absence.
- `RAILWAY_API_TOKEN` on `caisson-admin` is account-scoped by construction: the fleet-read query is
  rooted at `me { projects { … } }` (`fleet-reads.ts:70-75`), which no project-scoped token can
  satisfy. It powers a read-only status overlay while carrying deploy and delete authority over
  every Railway project on the account. No prior ADR addressed it.
- GitHub private-repository access has been authorized since 2026-06-30 and works today
  (`gh auth status` shows an active `repo`-scoped token; `caisson-sh/caisson` reads `isPrivate:true`).
  Two tracker rows still describe it as unauthorized and its state as unknown.
- `https://caisson.sh/.well-known/security.txt` serves an **89-byte body from Cloudflare on GET**
  advertising a non-Caisson contact address, while **HEAD on the same URL returns the correct
  331-byte origin file** with `x-railway-request-id`. The repo file has been correct since
  2026-06-27. This is edge configuration, not deploy lag: the origin already serves the right bytes
  and the GET never reaches it. No redeploy has ever been attempted against this defect.

**Content authorship.** At the picker the operator chose "I draft it now, you lock it" for the
control content and "write grandfathering now" for the pricing policy. The prose in locks 1 and 2 is
therefore drafted here and takes effect as written. Append-only: supersede with a later ADR, never
edit.

## Locks

### 1. `substrate.field-crypto-policy` canonical control content

Closes the ADR-0379 fork row. The collector's behavior is unchanged; this lock supplies only the
wording it was missing.

- **Control id:** `DATA-PROTECTION.PHI-ENCRYPTION` (the collector's existing default — not changed).
- **Control statement:** _Protected health information is stored encrypted at rest. Every
  PHI-bearing field in a tenant's scope holds an AES-256-GCM field-crypto envelope rather than
  plaintext or a value in any other format._
- **Mapping:** HIPAA Technical Safeguards §164.312(a)(2)(iv) (Encryption and Decryption,
  addressable). The collector does **not** evidence §164.312(e)(2)(ii) (transmission encryption) —
  that is a different control with a different collector.
- **Evidence claim on `pass`:** _Every PHI-bearing field inspected in this tenant's scope parsed as
  a well-formed AES-256-GCM field-crypto envelope at rest._ The result carries the field count, the
  encrypted count, and the (empty) plaintext and unsampled field lists.
- **What a `pass` does NOT claim.** This is binding on any narrative or trust-page copy that cites
  the control:
  - It does not attest **key custody or key management**. The collector reads ciphertext shape; it
    never inspects where the key lives, who can reach it, or how it rotates. The optional
    `encryption-key-management-policy` manual slot exists precisely because the automated check
    cannot reach that question. An automated `pass` with that slot unfilled is **not** full control
    satisfaction, and must never be rendered as though it were.
  - It does not attest that the **field list is complete**. The control evidences the fields placed
    in scope; a PHI field nobody listed is invisible to it.
  - It does not attest **encryption in transit**, backup encryption, or key-escrow posture.
- **Verdict semantics** (already implemented; recorded here as the canonical reading):
  - `flagged` — at least one field's stored value is not a valid AES-256-GCM envelope. A real
    deficiency: PHI is not encrypted at rest.
  - `unresolved` — no fields were inspected, or some field had no populated row to sample. Evidence
    is absent. This is never a pass, and the fail-closed posture (ADR-0058) forbids reading it as one.
  - `pass` — every inspected field carried a valid envelope, with the non-claims above.
- **Scope boundary:** samples are gathered tenant-scoped at the edge inside `withTenantCrypto`, so a
  sample never crosses a tenant boundary. Evidence bytes are deterministic — field names are sorted
  so input order never changes the output.

### 2. Compliance holds at $1,449; grandfathering brought current

- **The price stays $1,449.** It is the operative displayed and pricebook value (ADR-0373) and the
  number the Paddle production catalog will be created against. The operator's adjustment authority
  is exercised as "no change".
- **Deadline recorded:** creating the 35-product / 66-price Paddle production catalog hardens the
  number into a live billing account. Any future adjustment is a new price id, never an edit — see
  the reprice mechanic below.
- **Forward-only price lock (ADR-0106 §2 restated for the six-bundle catalog).** Every buyer's
  purchased price and version is honored against all future increases. One-time purchases own the
  purchased version perpetually; subscription renewals hold the rate the subscriber signed at. An
  increase never claws back, re-bills, or downgrades an existing buyer.
- **Entitlement is snapshot-at-sale.** A buyer's perpetual token signs the ids actually purchased,
  and bundle membership is frozen at their `entitledSince` per the F7 timeline (ADR-0247,
  `packages/pricebook/src/upgrades.ts`). A member SKU that joins a bundle after that date is outside
  the snapshot. This is existing behavior; it is now also policy.
- **Upgrade credit never falls below what the buyer paid.** The F8 credit for an owned item toward a
  bundle is **the greater of the price the buyer actually paid for that item and its current retail
  in the live upgrade book**. The floor-$0 rule and the fail-closed unmapped-pair throw are
  unchanged — an item that is not a creditable member of the target bundle still throws rather than
  silently crediting $0.
  - _Residual, disclosed:_ the shipped `resolveUpgradeCredit` credits from the live `SKU_RETAIL`
    table only, with no reference to the buyer's paid amount. The two agree today because no price
    has fallen since any sale, and there are zero buyers. Honoring this clause after a **price
    decrease** requires reading the purchase record. That is a follow-up work item, not a claim of
    current behavior.
- **A reprice mints a new price id; an armed price id is never mutated in place.** Existing
  subscriptions therefore keep their signed rate as a property of the system rather than a manual
  courtesy.
- **Pre-launch position:** there are zero buyers, checkout is Cloudflare-gated, and no price is
  purchasable. This policy therefore grandfathers nobody today. It exists so the first sale lands
  under a written rule rather than an improvised one.
- **Refund interaction unchanged:** a refund reverses the entitlement and claws back unused credit
  grants; grandfathering confers no right to retain entitlement after a refund.

### 3. `RAILWAY_API_TOKEN` narrowed to the least-privilege credential Railway will authorize

- **Intent:** remove the account-scoped credential from `caisson-admin`. It backs a read-only status
  overlay and should not carry fleet-wide deploy and delete authority.
- **Vendor constraint, recorded because it bounds the outcome.** Railway exposes three token classes
  with different auth headers — account (`Authorization: Bearer`, supports `me`), team
  (`Team-Access-Token`), and project (`Project-Access-Token`, rooted at `project(id:)`, no `me`).
  Multiple Railway community reports describe project tokens returning _Not Authorized_ on nested
  service and deployment sub-queries of exactly the shape this overlay needs. A project token may
  therefore be unable to serve this read at all.
- **The lock:** `fleet-reads.ts` supports `RAILWAY_PROJECT_TOKEN` + `RAILWAY_PROJECT_ID` with a
  project-rooted query and the `Project-Access-Token` header, **preferred** when both are set, and
  keeps the account-token path as fallback. Every existing invariant holds — `configured: false`
  when nothing is set, 60-second module-scope cache, 10-second timeout, independent per-upstream
  gating, and degrade-to-empty-overlay on any error.
- **Verification is empirical and belongs to the operator:** set the project pair, load
  `/architecture`, confirm the overlay populates. If it does, delete the account token at Railway and
  remove `RAILWAY_API_TOKEN`. If Railway refuses the query, the fallback is a **team-scoped** token;
  if that also fails, the honest options are to accept the account-scope residual in writing or to
  drop the overlay. Do not leave the account token in place silently on the assumption the narrowing
  worked.

### 4. Gate reclassifications

- **GitHub is a certification, not an authorization.** Access is live and has been since 2026-06-30.
  The remaining work is running the queries and recording the answers. Two sub-items are separately
  settled and must not be re-raised as defects: branch-protection API 403s are accepted
  discipline-only on the Free plan (ADR-0327), and organization 2FA was explicitly declined
  2026-07-15 with "re-raise at launch".
- **The seven Gate D provider-console checks get an authored home** (`docs/ops/provider-console-checks.md`).
  Four documents previously repeated the same bullet list with no steps, no evidence format, and no
  pass bar. Six of the seven are read-only and safe to delegate; key parity touches credential
  material and stays human-only.
- **The `security.txt` defect is edge configuration.** It is a live public defect on a product sold
  on its compliance posture, it cannot be fixed by redeploying, and its verification command must be
  a **GET** — HEAD returns the correct file and would give a false pass.
- **The OpenRouter management key is regenerated, not removed.** Four rows prescribed removal. The
  key is already dead (401 Invalid management key) and serves provisioning and usage attribution, a
  purpose the six per-service inference keys never replaced. Removing something already dead
  accomplishes nothing; regenerating restores per-key usage visibility.
- **`oscal-spine` as a priced fourth compliance SKU** was deferred by ADR-0364 to the fork board and
  never landed there. It is now a recorded open row. No trigger, no active dependency.

## Consequences

- The `substrate.field-crypto-policy` binding is resolved and the collector may be cited in evidence
  narratives — bounded strictly by the non-claims in lock 1.
- The grandfathering clause in lock 2 creates one follow-up work item: credit from the purchase
  record, not only the live retail table. Until it lands, the price-decrease case is a disclosed gap
  with no affected buyer.
- `apps/admin` gains two optional environment variables and no required ones; an unconfigured
  deployment behaves exactly as before.
- Three tracker rows and four runbook rows change meaning, which moves the GitHub gate off the
  blocking list.

## Alternatives rejected

- **Hold the crypto-policy wording for auditor input.** Defensible — the acceptance reviews are
  already budgeted — but it leaves a shipped collector uncitable for weeks over prose, and an
  auditor may supersede the wording either way.
- **Write the control text as a full control-satisfaction claim.** Rejected as dishonest: the
  collector cannot see key custody, and a compliance product that overstates its own evidence is the
  worst possible failure.
- **Cap upgrade pricing at the bundle price in force at the buyer's original purchase.** A stronger
  grandfathering promise than clause 2, and materially more expensive; rejected as unnecessary
  before the first sale.
- **Drop the Railway overlay entirely.** The laziest fix and it removes the credential with
  certainty. Rejected because the fleet-status view is useful during exactly the launch window this
  work is preparing for.
- **Accept the account-scope residual with an ADR row and no code change.** Rejected: it leaves the
  one genuinely over-broad live credential in place, in the app adjacent to commerce.
