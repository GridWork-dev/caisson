# @caisson/service-docs

## 0.0.6

### Patch Changes

- @caisson/rate-limit@0.1.2

## 0.0.5

### Patch Changes

- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [4d7eb71]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/local-store@0.2.4
  - @caisson/observability@0.2.4
  - @caisson/rate-limit@0.1.1

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/local-store@0.2.3
  - @caisson/observability@0.2.3

## 0.0.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/local-store@0.2.2
  - @caisson/observability@0.2.2

## 0.0.2

### Patch Changes

- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [623d07c]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/local-store@0.2.1
  - @caisson/observability@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/observability@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/local-store@0.2.0
