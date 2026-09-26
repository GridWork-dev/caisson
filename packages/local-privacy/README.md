# @caisson/local-privacy

The Local-first edition's privacy gate: a strict zero-egress `PrivacyPolicy` (Zod `.strict()`,
closed enums — `"local-only"` is the only mode, a sink is `model-fetch` or `rented-backend` and
nothing else) plus `EgressGuard`, the runtime wrapper around the kernel `fetchWithTimeout`
chokepoint. A base primitive (Apache-2.0) — no vendor SDK import, no
live network call in this package itself.

## What it gives you

- **Fail-closed-to-offline.** An empty or omitted allowlist blocks every host; a non-allowlisted
  host, a non-`https:` scheme, or a malformed URL are all blocked before `fetchWithTimeout` is ever
  reached, so no socket opens and no bytes leave the device.
- **Purpose-bound sinks.** `assertAllowedFor` / `fetchAs` require a host to be allowlisted for a
  specific sanctioned kind, so a Bearer-credentialed rented-backend request can never reach a host
  sanctioned only for the model-fetch download, and vice versa.
- **`guardedFetch`** — the guard as a bare `(input, init) => Promise<Response>` another runtime can
  install as its sole outbound hook (e.g. transformers.js's `env.fetch`), so that runtime cannot
  egress out of band.

## Install

```bash
bun add @caisson/local-privacy
```

## Use

```ts
import { createEgressGuard, localOnlyPolicy } from "@caisson/local-privacy";

const guard = createEgressGuard(
  localOnlyPolicy([{ host: "huggingface.co", kind: "model-fetch" }]),
);

// blocked before any socket opens — huggingface.co isn't allowlisted for "rented-backend"
await guard.fetchAs("rented-backend", "https://huggingface.co/model.onnx");

// allowed — sanctioned for model-fetch
const res = await guard.fetch("https://huggingface.co/model.onnx");
```

## Tests

`bun test packages/local-privacy/src` — the policy schema rejects an unknown mode/kind/key; the
guard blocks an empty allowlist, a non-allowlisted host, a non-https scheme, and a wrong-kind
purpose-bound request; an allowlisted host passes through to `fetchWithTimeout`.

License: Apache-2.0.
