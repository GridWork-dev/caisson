// The catalog's send-test-to-operator action (ADR-0284). Renders one branded template with the SAME
// sample data the catalog page just showed and sends it to a fixed, env-pinned operator address —
// never a user-supplied recipient. Mirrors apps/site/lib/auth-server.ts's `resolveEmailer` (same env
// vars, same default `from`) so this surface never drifts from the transport the product actually
// ships with.
import {
  type CaptureEmailer,
  createCaptureEmailer,
  createResendEmailer,
  type Emailer,
} from "@caisson/email";
import { z } from "zod";
import {
  actorEmail,
  json,
  mutationErrorResponse,
  parseBody,
} from "@/lib/admin-route";
import {
  EMAIL_SAMPLE_DATA,
  isEmailTemplateId,
} from "@/app/catalog/emails/sample-data";

const Body = z.object({ templateId: z.string().min(1).max(64) }).strict();

function resolveEmailer(): Emailer | CaptureEmailer {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey !== undefined && apiKey.length > 0) {
    return createResendEmailer({
      apiKey,
      from: process.env.RESEND_FROM?.trim() || "Caisson <no-reply@caisson.sh>",
    });
  }
  return createCaptureEmailer();
}

function isCaptureEmailer(e: Emailer | CaptureEmailer): e is CaptureEmailer {
  return "sent" in e;
}

export async function POST(req: Request): Promise<Response> {
  const actor = actorEmail(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);

  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;

  const { templateId } = parsed.value;
  if (!isEmailTemplateId(templateId)) {
    return json({ error: "unknown templateId" }, 400);
  }

  const to = process.env.CATALOG_TEST_EMAIL_TO?.trim();
  if (to === undefined || to.length === 0) {
    return json(
      {
        error:
          "CATALOG_TEST_EMAIL_TO is not configured — no operator recipient to send to",
      },
      503,
    );
  }

  try {
    const emailer = resolveEmailer();
    // `EmailMessage.data` is intentionally free-form (Record<string, unknown> — the same driver
    // port `@caisson/alerting` sends un-typed operator alerts through); the concrete per-template
    // shape lives in `TemplateDataMap`, which is what `EMAIL_SAMPLE_DATA` is keyed against, so
    // this cast never smuggles a wrong shape — `tryRenderEmailTemplate` re-validates it either way.
    await emailer.send({
      to,
      template: templateId,
      data: EMAIL_SAMPLE_DATA[templateId] as unknown as Record<string, unknown>,
    });
    return json({ ok: true, delivered: !isCaptureEmailer(emailer) });
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
