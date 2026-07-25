import { wormAnchorAccount } from "@caisson/service-license";
import { z, ZodError } from "zod";
import { json, requireAdmin } from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import { buildAdminAuditWindow } from "@/lib/audit-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportQuerySchema = z
  .object({
    account: z.string().trim().min(1).max(256),
  })
  .strict();

function respond(body: unknown, status = 200): Response {
  const response = json(body, status);
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(req: Request): Promise<Response> {
  if ((await requireAdmin(req)) === null) {
    return respond({ error: "unauthorized" }, 401);
  }

  let account: string;
  try {
    account = exportQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    ).account;
  } catch (error) {
    return respond(
      {
        error: "invalid request",
        issues: error instanceof ZodError ? error.issues : undefined,
      },
      400,
    );
  }

  const deps = await getAdminMutationDeps();
  const window = await buildAdminAuditWindow({
    source: deps.worm,
    accountId: wormAnchorAccount(account),
    tenantId: account,
    now: new Date(),
  });
  if (window.entries.length === 0) {
    return respond({ error: "not found" }, 404);
  }
  if (window.evidencePack === null) {
    return respond({ error: "evidence pack unavailable" }, 503);
  }
  return respond(window.evidencePack);
}
