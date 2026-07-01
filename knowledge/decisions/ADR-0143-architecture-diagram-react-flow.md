# ADR-0143 — live architecture diagram: client-side interactive (React Flow)

Status: accepted · 2026-06-30 (Stage-2 Stream A initiative SPEC, operator picker) · **opens the
ADR-0138 detail fork** ("the diagram render tech") · **implements ADR-0138 §4** (the hybrid
auto-topology + hand-annotation mandate). Append-only; supersede with a later ADR, never edit.

## Context

ADR-0138 §4 mandated a **hybrid** live architecture diagram: auto-derived service/deploy topology
(Railway service graph + deploy manifests + health-probe liveness + `graphify` code structure) **plus**
hand-authored annotations/legend for intent the topology can't express — and left the render tech open.

## Decision

**Client-side interactive React Flow.** `apps/admin/app/architecture/*` renders the fleet graph as an
interactive React Flow canvas with pan / zoom / click-through. The **auto-topology half** is derived by
parsing the in-repo `*/railway.toml` service definitions + health-probe liveness (+ optional `graphify`
structure) into `{nodes, edges}`; the **annotation half** is a versioned in-repo data file (intent
labels, trust-boundary groupings, legend) merged over the auto-derived graph. Nodes deep-link to the
relevant surface (SigNoz UI for a service's traces, the Railway service, the owning package).

(Operator picked React Flow over the SPEC's server-rendered dagre/Mermaid SVG recommendation, for
interactive exploration of the topology.)

## Why

- **Interactive exploration is the operator's stated want** — pan/zoom/click-through over a static SVG
  for a graph that will grow as the fleet does.
- **Still honors the hybrid mandate** — auto-derived structure keeps the "live" half accurate,
  regenerated from the manifests + probes; the versioned annotation layer supplies intent. React Flow
  changes only the _render_, not the hybrid data model.
- **`apps/admin` is already a React/Next app** — React Flow is a client component in a surface that is
  operator-only (CF-Access-gated, ADR-0140), so the heavier bundle is paid only by the operator, not any
  buyer-facing page.

## Rejected

- **Server-rendered dagre/Mermaid SVG** (the SPEC rec) — cheaper + no client bundle, but static; the
  operator chose interactivity. Held as the fallback if the React Flow bundle/complexity proves not worth
  it for a single-operator read surface.
- **Pure auto-generated or pure hand-drawn** — already rejected by ADR-0138 §4 in favor of the hybrid.

## Confidence + revisit

**MEDIUM** — React Flow cleanly satisfies the interactive want and the hybrid data model is render-tech
agnostic, but it adds a client dependency + bundle to `apps/admin`. Revisit (→ server-SVG) only if the
bundle/maintenance cost outweighs the interactivity for a single operator.

## Downstream

- Stream A A6: the topology deriver (`*/railway.toml` + health-probe → `{nodes, edges}`), the versioned
  annotation data file, and the React Flow canvas under `apps/admin/app/architecture/*`.
- `apps/admin/package.json` gains a React Flow dependency (operator-only surface).

Evidence: recon `build-state-adr-board` (`wf_a3f97716-bff`); ADR-0138 §4 (hybrid mandate).
