// Railway readiness probe (ADR-0114). Mirrors services/docs' `/health` shape — a plain `{ ok:
// true }` with no DB round-trip (the dashboard's own routes prove DB connectivity per-request via
// `withTenant`; the probe itself must stay cheap so it never flaps on a slow tenant query).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
