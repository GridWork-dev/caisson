# @caisson-sh/demos

## 0.2.1

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [304851a]
- Updated dependencies [e58ddc3]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2
  - @caisson-sh/audit-worm@2.2.6
  - @caisson-sh/field-crypto@1.1.4
  - @caisson-sh/alerting@0.3.4
  - @caisson-sh/local-inference@0.2.3
  - @caisson-sh/access-review@0.3.7
  - @caisson-sh/agent-kernel@0.8.2
  - @caisson-sh/agent-runner@0.3.4
  - @caisson-sh/agent-trajectory@0.6.3
  - @caisson-sh/ai-meter@1.1.5
  - @caisson-sh/artifact-render@0.2.7
  - @caisson-sh/auth@0.4.7
  - @caisson-sh/billing@0.6.11
  - @caisson-sh/billing-orchestration@0.4.4
  - @caisson-sh/compliance-core@0.7.4
  - @caisson-sh/credits@0.6.5
  - @caisson-sh/frameworks-pack@0.8.4
  - @caisson-sh/guardrails@0.5.3
  - @caisson-sh/local-privacy@0.2.3
  - @caisson-sh/local-store@1.1.4
  - @caisson-sh/local-sync@0.2.4
  - @caisson-sh/org-controls@0.4.4
  - @caisson-sh/oscal-spine@0.2.4
  - @caisson-sh/prompt-registry@1.1.4
  - @caisson-sh/retention-runner@0.2.4
  - @caisson-sh/risk-register@0.3.7
  - @caisson-sh/signing-primitive@0.4.4
  - @caisson-sh/tool-exec@0.4.2
  - @caisson-sh/trust-page@0.3.7
  - @caisson-sh/ai-evals@0.5.4

## 0.2.0

### Minor Changes

- 7d153d5: caisson.sh stops selling and ships as a static export. The cart, checkout, sign-in, buyer dashboard, plans, compare, stack fit, glossary and design-partner pages are gone, and every price is removed. The marketplace is now a demonstration gallery: each module links to its docs and to the module page that runs its live in-browser demo. The site and demos no longer build container images. The interactive demos export statically under /demos and ship inside the same site build, and security headers and redirects now ship as static `_headers` and `_redirects` files.

### Patch Changes

- 73bdf3c: The site, demos and internal tooling follow the move to Apache-2.0: the gate now requires every published package to be Apache-2.0 with its LICENSE file, the commerce and entitlement checks are gone, and the docs install everything from public npm.
- Updated dependencies [eb2648e]
- Updated dependencies [73bdf3c]
- Updated dependencies [8226c84]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
- Updated dependencies [9e5da35]
  - @caisson-sh/org-controls@0.4.3
  - @caisson-sh/access-review@0.3.6
  - @caisson-sh/agent-trajectory@0.6.2
  - @caisson-sh/ai-evals@0.5.3
  - @caisson-sh/ai-meter@1.1.4
  - @caisson-sh/artifact-render@0.2.6
  - @caisson-sh/audit-worm@2.2.5
  - @caisson-sh/billing@0.6.10
  - @caisson-sh/billing-orchestration@0.4.3
  - @caisson-sh/compliance-core@0.7.3
  - @caisson-sh/frameworks-pack@0.8.3
  - @caisson-sh/guardrails@0.5.2
  - @caisson-sh/oscal-spine@0.2.3
  - @caisson-sh/risk-register@0.3.6
  - @caisson-sh/signing-primitive@0.4.3
  - @caisson-sh/trust-page@0.3.6
  - @caisson-sh/field-crypto@1.1.3
  - @caisson-sh/agent-kernel@0.8.1
  - @caisson-sh/agent-runner@0.3.3
  - @caisson-sh/alerting@0.3.3
  - @caisson-sh/auth@0.4.6
  - @caisson-sh/credits@0.6.4
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/local-inference@0.2.2
  - @caisson-sh/local-privacy@0.2.2
  - @caisson-sh/local-store@1.1.3
  - @caisson-sh/local-sync@0.2.3
  - @caisson-sh/prompt-registry@1.1.3
  - @caisson-sh/retention-runner@0.2.3
  - @caisson-sh/tool-exec@0.4.1
  - @caisson-sh/ui@0.6.8

## 0.1.1

### Patch Changes

- 7e11672: Upgrade runtime OS layers on pinned bases and gate fixable HIGH/CRITICAL runtime OS findings while reporting application and raw-base residuals.
- 7d39669: Report the serving revision on every deployed service.

  Each service now answers with an `x-caisson-revision` response header naming the commit its
  running image was built from, so "which code is actually live" is one request instead of an
  inference from how a route behaves.

  The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
  entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
  build that did not come through that path reports `unknown` rather than guessing.

  The header is deliberately not gated behind origin verification: it has to stay readable exactly
  when that gate is the thing misbehaving, which is the case it exists to diagnose.

- Updated dependencies [045b21e]
- Updated dependencies [f02b193]
- Updated dependencies [f02b193]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [ac1a1a4]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/local-store@1.1.2
  - @caisson/audit-worm@2.2.4
  - @caisson/agent-runner@0.3.2
  - @caisson/tool-exec@0.4.0
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0
  - @caisson/agent-kernel@0.8.0
  - @caisson/alerting@0.3.2
  - @caisson/local-inference@0.2.1
  - @caisson/access-review@0.3.5
  - @caisson/risk-register@0.3.5
  - @caisson/agent-trajectory@0.6.1
  - @caisson/ai-meter@1.1.3
  - @caisson/auth@0.4.5
  - @caisson/billing-orchestration@0.4.2
  - @caisson/credits@0.6.3
  - @caisson/field-crypto@1.1.2
  - @caisson/org-controls@0.4.2
  - @caisson/prompt-registry@1.1.2
  - @caisson/artifact-render@0.2.5
  - @caisson/billing@0.6.9
  - @caisson/compliance-core@0.7.2
  - @caisson/frameworks-pack@0.8.2
  - @caisson/guardrails@0.5.1
  - @caisson/local-privacy@0.2.1
  - @caisson/local-sync@0.2.2
  - @caisson/oscal-spine@0.2.2
  - @caisson/retention-runner@0.2.2
  - @caisson/signing-primitive@0.4.2
  - @caisson/trust-page@0.3.5
  - @caisson/ai-evals@0.5.2

## 0.1.0

### Minor Changes

- 0f3f5e2: The interactive module demos now ship as their own application instead of being compiled into the
  marketing site. They are served from the same address as before — a module page still shows its
  demo inline, and nothing about the page's address or analytics changes — but the demos are now
  built and deployed independently of the site.

  The response headers pick up one narrow change to allow this. Pages may now embed a frame from
  caisson.sh itself, and the demo surface may be framed by caisson.sh itself. Every other page is
  still refused to every framer, including this one, and no third-party origin was added anywhere.

  The practical effect is that changing a module no longer rebuilds and redeploys the storefront: the
  site's internal dependency list drops from 46 workspace packages to 27, and the packages that exist
  purely to power a demo move with the demos. A page whose demo is temporarily unavailable now says
  so in place of the demo, rather than failing the surrounding page.

### Patch Changes

- ef3f473: Bind the demos standalone server dual-stack. The IPv4-only bind copied from the public-edge apps refused every connection arriving over the platform's IPv6-only private network, so the site's demo rewrite answered 500; `HOSTNAME=::` lets both the private mesh and the container healthcheck reach the server.
- c10e3b6: Correct the railway.toml service-variable note: PORT is pinned as a Railway service variable because the platform injects its own PORT over the image ENV.
- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- c577330: Deployment documentation now matches the deployed reality. The `apps/site` service
  env block is regenerated from the live variable list — names only, verified for exact
  parity in both directions — and the stale scaffold comments that described live
  infrastructure as not-yet-created are removed from the demos service config, the
  registry Worker config, and the Railway deploy workflow. No runtime behaviour changes
  in these packages.
- Updated dependencies [f669d4a]
- Updated dependencies [f669d4a]
- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
- Updated dependencies [e6866e5]
- Updated dependencies [c10e3b6]
  - @caisson/guardrails@0.5.0
  - @caisson/local-inference@0.2.0
  - @caisson/kernel@0.9.0
  - @caisson/local-privacy@0.2.0
  - @caisson/field-crypto@1.1.1
  - @caisson/agent-kernel@0.7.1
  - @caisson/billing@0.6.8
  - @caisson/local-store@1.1.1
  - @caisson/signing-primitive@0.4.1
  - @caisson/ui@0.6.6
  - @caisson/ai-meter@1.1.2
  - @caisson/billing-orchestration@0.4.1
  - @caisson/trust-page@0.3.4
  - @caisson/access-review@0.3.4
  - @caisson/agent-runner@0.3.1
  - @caisson/agent-trajectory@0.6.0
  - @caisson/ai-evals@0.5.1
  - @caisson/alerting@0.3.1
  - @caisson/artifact-render@0.2.4
  - @caisson/audit-worm@2.2.3
  - @caisson/auth@0.4.4
  - @caisson/compliance-core@0.7.1
  - @caisson/credits@0.6.2
  - @caisson/frameworks-pack@0.8.1
  - @caisson/local-sync@0.2.1
  - @caisson/org-controls@0.4.1
  - @caisson/oscal-spine@0.2.1
  - @caisson/prompt-registry@1.1.1
  - @caisson/retention-runner@0.2.1
  - @caisson/risk-register@0.3.4
  - @caisson/tool-exec@0.3.1
