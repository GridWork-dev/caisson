// ADR-0424: session and entitlement checks precede any Paddle transaction creation.
import { z } from "zod";
import type { SessionContext } from "@caisson/auth";
import { BUNDLE_CATALOG, MODULE_CATALOG } from "./catalog.ts";

const bodySchema = z
  .object({
    itemIds: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
    promoCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();

export interface CartRouteDependencies {
  session(request: Request): Promise<SessionContext | null>;
  owned(accountId: string): Promise<ReadonlySet<string>>;
  createTransaction(input: {
    priceIds: string[];
    accountId: string;
    promoCode?: string;
  }): Promise<string>;
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });

export function cartOwnedHandler(
  deps: Pick<CartRouteDependencies, "session" | "owned">,
) {
  return async (request: Request): Promise<Response> => {
    const session = await deps.session(request);
    const owned =
      session === null
        ? new Set<string>()
        : await deps.owned(session.accountId);
    return json({ owned: [...owned] });
  };
}

export function cartCheckoutHandler(deps: CartRouteDependencies) {
  return async (request: Request): Promise<Response> => {
    // Cookie-authenticated mutation: require same-origin JSON, never accept a posted account id.
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ error: "forbidden" }, 403);
    try {
      const session = await deps.session(request);
      if (session === null) return json({ error: "unauthenticated" }, 401);
      if (
        request.headers.get("content-type")?.split(";")[0]?.trim() !==
        "application/json"
      )
        return json({ error: "invalid request" }, 400);
      const parsed = bodySchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success) return json({ error: "invalid request" }, 400);
      const catalog = new Map(
        [...BUNDLE_CATALOG, ...MODULE_CATALOG].map((item) => [item.id, item]),
      );
      const ids = [...new Set(parsed.data.itemIds)];
      if (ids.some((id) => !catalog.has(id)))
        return json({ error: "unknown catalog item" }, 400);
      const owned = await deps.owned(session.accountId);
      const remaining = ids.filter((id) => !owned.has(id));
      const removed = ids.filter((id) => owned.has(id));
      if (remaining.length === 0)
        return json({ error: "already owned", removed }, 409);
      const transactionId = await deps.createTransaction({
        priceIds: remaining.map((id) => catalog.get(id)!.priceId),
        accountId: session.accountId,
        ...(parsed.data.promoCode === undefined
          ? {}
          : { promoCode: parsed.data.promoCode }),
      });
      return json({ transactionId, removed });
    } catch {
      // Failed session/account/entitlement reads block checkout. Never echo provider errors.
      return json({ error: "checkout unavailable" }, 503);
    }
  };
}
