// apps/local-ai/app/api/demo/route.ts — the demo route handler (ADR-0044). A thin wrapper over
// `runDemo()`: it runs the whole edition offline (hybrid retrieval, at-rest, offline license verify,
// two-replica sync convergence) and returns the JSON summary. `nodejs` runtime (bun:sqlite + the
// native sqlite-vec extension live behind the externalized `@caisson/*` packages) and `force-dynamic`
// so the demo executes per-request, never at build (the build does not run a model, store, or socket).
import { runDemo } from "../../demo/pipeline.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await runDemo();
  // 200 when every exit-gate clause held offline; 500 surfaces a regression to the caller/CI.
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
