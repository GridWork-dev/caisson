# ADR-0375 — Visual-remediation closeout locks (2026-07-22, four operator answers)

Status: accepted
Date: 2026-07-22

## Context

The ADR-0374 overnight remediation wave (PR #319) carved out four operator forks per
RUN-AUTH's fix-forward policy. All four were put to the operator the following morning
in one picker round; every answer chose the fuller option. This ADR records the locks;
the closeout wave (`fix/vr-closeout`) implements them.

## Locks

1. **Em-dash copy law → ADOPTED (extends ADR-0080).** Buyer-facing shipped prose —
   marketing pages, docs content, legal pages, glossary/comparison copy, email
   templates, admin UI copy — does not use em dashes as clause breaks; sanctioned
   constructions are comma, colon, semicolon, period, and parentheses. Exempt: internal
   repo prose (ADRs, docs/state, code comments), code samples, and the em-dash
   null-price UI glyph convention. Resolves the audit's cross-surface em-dash class;
   the SPEC's original attribution of this rule to ADR-0080 was incorrect (ADR-0080
   carried no such law until this extension); the rule origin is the audit skill's
   craft floor, now repo law.
2. **Accent-eyebrow budget → ONE PER PAGE (extends ADR-0078 §the accent slot).** The
   hero carries the page's single accent-treated eyebrow; subsequent sections use plain
   titles (or a muted, non-accent kicker where hierarchy demands one). This promotes
   the glossary-page precedent shipped in the ADR-0374 wave to a site-wide rule and
   resolves the audit's eyebrow-repetition class the audit and the prior brand reading
   disagreed on. Accent spend inside a single viewport follows the same restraint
   (primary CTA + eyebrow; demote incidental accent uses).
3. **Legal conspicuousness → BOLD+CONTRAST, NOT CAPS.** The warranty/liability
   ALL-CAPS walls are restyled to sentence case with bold weight plus a distinct
   set-off treatment satisfying the conspicuousness convention (contrasting type set
   off from surrounding text). Wording unchanged, styling only. Rider: counsel reviews
   the restyled paragraphs before the next legal-page copy change ships.
4. **Component tail → BUILT NOW (ops-level, recorded for the ledger).** Admin mobile
   nav gains a real collapse disclosure; the marketplace stack-builder docks as a
   bottom bar at mobile; the header CTA dedupes against identical hero CTAs; the docs
   search palette completes its ARIA tab pattern, gains a touch close control, and a
   static suggested-pages default state (no persistence).

## Consequences

- The design-critic rubric and the brand floor now agree on em dashes and eyebrows —
  the two classes stop re-flagging on every audit.
- The remaining ADR-0374 carve-out families (harness artifacts, the F7 vendor-chunk
  console item, deliberate legal measure rows) close as `accepted` at the post-deploy
  reconcile; everything else in the closeout wave closes as fixed by re-audit.
- ADR-0080 and ADR-0078 remain the canonical copy/brand documents; this ADR extends
  both without superseding any other clause.
