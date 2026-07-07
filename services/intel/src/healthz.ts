// The daemon's only inbound surface: GET /healthz. Unauthenticated by design — the bind (loopback
// only, enforced by the compose file, not this code) is the gate, and a push-only daemon has no
// authed inbound contract to protect (see the SPEC's "no inbound API" note). Everything else the
// daemon does is outbound: fetch external sources, push to Postgres.
export function createHealthzHandler(): (req: Request) => Response {
  return (req: Request): Response =>
    new URL(req.url).pathname === "/healthz"
      ? Response.json({ ok: true })
      : new Response("not found", { status: 404 });
}

export function startHealthzServer(
  port: number,
  hostname: string,
): { stop: () => void } {
  const server = Bun.serve({ port, hostname, fetch: createHealthzHandler() });
  return { stop: () => server.stop(true) };
}
