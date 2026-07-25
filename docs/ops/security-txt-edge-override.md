---
updated: 2026-07-25
status: live
grounds:
  - apps/site/public/.well-known/security.txt
  - infra/terraform/waf.tf
  - infra/terraform/main.tf
  - infra/terraform/web-analytics.tf
---

# `/.well-known/security.txt` edge override (live defect)

`GET https://caisson.sh/.well-known/security.txt` does not serve this repo's file. Cloudflare
answers the GET directly at the edge, before the request reaches Railway. This is dashboard
config drift, not a deploy problem — a redeploy of `caisson-site` cannot fix it, because the
origin already serves the correct file and the request never reaches the origin. No redeploy has
ever been attempted against this defect; the 2026-07-11 `caisson-site` redeploy on record
(`docs/deploy/STATE.md`, browser-audit remediation wave, PRs #205-207) was for unrelated UI
fixes and never touched `.well-known`.

## Reproduction (2026-07-25, this session)

```
$ curl -sS -D - -o /dev/null https://caisson.sh/.well-known/security.txt
HTTP/2 200
content-type: text/plain; charset=utf-8
content-length: 89
server: cloudflare
cf-ray: a20e8884cdab163a-ATL
# no x-railway-request-id, no content-security-policy, no x-railway-edge

Contact: mailto:admin@gridwork.dev
Expires: 2027-06-30T00:00:00Z
Preferred-Languages: en
```

```
$ curl -sS -I https://caisson.sh/.well-known/security.txt
HTTP/2 200
content-type: text/plain; charset=UTF-8
content-length: 331
content-security-policy: default-src 'self'; base-uri 'self'; ...
last-modified: Sun, 28 Jun 2026 14:07:54 GMT
x-railway-request-id: YXX5-62ATraWtyjWn6XIxQ
x-railway-edge: atl1
server: cloudflare
```

GET returns a 3-field, 89-byte body with a `gridwork.dev` contact and no Railway/CSP headers —
it never reached the origin. HEAD returns the repo's real 331-byte file, full CSP, and
`x-railway-request-id` — it passed straight through to Railway. Same path, same edge, two
different answers depending on HTTP method: the intercepting feature only implements GET.

## Mechanism — most likely candidate

**Cloudflare's managed Security.txt feature** (Security → Settings → Security.txt in the
dashboard, sometimes listed under Security Center). This feature stores an operator-entered
contact/expiry and serves it directly from Cloudflare's edge at
`/.well-known/security.txt`, independent of any origin, DNS record type, WAF rule, or
Terraform-managed ruleset. Confidence: high.

Reasoning:

- The GET response is exactly RFC 9116's minimum shape (`Contact`/`Expires`/
  `Preferred-Languages`, no `Policy`, no `Canonical`) — the fields this dashboard form
  collects, nothing more. The repo's file carries `Policy:` and `Canonical:` too; those
  aren't fields the managed feature has a slot for.
- The contact (`admin@gridwork.dev`) is a real, plausible personal/operator address from
  before the caisson.sh domain existed — consistent with someone filling in this toggle
  early and never returning to it once `apps/site` grew its own file.
- The method split (GET intercepted, HEAD passed through) matches how this feature is known
  to behave: it's a body-serving override bolted onto the edge, not a full virtual origin —
  it answers GET and lets everything else (HEAD, and any other path) fall through to Railway.
- No redirect/transform rule, Worker route, or cached-asset explanation fits the HEAD/GET
  split: a Redirect Rule or Page Rule redirect would 30x both methods identically; a
  cache-static-asset hit would carry `cf-cache-status: HIT` (this GET response has no
  `cf-cache-status` header at all, unlike the HEAD response's `cf-cache-status: DYNAMIC` —
  the GET didn't even enter the cache subsystem, it was answered by a feature that sits
  ahead of caching); a Worker route intercepting the path would also intercept HEAD unless
  deliberately coded to special-case methods, which is a strange thing to hand-write for a
  static file and unsupported by any other evidence.

Other candidates considered and set aside: a Cloudflare Redirect Rule / Transform Rule / Page
Rule scoped to the path (would affect both methods identically, or would show as a redirect,
not a 200 with a different body); a Worker route (same method-symmetry argument, plus no
Worker script in this repo touches this path — see below); a stale cached asset (would carry
a `cf-cache-status` header and an `age`/matching `etag` to the origin's, neither present).

## Repo / Terraform check

```
$ grep -rniE "security\.txt|well-known|ruleset|snippet|page_rule" infra/terraform
```

No hit names `security.txt`, `.well-known`, a Page Rule, a Redirect/Transform Rule, or a
Worker route for this path. The only `cloudflare_ruleset` resources in the repo are
`waf_free_managed` and `rate_limit` in `infra/terraform/waf.tf` (zone-level WAF + rate
limiting — unrelated to this path) and the Web Analytics injection ruleset in
`infra/terraform/web-analytics.tf` (RUM beacon injection, also unrelated). The managed
Security.txt feature itself is an account/zone dashboard toggle with no corresponding
resource in the `cloudflare` Terraform provider — it cannot be expressed in this repo's IaC
even if someone wanted to.

**Conclusion: this is out-of-band dashboard drift, not something `infra/terraform/` can fix.**
The fix is a manual dashboard change; nothing in this repo's `apply` will touch it.

## Operator fix — dashboard navigation, in priority order

1. **Cloudflare dashboard → caisson.sh zone → Security → Settings → Security.txt** (or
   **Security Center → Security.txt**, naming varies by dashboard version). This is the
   primary suspect per the reasoning above.
   - If a Security.txt entry exists and is **Enabled**: either **disable** it (let every
     request fall through to Railway's real file) or **edit its Contact field** to
     `mailto:security@caisson.sh` and align `Expires` to match the repo's file
     (`2027-06-27T00:00:00Z`). Disabling is the safer choice — the origin file is the
     canonical one and already correct; keeping two independent copies in sync is a second
     place this can drift again.
2. If step 1 shows no Security.txt entry (feature not present in this account's Security tier):
   **caisson.sh zone → Rules → Overview** (Redirect Rules, Transform Rules, Page Rules) —
   check for any rule matching `/.well-known/security.txt` or `/.well-known/*` and remove or
   fix it.
3. If step 2 is also empty: **caisson.sh zone → Workers Routes** — check for a route matching
   `caisson.sh/.well-known/*` or `caisson.sh/*` bound to a Worker, and inspect that Worker's
   script for a security.txt special-case.
4. If none of the above show anything: **Caching → Configuration → Purge Cache** (purge
   everything for this path) in case of a wrongly-cached edge response the above steps didn't
   surface — then re-test.

## Verification (GET only — HEAD gives a false pass)

```
curl -sS https://caisson.sh/.well-known/security.txt
```

Expect the repo's real body (`Contact: mailto:security@caisson.sh`, plus `Policy:` and
`Canonical:` lines) and, if you check headers with `-D -`, `x-railway-request-id` present.
**Do not verify with `curl -I`** — HEAD already returns the correct file today and will show
green regardless of whether the GET-path override is still live; that gap is exactly what let
this defect ship unnoticed since 2026-06-27.

## Stakes

A commercial compliance product is currently publishing a stranger's personal email address as
its security contact to every automated vulnerability-disclosure scanner and researcher that
fetches this well-known path with GET, and that same response is also missing RFC 9116's
`Policy` and `Canonical` fields the repo's real file carries.
