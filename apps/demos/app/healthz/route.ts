// Railway readiness probe (ADR-0400). Mirrors apps/site's `/healthz` shape — a plain
// `{ ok: true }` with no I/O, because this app has none to do.
//
// SERVED AT /demos/healthz, not /healthz: next.config.ts sets `basePath: "/demos"`, which
// prefixes every route in this app. railway.toml's healthcheckPath says the same thing.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
