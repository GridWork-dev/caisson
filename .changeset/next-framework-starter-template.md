---
"@caisson/cli": minor
---

`create-caisson --framework next`: an opt-in Next.js App Router starter (same shape as the
`--deploy <target>` family, ADR-0268) — a wired app on the base substrate instead of the bare
`Bun.serve` harness. Ships small, working examples of every base-substrate seam: account-JWT
session verification as a `proxy.ts` (Next 16's `middleware.ts` rename) and a Route Handler,
tenant-scoped Postgres access via `withTenant` in a Server Action, a `BillingProvider`-port
webhook stub, a `JobQueue` enqueue example, an `Emailer` send example, and an `@caisson/ai-config`
lane read. Unselected, generator output is unchanged (portable-by-omission); combine with
`--deploy railway|fly|vercel` and the shared Dockerfile's `bun run build`/`bun run start` resolve
to `next build`/`next start` with no extra wiring.
