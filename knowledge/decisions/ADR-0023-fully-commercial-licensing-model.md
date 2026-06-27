# ADR-0023 — Fully-commercial licensing model (supersedes ADR-0010's open-core base)

Status: **locked** · 2026-06-27 (D9 module-standards session; operator-decided, locked with the D9 set)

ADR-0010 leaned **open-core**: "the Base has a free/OSS core with paid pro modules." The operator
reversed this — the product is **fully commercial**. This ADR records that and **supersedes the
"free/OSS core" phrasing of ADR-0010** (which is append-only; the rest of ADR-0010 — Ed25519 offline
licensing, entitlements, the pro-private firewall — stands unchanged).

## The model

- **Every module ships under the proprietary `LicenseRef-Stack-Commercial` EULA.** A buyer purchases,
  then builds **unlimited products** with the code — but may **not** resell, redistribute, or
  open-source the kit itself. (The ShipFast/MakerKit paid-boilerplate model.) **No permissive free
  tier** — Apache-2.0 / MIT are removed from the SPDX allowlist (ADR-0020).
- **The one open flank: the Local-first AI edition is `AGPL-3.0-only`** — a deliberate community /
  distribution play (← public `tessera`, already AGPL). It is free under AGPL copyleft; its
  commercial (non-AGPL) license + hosted-inference / GPU credits + pro modules are paid (dual-license).
  This is the _only_ non-commercial-EULA code in the product.
- **Per-module à-la-carte (ADR-0003/0012) is all commercial.** The manifest `tier` (ADR-0020) is
  `paid` for every module; `oss` marks **only** the AGPL flank. `license` is
  `LicenseRef-Stack-Commercial` everywhere except the AGPL flank.

## Buyer rights (answering "they purchase and use it in their own stuff")

Purchase → `entitlement` + an Ed25519 offline license (ADR-0010) → install entitled modules from
GitHub Packages (ADR-0021) → **use in their own products, unlimited**. They do **not** get the right
to redistribute or resell the kit. Enforced **legally** by the EULA the `LicenseRef` points to,
**technically** by entitlement-gated registry access (ADR-0008/0010) + the AGPL contamination gate
(ADR-0022). The AGPL flank is the exception: its terms are AGPL's, not the EULA's.

## Rejected

- **Open-core Apache/MIT base** (ADR-0010's lean) — a permissive license lets buyers (and
  non-buyers) redistribute the paid kit for free; wrong for a fully-paid product. Reversed.
- **A mixed free/paid base split** — no free tier at all (except the deliberate AGPL flank);
  simpler positioning, no à-la-carte base given away.
- **`UNLICENSED`** over a named `LicenseRef` — less descriptive; `LicenseRef-Stack-Commercial`
  points at the actual EULA doc.

## Binding

Every module is `LicenseRef-Stack-Commercial` except the AGPL Local-first flank; no permissive/free
license enters the SPDX allowlist (ADR-0020); the EULA text is a separate legal artifact the
`LicenseRef` resolves to (to be drafted before first sale). The AGPL gate (ADR-0022) keeps the AGPL
flank from contaminating any commercial module.
