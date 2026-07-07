# @caisson/rate-limit

## 0.1.2

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.1.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 850b844: Moved the per-account throttle store out of the commercial license service and into the
  new shared, freely licensed rate-limiting package. The open reference application now
  composes this shared store directly for its buyer-facing throttling instead of depending
  on the commercial license service to get it. Buyer-visible throttling behavior is
  unchanged; this only changes where the code lives and removes an unnecessary dependency
  from the open reference application.
- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0
