# Go-live: legal, entity & launch-blocker checklist

Operator-actionable prep for taking Caisson from "deployed but gated" to "can take a real
payment." Companion to `readiness-and-backlog.md` (build/deploy state) — this file owns the
**business/legal + launch-flip** surface. **Not legal/tax advice; confirm specifics with a
GA CPA + the GA SOS before filing.** Operator is **Atlanta, Georgia** (not CA — the CA
$800 franchise-tax math does NOT apply).

## Entity — Georgia (verified 2026-07-01, GA SOS + multiple 2026 guides)

|                   | Sole proprietor (now)                            | **Georgia LLC**                                                                            |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Setup             | $0, start today                                  | **$100 online** (eCorp / ecorp.sos.ga.gov), ~7 biz days (+$100 → 2 days, +$250 → same-day) |
| Recurring         | $0                                               | **$60/yr** annual registration (Jan 1–Apr 1; first one due the _year after_ formation)     |
| **Franchise tax** | —                                                | **NONE** (GA net-worth tax hits only LLCs taxed as C-corp; pass-through LLC owes $0)       |
| Liability         | personal assets exposed                          | shielded from business debts/suits                                                         |
| Paddle            | works as Individual (gov ID + W-9 + payout acct) | works as entity (provide formation docs)                                                   |
| Tax               | Schedule C on personal return                    | pass-through (same), cleaner separation; GA income tax flat ~5.19% → 4.99% glide           |
| Registered agent  | n/a                                              | GA street address required — **operator can self-serve** (Atlanta address), $0             |

**DECISION (operator-locked 2026-07-01): sole-proprietor first, form the GA LLC at first sale.**
Zero setup now; Paddle accepts an Individual (gov ID + W-9 + payout account). Because GA turnaround
is 2–7 days and cost is only ~$100 + $60/yr (no franchise tax), the LLC can be stood up within days
once revenue appears — no need to pre-pay a shield before there's anything to protect. Everything
stays sole-prop-compatible until then (personal Schedule C, SSN or free EIN, separate-tracking bank
account). Revisit at first meaningful revenue or the first enterprise prospect.

**Same-week bundle once you decide to form:** file Articles of Organization ($100 eCorp) → free
EIN at IRS.gov (10 min) → operating agreement (free template, not filed) → business bank account.
FinCEN BOI report: domestic US LLCs are exempt as of early 2026 — verify at fincen.gov/boi.

## Legal docs — minimal launch stack (Paddle MoR + CalOPPA/GDPR reality)

Paddle (as Merchant-of-Record) requires ON THE SITE before go-live:

- **Terms & Conditions** — must carry the Paddle MoR attribution line verbatim
- **Refund policy**
- **Buyer support details** (email + contact)
- Seller/brand name visible

Plus, independent of Paddle:

- **Privacy Policy** — required day one (any site reachable from CA → CalOPPA; and Caisson processes
  auth/billing/audit data, so it's also a buyer trust signal)
- **Cookie consent banner** — you run Plausible (cookieless, no banner needed) **+ PostHog** (sets
  cookies → banner needed) — reconcile: either gate PostHog behind consent or run it cookieless
- **DPA (Data Processing Agreement) — have a template ready at launch.** Not legally forced for early
  B2C, but Caisson's buyer _is_ the audit-focused technical founder — they will ask early, and
  "already have one" is on-brand for a product selling compliance rigor. No-DPA = lost enterprise deal.

Tooling: Termly / iubenda generate Privacy + ToS + Refund + cookie banner in ~1hr for ~$10–30/mo.
Given the brand ("evidence-forward, not boilerplate"), the ToS deserves a real pass, not pure generator output.

**Defer:** MSA/enterprise contract (until a buyer wants custom terms) · SOC 2 report (~$10–30k,
3–6 mo; enterprise procurement, post-v1) · Delaware C-corp conversion (only if raising VC).

## Launch-blocker checklist (the go-live-execution phase — from the pre-merge recon)

These BLOCK a real sale and are **operator-owned** (I can't do them from the box):

1. **Paddle SANDBOX → production** — obtain live `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` /
   `PADDLE_CLIENT_TOKEN`; today's box vars are sandbox-scoped. **Hard blocker** — a completed checkout
   grants nothing until this + the (already-built) webhook route run against live creds.
2. **Cloudflare Access flip** off `caisson.sh`/`www` (ADR-0107) — the deliberate launch act; do only
   after checkout works + Compliance is buyable.
3. **Discord** — enable GUILD_MEMBERS + MESSAGE_CONTENT privileged intents (Dev Portal), set
   `SUPPORT_CHANNEL_ID`/`MEMBER_ROLE_ID` on the box, scope the bot role down from Administrator.
4. **Rotate the leaked Discord/OpenRouter creds** (flagged in memory, no evidence done) before public launch.
5. Legal stack (above) live on the site + the Paddle attribution line.

Box-drivable go-live tail (I do these): mount/verify is already built (webhook route exists,
ADR-0108/0110); post-merge redeploys (`railway up -s …`); registry 32-index confirm; doc-hygiene sweep.

## Why this doc exists

Consolidates the entity/legal research (GA-corrected 2026-07-01) with the recon's operator-owned
go-live blockers, so the path from "deployed" to "first sale" is one checklist. The code mechanism
(billing/entitlement/license/registry/dashboards/bot) is already built + deployed; what remains is
credentials + one launch-flip + legal content — not architecture.
