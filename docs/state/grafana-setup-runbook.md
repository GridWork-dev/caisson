# Grafana Cloud — operator UI setup runbook

The parts of the Grafana Cloud observability stack that **can't** be driven by the account API key /
`grafanactl` and need operator clicks in the console. Everything the box can automate (env repointing,
OTLP ingestion, dashboard-as-code) is already done or scripted; this file is only the console-only tail.

**Stack:** `caisson.grafana.net` · region `prod-us-west-0` · instance ID `1709803`
**Role:** sole OTLP sink for all 5 Railway services (site, admin, license, docs, support-bot) — ADR-0177.
**Credentials (already in `~/.gridwork/env`, already on the services):**

- `GRAFANA_OTLP_ENDPOINT` / `_INSTANCE_ID` / `_TOKEN` (`glc_…` Cloud Access Policy — ingestion)
- `GRAFANA_SERVER` / `GRAFANA_TOKEN` (`glsa_…` service account — `grafanactl` + datasource-proxy queries)

## Already done (no clicks needed)

- **Data sources** — Grafana Cloud auto-provisions them: `grafanacloud-traces` (Tempo), `grafanacloud-logs`
  (Loki), `grafanacloud-prom` (Mimir/Prometheus). No manual datasource config.
- **OTLP ingestion** — the 5 services POST to `https://otlp-gateway-prod-us-west-0.grafana.net/otlp` with
  `Basic 1709803:glc_…`. Verified: a probe span landed in Tempo.

## 1. Confirm data is flowing (2 min) — do this first

1. `caisson.grafana.net` → left nav **Explore**.
2. Datasource dropdown → **grafanacloud-traces**.
3. Query type **Search** (TraceQL) → paste `{}` → **Run query**. You should see recent traces. To scope
   to one service: `{ resource.service.name = "service-docs" }` (others: `service-license`, `site`,
   `admin`, `caisson-support-bot`).
   - _Note:_ docs/license run on `Bun.serve`, which OTel's `node:http` instrumentation bypasses — so their
     **inbound** request spans may not appear, but **outbound** fetch (`Undici`) + **Postgres** (`Pg`) spans
     do. site/admin (Next.js on the Node runtime) trace inbound normally.
4. Switch datasource to **grafanacloud-logs**, query `{service_name="service-docs"}` to confirm logs.

## 2. Contact point — where alerts go (one-time, 3 min)

1. Left nav **Alerting → Contact points → + Add contact point**.
2. Name `caisson-ops`. Integration **Email** → address `admin@gridwork.dev` (or a Slack/Discord webhook
   if you'd rather — Discord: integration **Webhook**, URL = a Discord channel webhook).
3. **Save** → **Test** to confirm delivery.
4. **Notification policies** → edit the **Default policy** → set default contact point to `caisson-ops`.

## 3. Alert rules — the ones worth having pre-launch (10 min)

Grafana **Alerting → Alert rules → + New alert rule**. Each: pick datasource, paste the expression, set
the threshold, attach contact point `caisson-ops`. Suggested starter set:

| Rule               | Datasource                    | Expression                                                             | Fire when                            |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| **Service down**   | grafanacloud-prom             | `up{job=~"caisson.*"}` (or synthetic-check probe)                      | `== 0` for 5m                        |
| **5xx spike**      | grafanacloud-traces → metrics | `traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}` rate | `> 0.05 req/s` for 5m                |
| **Latency p95**    | grafanacloud-traces → metrics | `histogram_quantile(0.95, traces_spanmetrics_latency_bucket)`          | `> 2s` for 10m                       |
| **Log error rate** | grafanacloud-logs             | `count_over_time({service_name=~"caisson.*                             | service.*"} \|= "level=error" [5m])` | `> 20` in 5m |

_Ponytail: 4 rules cover the pre-launch surface (up / errors / latency / log-errors). Add per-route SLOs
and credit/billing-specific alerts when there's real traffic to threshold against._

## 4. Dashboards (optional, 5 min)

Two paths:

- **Fast:** left nav **Dashboards → + Import** → dashboard ID **19419** ("OpenTelemetry APM") or **17761**
  ("OpenTelemetry Collector"). Pick datasource `grafanacloud-prom` / `grafanacloud-traces` when prompted.
- **As-code (box-drivable):** `grafanactl` reads `GRAFANA_SERVER`+`GRAFANA_TOKEN` from env — dashboards can
  be pushed with `grafanactl resources push dashboard --path <file.json>`. Ask and I'll generate a
  service-overview dashboard JSON and push it, so this step becomes zero-click.

## 5. Retention / billing sanity (1 min)

Free tier: 50 GB logs + 50 GB traces + 10k metrics series, 14-day retention. Left nav **Administration →
Cost management** (or **Billing/Usage**) to watch volume. Pre-launch this is ~$0; revisit when traffic is
real. No action now.

---

**What stays on the box (I own these — no operator action):** OTLP env on every service, ingestion auth,
the cutover itself, dashboard-as-code pushes (if you want them), and querying Tempo/Loki via the
datasource proxy for verification. Only §§1-3 above are genuinely console-only.
