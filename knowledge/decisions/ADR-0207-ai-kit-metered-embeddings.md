# ADR-0207 — ai-kit gains a buyer-facing metered embeddings surface (+ the fetch-deadline floor fix)

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope lock).
**Relates:** ADR-0059 (gateway chokepoint), ADR-0182/0198 (BYOK 0-credit + per-action allowlist),
ADR-0201 (live transports), ADR-0096 (the services/docs embedder that stays put), ADR-0133 (ai-kit
clean-lift: fetch/provider/embeddings).

## Context

Two gaps from the reconcile. (1) The live provider transports violate the repo-wide fetchWithTimeout
floor: no provider factory receives a deadline-wrapped `fetch`, and `infer()`'s `generateText` carries no
abortSignal — an outbound call can hang unbounded. (2) The only real embeddings client in the repo is
marooned in `services/docs` (internal corpus concern, raw unmetered HTTP); a Caisson buyer has no
embeddings path through the metered gateway the way `infer()`/`inferStream()` are reached.

## Decision

1. **Fetch deadline floor:** every provider factory gets a deadline-wrapped fetch and every gateway call
   an abort deadline (configurable `timeoutMs`, sane default). This is hygiene against an existing floor,
   not a new decision — recorded here because it lands in the same package wave.
2. **Metered embeddings:** `embed()`/`embedMany()` join the gateway through the SAME ai-meter chokepoint
   (reserve-before/reconcile-after), provider-agnostic via the ai-config lane, BYOK-routed (tenant-key
   embedding calls follow the ADR-0198 allowlist semantics). Embedding token pricing enters the pricebook
   as action-pricing _config_; pricebook _code_ changes, if any prove unavoidable, belong to the ADR-0206
   serialized wave.
3. **`services/docs` embedder stays where it is** — it consumes local-store's Embedder port for the
   internal docs corpus; the buyer-facing surface is a separate, metered concern.

## Rejected

- **Move the services/docs embedder into ai-kit** — couples an internal deploy seam to a sold edition's
  release cadence and re-fights ADR-0096's deployed, working wiring.
- **Unmetered embeddings passthrough** — every buyer-reachable model call goes through the ADR-0059
  chokepoint; an unmetered path is a billing leak by construction.
