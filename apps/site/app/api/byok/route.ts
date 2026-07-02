// POST/GET /api/byok — the BYOK key-submission edge (ADR-0183). Lives here (not an agent-dev coach)
// so it reuses the unified app's buyer session + `withTenant` RLS in one tree. All three MUSTs:
//   - validate-on-submit: a live minimal-scope provider call before persist (in `submitTenantKey`);
//   - write-only: GET returns metadata + masked last-4 only, never the key; the key is never logged;
//   - atomic rotation: encrypted key + display metadata written in one tenant transaction.
// BYOK is FREE (ADR-0182) — no credit debit, no cost preview.
import { NextResponse } from "next/server";
import { assertCanManageMembers } from "@caisson/auth";
import { AuthzError } from "@caisson/kernel";
import { getSession } from "@/lib/auth";
import { ByokSubmitBody, readKeyStatuses, submitTenantKey } from "@/lib/byok";

// Authed + tenant-scoped — never statically cached.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const keys = await readKeyStatuses(session.accountId);
  return NextResponse.json({ keys });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Owner-only: the org's BYOK provider key is a single shared, org-wide credential — a `seat`
  // rotating it could DoS the org's inference or route it through an attacker-controlled key
  // (Strix vuln-0006). Same owner-gate ADR-0176 mandates for shared/billing org resources and the
  // members path already uses. GET stays open — it returns masked metadata only, never the key.
  try {
    assertCanManageMembers(session.role);
  } catch (err) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  // Parse JSON defensively — a malformed body is a 400, never a 500.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = ByokSubmitBody.safeParse(raw);
  if (!parsed.success) {
    // Zod issues describe the SHAPE (field names/constraints), never the value — safe to return.
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await submitTenantKey(
    session.accountId,
    parsed.data.provider,
    parsed.data.apiKey,
  );
  if (!result.ok) {
    // Validation failed (bad/unreachable key). Editable error, no row written. Reason is key-free.
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }
  return NextResponse.json({ status: result.status }, { status: 200 });
}
