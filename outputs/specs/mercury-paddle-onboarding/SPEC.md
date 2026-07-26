# SPEC — Mercury onboarding and Paddle production readiness

- **Date:** 2026-07-25
- **Status:** LOCKED by operator instruction
- **Tags:** `billing` `external-system` `frontend` `ui`
- **Grounds:** ADR-0080 buyer-copy laws; ADR-0379 commerce hold; `docs/ops/launch-runbook.md`

## Goal

Make the Mercury application and Paddle production account executable through two precise,
paste-ready browser prompts while completing the repository prerequisites that can ship before
either provider is mutated.

Success means:

1. Caisson publishes dedicated refund and support routes using its already-approved policy and
   support addresses.
2. The Paddle catalog tool validates and exports an exact 35-product/66-price production mapping
   without guessing, overwriting, or leaking credentials.
3. The Mercury and Paddle browser prompts distinguish safe navigation from adult-only identity,
   attestation, credential, banking, and submission actions.
4. Production catalog IDs are returned for a separate code-wiring and deployment gate; no sandbox
   ID remains active in production checkout after that gate.
5. Cart/dashboard access gates and the broader paid-launch hold remain intact.

## Locked behavior

- Mercury: Georgia single-member LLC; adult sole member owns and controls 100% with role `CEO`;
  no minor access; Revenue only; expected balance and monthly activity each `$0–$10K`.
- Mercury addresses: registered-agent address for legal, real operating/home address for physical.
- Mercury post-approval target: passkey plus separate TOTP backup and three accounts named
  `Operating`, `Tax Reserve`, and `Paddle Reserve`.
- Paddle: retain separate live and sandbox sellers; live descriptor `CAISSONSH`; `$100` payout
  threshold; adult-only access and 2FA.
- Paddle payout classification remains unset until written CPA and Paddle guidance agree.
- Paddle production catalog is exactly 35 products and 66 prices; controlled proof uses the `$49`
  Agent Runner module and ends in a refund.
- Production webhook events are exactly `transaction.completed`, `subscription.created`,
  `subscription.updated`, `subscription.canceled`, and `adjustment.updated`.

## Non-goals and holds

- No Mercury or Paddle submission, identity attestation, document upload, credential creation,
  bank connection, secret write, Railway deployment, real transaction, refund, or public-gate
  change is performed by this repository phase.
- No production price ID is invented before Paddle returns it.
- The reviewer capability is not built preemptively. It remains conditional on a domain rejection
  plus one failed evidence-backed appeal and requires a separate `auth` + `security` +
  `data-migration` SPEC/ADR and operator gate.
- The draft operating agreement is never represented as final or executed.

## Acceptance

- Route and rendering tests pin the refund/support pages and public support addresses.
- Catalog tests reject missing, duplicate, unexpected, unmarked, or out-of-checkout mapping data.
- `--self-check` confirms 36 products, 68 prices, Compliance at `$1,649`, and Everything at
  `$2,259`.
- Both prompts contain human takeover points, stop conditions, and redacted receipt formats.
- Repository checks pass without changing the existing Cloudflare commerce policy.
