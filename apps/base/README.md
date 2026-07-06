# apps/base

Runnable reference template for the **base** edition, wired over plain `Bun.serve` (`server.ts`).
The app framework (Next/TanStack/Hono) is chosen per edition later — this stays framework-agnostic.

`app.ts` wires the real request path end to end: auth → tenancy → credits for a credit-gated
operation, a billing webhook that grants credits, and a buyer MCP query, backed by integration
tests covering the app, credit grants, rate limiting, and request validation.
