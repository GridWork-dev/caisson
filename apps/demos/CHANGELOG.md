# @caisson/demos

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
