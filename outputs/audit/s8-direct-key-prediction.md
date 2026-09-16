# S8 direct application-key prediction — recorded before measurement

## R314 measured disposition

The [companion receipt](release-train-2026-09-receipt.md) now contains all eight matching application-reaching observations at `a386502af2f037d59078d5382ae617fc027f1a1a`, across the two ruled license deployments and one site deployment. Verdict: no defect in the measured per-client keying scope, with the two-header forged set below. The original three-header edge refusal is preserved separately. Instance IDs were not exposed by the bounded log interface; peer reviewers never ran. The earlier predictions below are retained as written-before-measurement evidence. No removal or release is authorized by this completed observation.

## R313 prospective correction — before site arms

R313 (EST-ASK-272, 2026-09-14) removes client-supplied CF-Connecting-IP from every future forged arm. Send only X-Real-IP `203.0.113.91` and X-Forwarded-For `198.51.100.92, 198.51.100.93`; normal arms add neither. For the coming site deployment at `a386502af2f037d59078d5382ae617fc027f1a1a`, predict all four responses are application HTTP 403 with `challenge_failed`, and direct Ask AI IP A `2600:1702:7e60:3c0::31` / B `45.17.0.122`, unchanged between each client's normal and two-header forged arm. Execute only after S8_SITE_LIVE and successful exact-revision health verification, in A-normal, A-forged, B-normal, B-forged order. Preserve the existing marker UUIDs. License remains held after its closed window; no remaining license request is authorized by this preparation.

The original three-header prediction below is historical and superseded for future forged requests. Its license A-forged response was the separately recorded edge refusal; A-normal's direct key is now measured in the companion receipt. Do not rewrite that historical request as a two-header probe.

Date: 2026-09-10. Authority: the operator's ruling to observe the application key directly, accepting a demonstrated correct per-client key as a no-defect outcome. The unchanged R203 boundary reserves deployment dispatches to the operator.

The previous receipt updates are committed in `8950afe3`. No direct application-key measurement has run.

## Source trace

- `apps/site/lib/ask-ai/handler.ts:127`: choose trimmed X-Real-IP when nonempty, else the first trimmed XFF hop, else empty string. The resulting `ip` is passed to `verifyTurnstile` at line 165. This is an IP resolution seam, not an IP token bucket.
- `services/license/src/app.ts:600`: pass `clientIp(req)` as the second argument of `deps.limiter.check(bucket, ...)`. `/issue` selects bucket `issue` before the Bearer check.
- `services/license/src/rate-limit.ts`: the adapter imports the shared `clientIp` and extends the shared class without overriding `check`.
- `packages/rate-limit/src/token-bucket.ts:77`: `check(bucket, ip)` passes `${bucket}|${ip}` to `#charge`; line 89 uses that exact key in the private entries map. `clientIp` chooses trimmed X-Real-IP or `unknown`.
- `apps/site/lib/tenant-evidence-rate-limit.ts:34`: key `tenant-proof|<accountId>` and independent `global|tenant-proof` ceiling. The argument is an account identity, not a forwarded IP.
- `apps/site/lib/ask-ai/escalate-throttle.ts:44`: duplicate key SHA-256 of trimmed, lowercased, whitespace-collapsed question; independent global count. Not a per-IP limiter.
- `apps/site/lib/demos-proxy.ts:37`: XFF is stripped; all `cf-*` headers are stripped in `upstreamHeaders`; X-Real-IP is copied by that function. This is a forwarding seam, not a token bucket.
- `apps/site/app/api/waitlist/route.ts:87`: first trimmed XFF hop becomes Turnstile `remoteip`. Not a token bucket.

## Prediction

For a real-edge request from the same host and IPv6 egress as the previous measured probes:

1. The license limiter will charge exactly **`issue|2600:1702:7e60:3c0::31`**, not `issue|unknown` and not a Worker-egress key. Its unsigned `/issue` request will return HTTP 401 after the charge.
2. The site's Ask AI helper will resolve exactly **`2600:1702:7e60:3c0::31`**. A valid question body with no challenge token will then return HTTP 403 before session, database, retrieval, model, or escalation work.
3. Supplying forged X-Real-IP `203.0.113.91`, XFF `198.51.100.92, 198.51.100.93`, and CF-Connecting-IP `203.0.113.94` will not change the selected license key or Ask AI IP on the real edge.
4. A second independently measured client egress B should produce `issue|<B>` and Ask AI IP `<B>`, distinct from A. The exact B value must be observed at ingress and recorded here **before** sending its application probe; no unknown value is a completed prediction.

The IPv6 prediction is tied to the prior actual ingress observation. Recheck that ingress immediately before application measurement. An unexpected change is a stop, not permission to rewrite the prediction after observing the key.

## Required evidence and decision

Capture the actual `key` variable passed to the shared limiter's private map operation, scoped to an identified probe request. Capture the actual `ip` passed to Ask AI's Turnstile dependency. Bind observations to deployed source, service, timestamp and probe marker. Proxy `srcIp`, synthetic local Requests, and reconstructed keys alone do not satisfy this measurement.

After direct A/B observations and forged-header checks match their recorded predictions, close task 1 as **NO DEFECT: per-client keying demonstrated**, with the measured deployment/client scope stated. Do not change header precedence or write a bug-fix changeset. Remove temporary observation code before any release cut.

An unexpected key, response, failed gate or authority denial triggers the existing stop rule. Do not manufacture traffic volume to exhaust a production bucket. No branch deletion is authorized.

## Execution status

### R277 client B ingress and exact prediction — before application probes

At `2026-09-11T01:56:49.956764+00:00` (September 10 in the operator's timezone), a forced-IPv4 GET of `https://caisson.sh/cdn-cgi/trace` returned HTTP 200 and actual ingress **45.17.0.122**. Trace User-Agent: `s8-ingress-b-20260910-ipv4`. Client B is a separate IPv4 connection from the same physical host as client A; it supplies a distinct network identity, not an independent device or network operator.

Recorded now, before any client B application request: the exact predicted license key is **`issue|45.17.0.122`**, and the exact predicted Ask AI Turnstile IP is **`45.17.0.122`**. Both normal and forged-header arms are predicted to select those same values, with unsigned license HTTP 401 and missing-challenge Ask AI HTTP 403. The fixed B markers remain `ececae63-b992-4c4f-96fe-ee080b7de94d` and `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da`.

No license or Ask AI probe was sent. The trace is an ingress observation only. Recheck the recorded ingress before any later authorized application probe; an unexpected address change is a stop. R277 authorizes PR preparation, not merge or deployment. Neither application's direct value is measured by this record.

PREDICTED, NOT MEASURED. The inspected service responses and request-span wrapper do not expose the private key. R277 authorized preparing diagnostic PR #476 at `aa71ff4e911250a5e9804e5b2c541a15d90a3c4c`; no live instrumentation, application probe, restart or deployment is authorized by this prediction record. No peer review ran.
