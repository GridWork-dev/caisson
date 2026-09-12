---
---

Build the demos and site images' build stage on Bun 1.4.2 so `next build` under Next 16.3 no
longer segfaults in Bun 1.3.14's napi threadsafe-function teardown (oven-sh/bun#37031, fixed
upstream in 1.4.0). Dockerfile-only: the runtime stages and the packageManager pin are unchanged,
so no package release is needed; the empty changeset satisfies the standards-gate
changeset-presence rule.
