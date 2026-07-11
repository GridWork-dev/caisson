# ADR-0324 — caisson.sh email architecture: address roles, transactional sender, hello@ retirement

- **Status:** accepted
- **Date:** 2026-07-11
- **Decider:** operator (picker, four questions, after the in-session live audit)
- **Grounds:** live audit this sitting — Cloudflare DNS/email-routing API reads on zone
  `caisson.sh`, `~/.gridwork/caisson.env` sender value, repo-wide address grep. Trigger: the
  browser-audit IN-02 residual ("is email support real?") widened by the operator into a full
  email-architecture pass.

## Context (audited state, 2026-07-11)

- **Inbound** rides **Proton Mail**: MX `mail.protonmail.ch`/`mailsec.protonmail.ch`, SPF
  `include:_spf.protonmail.ch`, all three `protonmail*._domainkey` DKIM CNAMEs present, DMARC
  `p=quarantine` with `rua=<email>`. The domain is catch-all into the operator's
  primary Proton account; only `admin@` is wired as a Proton send-as identity.
- **A stale Cloudflare Email Routing config** exists on the zone (`enabled: false`,
  `status: unconfigured`) with one leftover catch-all rule → `<email>` and one
  verified destination address — superseded by the Proton MX cutover 2026-06-30, inert since.
- **Outbound transactional** is Resend (DKIM `resend._domainkey.caisson.sh` + `send.caisson.sh`
  MAIL-FROM subdomain, amazonses SPF) with **`RESEND_FROM=hello@caisson.sh`** in the live env —
  while all three sender call-sites default to `Caisson <no-reply@caisson.sh>` when the env var
  is unset: `apps/site/lib/auth-server.ts:106` (magic links),
  `services/license/src/email-notify.ts:42` (lifecycle), and
  `apps/admin/src/app/api/admin/catalog/send-test-email/route.ts:31`.
- **Site contact copy** points at `admin@` everywhere user-facing (legal pages, procurement
  refunds, partners/affiliates applications, ask-AI panel) and `security@` on
  security/evidence/procurement surfaces. `support@caisson.sh` appears nowhere user-facing
  (only as the compliance impersonation `operatorEmail`, `apps/compliance/lib/leg.ts:364`);
  `hello@` has zero repo references — it exists only as the env value.

## Decisions

1. **Address roles.** `admin@` = operator identity: accounts, billing, legal — stays the
   contact on the legal pages only (privacy/terms/EULA/license). `support@` = the user-facing
   product contact **everywhere except legal**: refund instructions, partners/affiliates
   applications, ask-AI panel, dashboard/docs/footer contact mentions. `security@` = security
   disclosure + evidence surfaces, kept as-is (conventional for vulnerability contact).
   `no-reply@` = transactional sender. **`hello@` is RETIRED** — nothing may reference it after
   the env flip.
2. **Transactional sender identity.** `RESEND_FROM` flips to `Caisson <no-reply@caisson.sh>`
   (matching the existing code defaults — hyphenated spelling wins), and the three sender
   call-sites gain `reply_to: support@caisson.sh` so a buyer replying to a magic-link or
   lifecycle email lands in the support inbox instead of bouncing.
3. **Inbound stays Proton; the Cloudflare Email Routing artifact is deleted.** The disabled
   zone config's catch-all rule and the verified destination address are removed so future
   audits don't trip on a second, dead inbound path. Proton catch-all + DMARC posture is the
   inbound truth.
4. **Execution rides Kickoff O** (the post-remediation parallel code chunk): env flip on the
   three Railway services + the reply-to code change + the support@ copy pass + CF cleanup +
   docs truth pass. **Operator console act (any time):** add `support@` as a Proton send-as
   alias so human replies come from the right identity (optionally `security@` too).

## Consequences

- One inbox, four public identities, each with one job; the site's support claims become
  answerable (IN-02 closes: support@ receives via catch-all today, and replies gain a real
  Reply-To path).
- The env-default divergence class (live env silently overriding a sane code default with a
  retired address) is eliminated for email; the parity sweep (ADR-0317) covers the var going
  forward.
- No deliverability change: Resend's DKIM/MAIL-FROM alignment already passes DMARC for any
  local-part; only the display identity changes.
