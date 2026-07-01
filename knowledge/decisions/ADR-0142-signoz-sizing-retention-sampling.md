# ADR-0142 — SigNoz self-host: single-node, 14-day retention, 100% head sampling

Status: accepted · 2026-06-30 (Stage-2 Stream A initiative SPEC, operator picker) · **opens the
ADR-0138 detail forks** ("SigNoz sizing / retention / sampling" + "the Worker tail→OTLP bridge") ·
**executes ADR-0117** (OTel → self-hosted SigNoz). Append-only; supersede with a later ADR, never edit.

## Context

ADR-0117 locked self-hosted SigNoz as the OTLP backend and marked provisioning DEPLOY-class; ADR-0138
put the SigNoz sizing/retention/sampling and the registry-Worker bridge mechanism open for this SPEC.
Recon (Stream A, `wf_a3f97716-bff`, `signoz-selfhost-ref`, cited) established: (a) SigNoz self-host is
now Foundry-generated (`foundryctl`); the legacy bundled compose was deprecated at v0.130.0; current is
v0.130.x. (b) **ClickHouse Keeper is effectively mandatory even single-node** — the stock schema
migrator runs with `REPLICATION=true` + a hardcoded `cluster` name forcing `ON CLUSTER` DDL +
`Replicated*` engines; dropping Keeper (`REPLICATION=false`) is an unsupported tweak. So the honest
minimum stack is **five services**, not three. (c) Real idle footprint ~1.6 GB; 4 GB is the documented
floor. (d) An **official SigNoz Railway template** exists (`railway.com/deploy/signoz`, Foundry-
regenerated, fixing the earlier `railway.internal`-FQDN and CLI-flag bugs). (e) ClickHouse TTL is the
retention knob (`ALTER TABLE ... MODIFY TTL` / the `/api/v2/settings/ttl` API); default 15d
logs/traces. (f) The registry Worker already has CF-native Workers Logs enabled; a SigNoz destination
can be reached either by a hand-rolled `tail_consumers` bridge worker (ADR-0138's literal wording) or
by the newer CF-native `[observability.traces]`/`[observability.logs]` `destinations` block (zero new
code).

## Decision

1. **Stack:** the official Foundry SigNoz **Railway template**, single-node — **five Railway services**:
   `clickhouse` (+volume), `clickhouse-keeper` (+volume), `signoz-otel-collector` (OTLP gRPC 4317 /
   HTTP 4318, TCP proxy), `signoz` UI+query-service (8080, +volume, **behind Cloudflare Access**),
   `telemetrystore-migrator` (one-shot). ClickHouse memory-capped. Sizing target: an **8 GB / 4 vCPU**
   Railway tier (4 GB is the floor, not a comfortable target).

2. **Retention: 14 days** for traces and logs (ClickHouse TTL), set via the SigNoz TTL API / `MODIFY
TTL` at provision time. (Operator picked 14d over the 7d SPEC recommendation for deeper debugging
   history.)

3. **Sampling: 100% head sampling** (no SDK sampler, no collector tail-sampling) — appropriate at the
   current low fleet volume. Tail-sampling is a documented future knob if volume grows.

4. **Registry-Worker → SigNoz bridge: CF-native `[observability.traces]`/`[observability.logs]`
   `destinations`** in `registry/worker/wrangler.toml`, pointed at a dashboard-registered SigNoz OTLP
   endpoint — **zero new code**, superseding ADR-0138's literal "tail-worker" wording. (A hand-rolled
   `tail_consumers` bridge worker was the alternative; the native path needs no TailItem→OTLP transform
   code.) Both paths need Workers Paid + a live endpoint → the wiring is config, inert until deploy.

**Stream A scope is checked-in config only** — `infra/signoz/` (service definitions, collector config,
the 14d TTL + Railway gotchas: `<svc>.railway.internal` FQDN DNS, IPv6 `::` bind, per-service volumes)
plus the `wrangler.toml` destinations block. **Nothing is provisioned or deployed** here (DEPLOY-class,
ADR-0117).

## Why

- **Use the official template, don't hand-roll the compose.** The Foundry-regenerated Railway template
  fixes the exact bugs (FQDN DNS, collector CLI flags) that burned earlier self-hosters; adapting it is
  the lazy correct path.
- **Five services is the honest single-node minimum** — pretending Keeper is optional invites a
  provisioning failure; the ADR records it so the deploy session sizes for it.
- **14d/100%-head is right-sized for a low-volume single-operator fleet** — retention is cheap at this
  volume and a fortnight of traces covers real debugging; head sampling keeps the SDK path trivial and
  the collector stateless.
- **CF-native destinations over a tail worker** — a bridge worker means writing + maintaining a
  TailItem→OTLP transform (no in-repo package does this; `@caisson/observability` is Node-SDK-shaped,
  not Workers-applicable). The native block is a `wrangler.toml` stanza + a dashboard destination. Less
  code, same result.

## Rejected

- **7-day retention** (the SPEC rec) — operator chose 14d for history depth.
- **Collector tail-sampling** — saves storage at higher volume but adds collector memory + config;
  premature at current volume.
- **Dropping ClickHouse Keeper** (`REPLICATION=false`) — unsupported in the stock Foundry template;
  not worth the fragility to save one service.
- **Hand-rolled `tail_consumers` bridge worker** — more code (a TailItem→OTLP transform) for no gain
  over the native destinations block.
- **Managed backend (Axiom/Grafana)** — already rejected by ADR-0117/0138 (self-host ethos); held only
  as the documented fallback if the ClickHouse footprint proves disproportionate.

## Confidence + revisit

**MEDIUM** — the picks are sound and cited, but the current-version (v0.130.x, Postgres-metastore +
Keeper) RAM footprint on Railway is not first-party-benchmarked; verify sizing at provision time.
Revisit the SigNoz-vs-managed choice with a superseding ADR if the ClickHouse footprint proves too
heavy for the single-operator box (ADR-0138's stated revisit trigger).

## Downstream

- Stream A A2: `infra/signoz/` template config (5 services, collector, 14d TTL, gotchas + README).
- Stream A A3: the `wrangler.toml` `[observability.traces/logs]` destinations block (inert until a
  dashboard destination + Workers Paid).
- Stream A A5: the admin ops widgets hit SigNoz `POST /api/v5/query_range` (`SIGNOZ-API-KEY` service
  account), env-gated.
- Deploy session: provision the five Railway services (order: ClickHouse + Keeper → migrator → SigNoz +
  collector), set `OTEL_EXPORTER_OTLP_ENDPOINT` on every service, register the CF dashboard SigNoz
  destination, apply the 14d TTL, lock the UI behind CF Access. Records into `docs/state/p6-deploy-runbook.md`.

Evidence: recon `signoz-selfhost-ref` + `registry-worker` (`wf_a3f97716-bff`, sourced to SigNoz docs +
the official Railway template + CF Workers observability docs); ADR-0117; ADR-0138 §3 + §"Still open".
