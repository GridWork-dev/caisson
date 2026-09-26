# @caisson-sh/trust-page

The trust-page generator: given an evidence-pack manifest, `generateTrustPage` returns a
self-contained static HTML page and a machine-readable JSON file, built through the same
allowlist-based redaction on both outputs. No auth, no sign-off, no hosted comments, no
NDA-gating — permanent non-goals, never scaffolded here.

```ts
import { generateTrustPage } from "@caisson-sh/trust-page";

const page = generateTrustPage(pack.manifest);

page.html; // a self-contained static HTML page — write it to disk / host it as-is
page.json; // a JSON string, { facts, crosswalk } — the same allowlisted data, machine-readable
```

Only the facts present in the caller's `allowlist` ever render, in either output — a field left
off the list is simply absent, never a partial redaction. `DEFAULT_TRUST_PAGE_ALLOWLIST` ships
aggregate posture only (framework title/version, the summary posture and its three control
counts); widen it explicitly to
show more:

```ts
import {
  generateTrustPage,
  CROSSWALK_ROLLUP_ROWS_KEY,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
} from "@caisson-sh/trust-page";

const page = generateTrustPage(pack.manifest, {
  allowlist: [...DEFAULT_TRUST_PAGE_ALLOWLIST, CROSSWALK_ROLLUP_ROWS_KEY],
});
```

Every rendered string, allowlisted fact and crosswalk citation row alike, passes the
readiness-language gate before either output is built: this generator cannot ship a
"compliant"/"certified"/"verified" claim even if the underlying evidence pack's own posture copy
somehow slipped one past its own gate.

Apache-2.0. Consumes `@caisson-sh/artifact-render` for redaction and citation-row rendering, and
`@caisson-sh/compliance-core` for the `EvidencePackManifest` shape it renders — down-only, composed
by the compliance evidence engine, never the reverse.
