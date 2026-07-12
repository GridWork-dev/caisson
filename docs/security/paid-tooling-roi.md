# Paid security tooling — ROI ranking for Caisson

**Snapshot: 2026-07-10.** Prices drift and most enterprise tiers are contact-sales — re-verify before
buying. Method: 13-agent research pass, each category's pricing adversarially re-checked against
vendor pricing pages. The baseline every option must beat is the **$0 stack already in place**
(`tooling-playbook.md`): Semgrep CE (free Pro interfile) + Trivy + osv + TruffleHog + nuclei + ZAP +
Schemathesis + the Claude-Code-driven pentest. Two ROI lenses: **risk-reduction** (finds bugs the
free stack misses) and **revenue-enablement** (unblocks a sale — SOC2, a pentest letter, a trust
center).

## Verdict

- **Top pick (when a deal needs it): Oneleet** — one ~$12K/yr contract bundles the **SOC2 audit + a
  named third-party pentest + Trust Center** (the exact artifacts buyer security questionnaires
  demand) at/below what Vanta/Drata charge for GRC _software alone_. Highest-ROI paid dollar for a
  founder whose _product is compliance_ — it's revenue-enabling, not a sixth scanner.
- **Sequencing:** SOC2 Type II needs a multi-month observation window. If **no customer is demanding
  SOC2 yet**, the buy-now-today is a cheap **pentest letter — Astra Pentest, $1,999/yr** — and you
  pull the Oneleet trigger the moment a deal requires SOC2. Reference-check Oneleet's audit firm +
  pentest team before leaning on the letter in a sales cycle; if that worries you, **Thoropass**
  (in-house CPA audit, from $14.5K/yr) is the more-established substitute.
- **Why not the internal pentest:** Claude+ptai+HexStrike can never satisfy the questionnaire line —
  "third-party" is the checkbox, not "more bugs found." It's an independence requirement.

## The $0 moves (do these regardless — net-new coverage, no sales call)

The free stack has exactly three real gaps; all close for **$0** on a single private repo:

1. **DONE — Semgrep flipped to Team edition** (free under 10 contributors) and **Socket.dev wired**
   (`socket-security` GitHub App, live in CI — verified 2026-07-11 org API read,
   `docs/state/production-readiness.md`).
2. **DONE — Arnica installed** (2026-07-12, session Q): `arnica-github-connector` on the
   `caisson-sh` org covering caisson + caisson-oss (operator-installed, org-API-verified).
   Free tier; git-identity/permission hardening class none of the other tools touch.
   Remaining dashboard-side config: enable the identity/permission policies + point alerts
   at admin@caisson.sh (Arnica has no Discord channel; email is the fit here).

## Ranked

`tier` = should you **pay**. Several `skip` rows still have a **free tier worth wiring** (above) —
skip means "don't pay," not "don't use."

| Tier        | Tool                                      | What it is                                                     | Price                                    | Lens    |
| ----------- | ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- | ------- |
| **buy-now** | **Oneleet**                               | Compliance bundle: SOC2 audit + pentest + Trust Center         | ~$12K/yr floor ($8K–60K+ by size)        | both    |
| **buy-now** | **Astra Pentest**                         | Self-serve PTaaS (signed pentest letter)                       | $1,999/yr Basic · $5,999/yr Plus         | revenue |
| maybe       | Thoropass                                 | Compliance automation + in-house CPA audit                     | Platform $8.7K/yr; +SOC2 from $14.5K/yr  | revenue |
| maybe       | Vanta                                     | GRC + Trust Center (most recognized brand)                     | ~$10K/yr entry (contact-sales)           | revenue |
| maybe       | Drata                                     | GRC + Trust Center (lower entry than Vanta)                    | $7.5K–15K/yr entry (contact-sales)       | revenue |
| maybe       | Secureframe                               | GRC + Trust Center                                             | ~$7.5K/yr entry (contact-sales)          | revenue |
| maybe       | Boutique pentest firm                     | One-off human pentest, named-firm letter                       | $5K–30K one-off                          | revenue |
| maybe       | StackHawk                                 | Agent-loop DAST/API + CI "tested-clean" attestation            | $10/user/mo Wingman; Scale contact-sales | both    |
| skip        | Semgrep Supply Chain                      | Reachability SCA (**free flip — do it**)                       | $0 under 10 contributors                 | risk    |
| skip        | Socket.dev                                | Malicious-package detection (**free tier — do it**)            | Free 1k scans/mo; $25/dev/mo paid        | risk    |
| skip        | Arnica                                    | Git-identity risk (**free tier — optional**)                   | Free; $300/identity/yr paid              | risk    |
| skip        | Endor Labs                                | Reachability SCA (redundant w/ Semgrep flip)                   | Free Dev Ed; paid opaque                 | risk    |
| skip        | Aikido                                    | All-in-one dashboard over the same free scanners               | Free; $300–600/mo paid                   | both    |
| skip        | Snyk                                      | SCA/SAST — CVE coverage redundant w/ Trivy/osv                 | Free ample; $25/contributor/mo           | risk    |
| skip        | GitHub Advanced Security                  | PR-gate over the same CVE DB                                   | $30/committer/mo (+$19 secrets)          | revenue |
| skip        | Semgrep Teams                             | Same engine you run free; paid = dashboard/SSO only            | $30–75/contributor/mo                    | risk    |
| skip        | Semgrep Secrets                           | Validity-check you already get from TruffleHog                 | $15/contributor/mo                       | risk    |
| skip        | GitGuardian                               | Free tier fits; Business is 25–200-dev priced                  | Free; Business ~$45K/yr                  | risk    |
| skip        | Detectify                                 | EASM is real but per-domain metered/opaque                     | Starter €0 metered; €2,500/yr            | risk    |
| skip        | Corgea                                    | Auto-fix SAST; 5–20 seat minimums force a floor                | $39–49/dev/mo (seat min)                 | risk    |
| skip        | Cobalt.io / HackerOne / Bugcrowd / Synack | Enterprise-team PTaaS — Astra delivers the same letter cheaper | $15K–75K+/yr                             | revenue |
| skip        | Bright / Escape / Probely                 | Real DAST but opaque enterprise-only, redundant w/ ZAP         | contact-sales                            | risk    |
| skip        | Pixee                                     | Remediation layer; free tier sunset, opaque                    | opaque/contact-sales                     | risk    |
| skip        | Nightfall / TruffleHog Enterprise         | DLP/managed secrets over the free TruffleHog you run           | opaque / paid                            | risk    |
| skip        | Jit                                       | Self-serve dead post-Torq acquisition                          | opaque (404)                             | both    |

## ⚠️ Do not use

- **Delve** — 2026 live SOC2 **evidence-fabrication scandal**, YC-delisted. A fraudulent compliance
  artifact is the _opposite_ of revenue-enablement in a sales cycle. Avoid.

## Bottom line

Spend **$0 more on scanners** — everything in the SAST/SCA/secrets/DAST categories is redundant with
the free stack (wire the three free tiers above for the only real gaps). The **only paid dollar worth
spending is revenue-enabling**: a pentest letter now (**Astra**), and SOC2 via **Oneleet** the moment
a deal demands it.
