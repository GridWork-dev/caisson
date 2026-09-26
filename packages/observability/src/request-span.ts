// Manual request-span middleware (ADR-0185). Bun.serve/Bun-fetch/Bun-SQL bypass the node:http /
// undici / pg auto-instrumentation this package boots (observability.ts), so a Bun HTTP handler
// emits ZERO spans without an explicit wrap. `withRequestSpan` wraps ONE handler invocation in a
// server span using the OTel tracer API directly — no node internals patched, no dependency added
// (`@opentelemetry/api` is already a dependency of this package).
//
// Deliberately scoped: this wraps only the handler boundary — no automatic child-spans for DB/fetch
// calls inside the handler. Add those explicitly at each call site if a trace needs them. Swap to
// Bun-native auto-instrumentation if/when one exists — the same gap ADR-0185 accepts for now.
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from "@opentelemetry/semantic-conventions";
import { scrubPath } from "./scrub.ts";

/**
 * Wrap a Bun `(req: Request) => Promise<Response>` handler so every call emits one server span:
 * name `${method} ${route}`, `http.method`/`http.route`/`http.status_code` attributes, exceptions
 * recorded + span marked ERROR (then rethrown — this never swallows a handler failure).
 *
 * The span name and `http.route` attribute are LOW-CARDINALITY by construction: pass
 * `routeTemplate` (e.g. `/users/:id`) when the caller knows it; otherwise the raw request path is
 * scrubbed (`scrubPath`) before it is ever emitted — the raw client-controlled path must never
 * reach a span name or attribute (it can carry PII, secrets, or arbitrary values).
 *
 * Callers skip `/health` (liveness/readiness probes), matching the usual rate-limiter exemption —
 * a probe hitting every few seconds is noise, not a trace.
 */
export function withRequestSpan(
  handler: (req: Request) => Promise<Response>,
  routeTemplate?: string,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const route = new URL(req.url).pathname;
    if (route === "/health") return handler(req); // liveness/readiness probe — no span, no noise
    const routeLabel = routeTemplate ?? scrubPath(route);
    // Resolved per-request (not cached at module scope): `initObservability` registers the global
    // tracer provider at boot, which can run after this module is first imported — caching the
    // tracer would freeze it to the pre-boot no-op delegate.
    const tracer = trace.getTracer("@caisson/observability");
    return tracer.startActiveSpan(
      `${req.method} ${routeLabel}`,
      async (span) => {
        try {
          span.setAttribute(ATTR_HTTP_REQUEST_METHOD, req.method);
          span.setAttribute(ATTR_HTTP_ROUTE, routeLabel);
          const response = await handler(req);
          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
          if (response.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          return response;
        } catch (err) {
          span.recordException(err instanceof Error ? err : String(err));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  };
}
