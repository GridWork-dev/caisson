// Railway readiness probe (ADR-0114/0138). Mirrors apps/site's `/healthz` — a plain `{ ok: true }`
// with no DB round-trip (the admin's own routes prove DB connectivity per-request; the probe itself
// must stay cheap so it never flaps on a slow query).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
