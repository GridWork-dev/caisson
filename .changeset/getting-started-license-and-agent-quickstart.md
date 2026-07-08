---
"@caisson/site": patch
---

The getting-started guide now covers the post-purchase flow: where the license key comes from
(`/dashboard/license`), the `CAISSON_LICENSE_TOKEN` a generated project's `.npmrc` needs before
`bun install`, and two ways an AI coding agent can drive Caisson — shelling out to `create-caisson`
directly, or wiring the auth-gated `@caisson/mcp-server` for tool-native access. The stale
positional-argument install example is replaced with the CLI's real interactive and flagged forms.
