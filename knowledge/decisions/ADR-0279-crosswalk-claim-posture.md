# ADR-0279 — Crosswalk claim posture: mixed by proof level

**Status:** accepted · 2026-07-07 (operator-locked, fifth picker round). Refines ADR-0277
(named-regime crosswalks) with the claim-language rule those artifacts must follow.
Append-only; supersede with a later ADR, never edit. **Tags:** `security`.

## Context

ADR-0277 locks SOC 2 / PCI-DSS / GDPR crosswalk exports but not how assertive the mapping
language may be. The spectrum runs from conservative ("maps to / provides evidence toward")
through assertive ("satisfies control X when deployed as documented"). A library vendor
cannot claim regime compliance outright (PCI SSC restricts who may claim compliance; FTC
deceptive-claims exposure applies to security marketing), but a blanket-conservative posture
undersells controls the repo actually proves with live tests and CI artifacts.

## Decision

**Mixed by proof level.** Assertive language — "implements control X as documented" — is
permitted ONLY where a live test or CI artifact in this repo proves the control (the proof
must be linkable: a test file, a CI job, a live-verification harness run, an OSCAL
conformance check). Everywhere else the crosswalks use conservative mapping language
("maps to", "provides evidence toward") with an explicit not-a-certification disclaimer on
every crosswalk page and export. Never "compliant" / "certified" — Caisson is a toolmaker,
not an assessed entity.

## Consequences

- Per-claim evidence discipline: each assertive row in a crosswalk names its proof artifact;
  a row that loses its proof (test deleted, job removed) must drop to conservative language
  in the same change.
- The Track C build (crosswalk data + export routes) encodes the claim level per mapping row
  so exports render the right language mechanically, not editorially.
- The claim-language research memo (followups leg, in flight) supplies the disclaimer text
  patterns and the exact vendor-safe phrasings; its recommendations slot into this posture
  rather than reopening it.
- Copy laws (ADR-0080/0237) still bind site prose; this ADR governs the crosswalk artifacts
  and any page that renders them.
