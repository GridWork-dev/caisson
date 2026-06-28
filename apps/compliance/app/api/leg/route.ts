// GET /api/leg — execute the Compliance leg on demand and return the four exit checks as JSON. The
// Node runtime is mandatory (PGlite WASM + node:crypto/fs); the handler is force-dynamic so it is
// never prerendered at build (the build stays a pure compile). Each request gets an isolated
// substrate (its own in-memory DB + temp WORM dir), torn down in a finally — no live cloud, no
// shared state. This is the runtime mirror of the `lib/leg.test.ts` exit-gate proof.
import { NextResponse } from "next/server";
import { createLegHarness } from "@/lib/harness";
import { runComplianceLeg } from "@/lib/leg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const harness = await createLegHarness();
  try {
    const result = await runComplianceLeg(harness);
    return NextResponse.json(
      { ok: result.allChecksPassed, result },
      { status: result.allChecksPassed ? 200 : 500 },
    );
  } finally {
    await harness.cleanup();
  }
}
