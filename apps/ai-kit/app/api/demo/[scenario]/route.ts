import { NextResponse } from "next/server";

import { isScenario, runEmptyWallet, runScenario } from "@/lib/demo";

// The demo runs the real gateway (PGlite + WASM + a mock model) at request time, so the route is
// Node-runtime + always-dynamic — never statically prerendered at build.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scenario: string }> },
): Promise<Response> {
  const { scenario } = await params;
  if (scenario === "empty-wallet") {
    return NextResponse.json(await runEmptyWallet());
  }
  if (isScenario(scenario)) {
    return NextResponse.json(await runScenario(scenario));
  }
  return NextResponse.json(
    { error: `unknown scenario: ${scenario}` },
    { status: 404 },
  );
}
