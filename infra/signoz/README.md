# infra/signoz — self-hosted SigNoz (ADR-0142)

Checked-in IaC for the Caisson fleet's observability backend: a **single-node SigNoz** stack
(traces + logs + metrics over OpenTelemetry) the operator's admin control-plane
(`admin.caisson.sh`, ADR-0138) queries.

> **This directory provisions nothing on its own.** It is the source of truth the **DEPLOY
> session** applies — there is no live stack here. On Railway the stack is stood up from the
> official Foundry-regenerated **SigNoz Railway template** ([railway.com/deploy/signoz](https://railway.com/deploy/signoz));
> `docker-compose.yaml` is the 1:1 local/reference mirror of that service graph, and
> `otel-collector-config.yaml` is the ingester's bootstrap config. Nothing runs until DEPLOY.

## Topology — 5 services

Stock SigNoz is 5 services and **Keeper is mandatory**: with `REPLICATION=true` the schema
migrator issues `ON CLUSTER` DDL and creates `ReplicatedMergeTree` tables even on a single
node, which require a coordinator. Keeper is ClickHouse's ZooKeeper-protocol replacement.

| Service                          | Role                                                             | Port(s)                       | Volume                          | Railway notes                                       |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------- | ------------------------------- | --------------------------------------------------- |
| `clickhouse-keeper`              | RAFT coordination for replicated DDL/tables                      | 9181 (client), 9234 (raft)    | `/var/lib/clickhouse-keeper`    | stateful → needs a Volume                           |
| `clickhouse`                     | telemetry store (traces/logs/metrics)                            | 9000 (native), 8123 (http)    | `/var/lib/clickhouse`           | stateful → needs a Volume; memory-capped            |
| `signoz-telemetrystore-migrator` | one-shot: bootstrap + migrate the ClickHouse schema, then exit 0 | —                             | —                               | run-to-completion job                               |
| `signoz`                         | UI + query-service                                               | **8080**                      | `/var/lib/signoz` (SQLite meta) | the only public port → **behind Cloudflare Access** |
| `signoz-otel-collector`          | OTLP ingester → writes ClickHouse                                | **4317** gRPC / **4318** HTTP | —                               | needs a **TCP Proxy** for external senders          |

Note on the migrator image: ADR-0142 names it `telemetrystore-migrator`. In current SigNoz
(v0.144.x) the standalone `signoz/signoz-schema-migrator` image was **folded into the
collector binary** — the migrator runs the same `signoz/signoz-otel-collector` image with
`migrate bootstrap && migrate sync up && migrate async up`. Same role, one fewer image to pin.

### Pinned images (recon-current, 2026-06-30)

- `clickhouse/clickhouse-server:25.5.6`
- `clickhouse/clickhouse-keeper:25.5.6`
- `signoz/signoz-otel-collector:v0.144.5` (ingester **and** migrator)
- `signoz/signoz:v0.130.1` (UI + query-service — latest release)

## Deploy order

`depends_on` in the compose encodes this; the DEPLOY session brings the Railway services up in
the same sequence:

1. **`clickhouse-keeper`** → healthy (`ruok`/`imok` on 9181).
2. **`clickhouse`** → healthy (`/ping` on 8123), connected to keeper via the `<zookeeper>`
   block in `config.d/cluster.xml`.
3. **`signoz-telemetrystore-migrator`** → runs bootstrap + sync + async migrations, exits 0.
4. **`signoz`** + **`signoz-otel-collector`** → start only after the migrator completes.

**Verify before declaring healthy** — no replicated table should be read-only (a misconfigured
keeper connection is the usual single-node failure). Against ClickHouse:

```sql
SELECT database, table FROM system.replicas WHERE is_readonly;
```

Must return **zero rows**. Non-empty → keeper is unreachable or the `<zookeeper>` node in
`cluster.xml` is wrong; fix before pointing the fleet at the ingester.

## Railway gotchas (the ones that bite)

- **Inter-service DNS must be the FQDN `<service>.railway.internal`.** A bare hostname
  (`clickhouse`) silently fails to resolve on Railway's private network. The collector reaches
  ClickHouse at `clickhouse.railway.internal:9000`, the signoz service the same, etc. (In the
  local compose the plain service names resolve, so the compose uses `clickhouse` — swap to the
  `.railway.internal` FQDNs when transcribing to Railway service variables.)
- **Bind to `::` (IPv6 dual-stack).** Railway private networking is IPv6. Every listener must
  bind `::` / `0.0.0.0`+IPv6, not `127.0.0.1`. The collector receivers already bind `0.0.0.0`;
  ClickHouse + Keeper set `<listen_host>::</listen_host>` in their configs. A loopback bind is
  unreachable from sibling services.
- **Each stateful service needs a Railway Volume** at the mount path above
  (`/var/lib/clickhouse`, `/var/lib/clickhouse-keeper`, `/var/lib/signoz`). No volume → data is
  lost on redeploy.
- **The collector needs a TCP Proxy only for EXTERNAL senders.** Same-project senders (all the
  Caisson services) reach it over **private networking** — no proxy, no public exposure. Add a
  TCP Proxy on 4317/4318 only if something outside the Railway project must ship telemetry.

## Sizing

- **8 GB / 4 vCPU tier** (ADR-0142). ClickHouse is the memory-hungry service.
- **Cap ClickHouse memory** so it can't OOM the node: `max_server_memory_usage_to_ram_ratio`
  = `0.8` is set in `cluster.xml` (the ClickHouse-native soft cap). For local docker the hard
  equivalent is the commented `mem_limit` on the `clickhouse` service.

## Retention — 14 days (traces AND logs)

ADR-0142 locks **14-day** retention for traces and logs via ClickHouse TTL. The new-schema
tables (`use_new_schema: true`) have **no compose-env TTL knob** — apply it **post-boot**, once
the migrator has created the tables. Two equivalent paths:

- **SigNoz TTL API** (preferred — sets it through the query-service so the UI reflects it):
  ```
  POST http://<signoz>:8080/api/v2/settings/ttl?type=traces&duration=336h
  POST http://<signoz>:8080/api/v2/settings/ttl?type=logs&duration=336h
  ```
  (336h = 14d. Applies to newly-ingested data only.)
- **Direct ClickHouse ALTER** (fallback):
  ```sql
  ALTER TABLE signoz_traces.signoz_index_v3
    MODIFY TTL toDateTime(timestamp) + INTERVAL 14 DAY;
  ALTER TABLE signoz_logs.logs_v2
    MODIFY TTL toDateTime(timestamp) + INTERVAL 14 DAY;
  ```
  (Exact table names track the migrator's schema version — prefer the API so SigNoz stays the
  source of truth. Metrics retention is left at the SigNoz default; only traces+logs are locked.)

## Sampling — 100% head, no tail sampling

Per ADR-0142 there is **no SDK sampler override and no collector tail-sampling**. The head
decision (emit a span at all) stays at the SDK default (100%, `parentbased_always_on`); the
collector config carries only a `batch` processor. Retention (TTL), not sampling, is the volume
control. Do not add a probabilistic/tail sampler unless the ADR's cost math changes.

## Cloudflare Access gate (UI)

The SigNoz UI/query-service (port 8080) is **operator-only** and reuses the existing
Cloudflare Access posture (**ADR-0107**, the same email-OTP `@gridwork.dev` gate as the site's
pre-launch wall). On Railway: expose 8080 on the signoz service's public domain, front it with
the `signoz.*` (or `observability.*`) hostname in the Caisson zone, and attach a Zero-Trust
Access application + policy — model it on `infra/terraform/access.tf`. The collector ports
(4317/4318) are **never** publicly exposed; they stay on private networking.

## How the fleet points at it

Every instrumented Caisson service (support-bot, the Worker's forwarder, the admin app, etc.)
exports OTLP to the ingester's **private** domain:

```
OTEL_EXPORTER_OTLP_ENDPOINT = http://signoz-otel-collector.railway.internal:4317
OTEL_EXPORTER_OTLP_PROTOCOL = grpc
```

Same-project → private networking → no TCP proxy, no public surface. gRPC on 4317 (HTTP on
4318 for senders that need it). This is the one variable each service sets; it is env-gated
inert everywhere — unset means the SDK no-ops, so a service with no endpoint configured never
throws.

## Files

- `docker-compose.yaml` — the 5-service reference stack (inline ClickHouse cluster + keeper
  configs, volumes, healthchecks, deploy-order `depends_on`).
- `otel-collector-config.yaml` — the ingester bootstrap: OTLP receivers → `batch` → ClickHouse
  exporters for traces/logs/metrics. No sampler.
- `README.md` — this file.

_Adapted from the official SigNoz Railway template (railway.com/deploy/signoz, Foundry-regenerated)
and the upstream `SigNoz/signoz` `deploy/docker` compose (main, v0.130.1 / collector v0.144.5).
Keeper is used in place of the upstream ZooKeeper, matching the Railway template._
