// Route Handler example: the same session verification `proxy.ts` uses, enforced with
// `requireSession` (throws `AuthnError` on no session) and mapped to a client-safe envelope with
// `toErrorResponse` (@caisson-sh/kernel, ADR-0019's typed-error → HTTP-status mapping).
import type { NextRequest } from "next/server";
import { requireSession } from "@caisson-sh/auth";
import { toErrorResponse } from "@caisson-sh/kernel";
import { resolveSessionFromRequest } from "../../../lib/auth";

export function GET(request: NextRequest): Response {
  try {
    const session = requireSession(resolveSessionFromRequest(request));
    return Response.json({
      userId: session.userId,
      accountId: session.accountId,
      role: session.role,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
