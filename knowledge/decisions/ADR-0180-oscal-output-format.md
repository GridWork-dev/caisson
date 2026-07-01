# ADR-0180 — OSCAL output format: JSON primary + oscal-cli XML converter

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0058**
(deterministic evidence pack, JSON `canonicalize` path), **ADR-0179** (version binding). Append-only;
supersede with a later ADR, never edit. **Tags:** `compliance`.

## Context

The export emits JSON, matching the evidence-pack `canonicalize` byte-stable path. OSCAL is a dual-format
standard (JSON + XML); GRC/FedRAMP tooling commonly ingests XML. The research brief is explicit: **do not
hand-roll the converter** — NIST ships canonical per-model XSLT converters
(`oscal_<model>_json-to-xml-converter.xsl`) runnable via `oscal-cli convert`; reimplementing XML↔JSON parity
in TS is unnecessary risk (research pitfall #7).

## Decision

**JSON primary + an `oscal-cli`-driven XML converter output path.** XML is a first-class output, not a
deferred buyer-side seam:

- JSON stays the canonical, byte-stable output of the core lib (ADR-0058 `canonicalize` contract, unchanged).
- Add an XML output path that runs NIST's canonical `oscal_<model>_json-to-xml` XSLT via `oscal-cli convert`
  to emit XML alongside the JSON. Never hand-roll a TS XML serializer (research pitfall #7).
- The Java/Docker dependency `oscal-cli` needs lives in the **export tooling**, not the core lib runtime —
  the deterministic JSON path carries no new dependency.
- CI runs a **round-trip test: JSON → XML (via `oscal-cli convert`) → `oscal-cli validate`** at the locked
  version (ADR-0179), proving the XML output is conformant and parity-safe.

## Consequences

- New dependency (`oscal-cli`, Java/Docker) in the export tooling + CI only — the core lib runtime is
  untouched and stays inside the deterministic JSON `canonicalize` contract (ADR-0058).
- Adds the XML converter step to the OSCAL build (T-OSCAL-4) + the JSON→XML→validate round-trip CI gate.
- Both outputs are versioned by ADR-0179 — the converter runs the locked-version XSLT.
