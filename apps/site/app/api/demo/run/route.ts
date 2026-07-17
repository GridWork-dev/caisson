// POST /api/demo/run — the pre-purchase sandbox demo-run route (CAISSON-110, ADR-0350 F1(c)/F5 ·
// ADR-0352). A same-origin Next Route Handler that wires real deps from server-only env: it verifies
// Turnstile (fail-closed), charges the per-IP / per-/64 PG rate-limit account-store, atomically
// reserves an F5 budget slot, then runs `@caisson/cli`'s `generateDemo` IN-PROCESS and returns the
// bounded file tree. TURNSTILE_SECRET, DATABASE_URL never reach the browser. All orchestration + the
// response contract live in `lib/demo-run/handler.ts` (hermetically tested); this file is wiring only.
//
// GET /api/demo/run returns the run-path availability so the UI can proactively grey the CTA when the
// F5 cap trips or the kill switch is off (fail-closed across API and UI).
import { checkRateLimit } from "@caisson/rate-limit";
import { withTenant } from "@caisson/tenancy-rls";
import { getDb } from "@/lib/db";
import { makeTurnstileVerifier } from "@/lib/ask-ai/turnstile";
import {
  type DemoRunDeps,
  handleDemoRun,
  SECURITY_HEADERS,
} from "@/lib/demo-run/handler";
import { generateDemoRun } from "@/lib/demo-run/run";
import {
  demoRunEnabled,
  hashIp,
  rateConfigForKey,
  readDemoRunStatus,
  recordDemoLead,
  releaseDemoRun,
  reserveDemoRun,
  resolveDemoRunCaps,
} from "@/lib/demo-run/store";

// Reads request headers + the DB and runs the generator — never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildDeps(): DemoRunDeps {
  const caps = resolveDemoRunCaps();
  // Per-request closure so `release` decrements the SAME day `reserve` incremented (buildDeps runs per
  // request, like ask-ai's route). Undefined until a reservation is granted → release is a no-op on a
  // request that never reserved (rate-limited / turnstile-failed).
  let reservedDay: string | undefined;
  const verifyTurnstile = makeTurnstileVerifier({
    secret: process.env.TURNSTILE_SECRET,
    isProduction: process.env.NODE_ENV === "production",
  });
  return {
    enabled: () => demoRunEnabled(),
    verifyTurnstile,
    // Per-IP / per-/64 quotas ride the @caisson/rate-limit PG account-store (never in-memory —
    // ADR-0352 rider 1). The IP key is the RLS tenant; the store's WITH CHECK ties every write to it.
    checkRate: async (key) => {
      const db = await getDb();
      const dec = await withTenant(db, key, (tx) =>
        checkRateLimit(tx, key, Date.now(), rateConfigForKey(key)),
      );
      return {
        allowed: dec.allowed,
        retryAfterSec: Math.ceil(dec.retryAfterMs / 1000),
      };
    },
    reserve: async () => {
      const r = await reserveDemoRun(await getDb(), caps);
      if (r.ok) {
        reservedDay = r.day;
        return { ok: true };
      }
      return { ok: false, reason: r.reason };
    },
    release: async () => {
      if (reservedDay !== undefined) {
        await releaseDemoRun(await getDb(), reservedDay);
      }
    },
    generate: (projectName) => generateDemoRun(projectName),
    recordLead: async (email, runId, ip) => {
      await recordDemoLead(await getDb(), {
        runId,
        email,
        ipHash: hashIp(ip),
      });
    },
  };
}

export function POST(request: Request): Promise<Response> {
  return handleDemoRun(request, buildDeps());
}

export async function GET(): Promise<Response> {
  const status = demoRunEnabled()
    ? await readDemoRunStatus(await getDb(), resolveDemoRunCaps())
    : ({ enabled: false, reason: "disabled" } as const);
  return Response.json(status, { headers: SECURITY_HEADERS });
}
