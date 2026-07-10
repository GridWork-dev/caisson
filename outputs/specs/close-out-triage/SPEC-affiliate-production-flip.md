# SPEC — Affiliate program production flip (attribution capture + minting + reporting)

**Status: DRAFT — operator lock required; this SPEC does NOT authorize building.** The mechanics
are PROVEN in sandbox (2026-07-10: pricing-preview with `CAISSONAFF1` → exactly 10% off
9900→8910; `transaction.completed` sim delivered `discount_id` intact to the live license webhook,
200 `{"ok":true}`). What remains is the production-side build the tracker row names.

- **Surface:** `services/license` (`parsePaddleEvent` → `order_record`), admin (`apps/admin`
  minting + report), Paddle production catalog.
- **Tags:** `billing`, `external-system` (fires the security audit at SHIP).
- **Design lock context:** in-house program — per-affiliate discount codes (API-mintable) +
  attribution via `discount_id` on transaction webhooks + Caisson pays commissions directly
  (Paddle Billing has no native affiliate feature). CAISSON-30 (Done) holds the research;
  `docs/gtm/affiliate-attribution.md` is the design doc. A separate open Linear item tracks the
  30–50% tier structure + public terms page (D6 lock) — that is GTM copy scope, not this spec.

## Gap (WHY now)

The webhook DELIVERS `discount_id` but `parsePaddleEvent` DROPS it — attribution data is lost at
the exact moment a real affiliate sale lands. Everything downstream (commission math, clawback on
refund) starves on this one dropped field. This must land BEFORE the production Paddle flip.

## Tasks

1. `parsePaddleEvent`: carry `discount_id` (nullable) through the parsed event; stamp it on
   `order_record`. Zod schema stays non-strict on the envelope (the #114 lesson — never `.strict()`
   a provider webhook envelope); the new field is optional/nullable. Regression test: the sandbox
   sim payload parses with `discount_id` intact; a payload WITHOUT one still parses.
2. Per-affiliate code minting: admin lever that mints a Paddle discount code for an affiliate
   (name → code, percentage from the D6 tier lock) and records the mapping in a table the
   commission report can join.
3. Commission/clawback report: admin read surface joining `order_record.discount_id` → affiliate →
   gross/commission; refunds/chargebacks on attributed orders flag a clawback row (subscribe-and-
   alert posture per ADR-0294 — no automated money movement).
4. Backfill note: orders landed before task 1 ships have NULL `discount_id` — the report labels
   the window honestly rather than guessing.

## Verify

Sandbox sim round-trip shows `discount_id` on the stored `order_record`; minting lever creates a
code visible in Paddle sandbox; report renders the attributed order with correct commission math
(integer cents per ADR-0007).

## Effort / value

M (a day). Value: affiliate program can actually pay out; blocks the production Paddle flip
checklist item.
