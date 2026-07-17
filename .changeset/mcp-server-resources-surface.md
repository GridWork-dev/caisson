---
"@caisson/mcp-server": minor
---

Add a readable MCP resources surface to the buyer MCP, the read-side mirror of the tool registry.
Resources are entitlement-scoped exactly like tools (a resource a caller is not entitled to is
invisible: resources/list omits it and resources/read returns the same not-found an unknown URI
gets), rate-limited through the same per-account hook, and served under the same timing-safe Bearer
gate. Both transports (stdio and Streamable-HTTP) now advertise the resources capability and wire
resources/list and resources/read. URIs follow a stable caisson://<namespace>/<name> scheme:
caisson://registry/index serves the full module registry catalog to any authenticated buyer, and —
when the host wires a design-system manifest — caisson://design-system/components and
caisson://design-system/tokens are open, with a caisson://design-system/pro-components roster gated
on the pro tier. The design-system resources front the same pure read functions the design-system
tools use, so it is one data layer behind two protocol fronts.
