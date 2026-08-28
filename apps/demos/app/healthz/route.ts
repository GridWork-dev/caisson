// Railway readiness probe (ADR-0400). Mirrors apps/site's `/healthz` shape — a plain
// `{ ok: true }` with no I/O, because this app has none to do.
//
// SERVED AT /demos/healthz, not /healthz: next.config.ts sets `basePath: "/demos"`, which
// prefixes every route in this app. railway.toml's healthcheckPath says the same thing.
//
// The serving revision rides here rather than in a proxy because this app has none — it is not
// origin-gated, so unlike site and admin there is no single exit point to stamp. That makes the
// header probe-only on this service: `/demos/healthz` reports the revision, other demo routes do
// not. Adding a whole proxy to widen that would buy nothing — the probe path is what anyone asking
// "which build is this" actually curls.
import { REVISION_HEADER, servingRevision } from "@caisson/kernel/node";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      [REVISION_HEADER]: servingRevision(),
    },
  });
}
