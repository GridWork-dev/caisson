// ADR-0424: always resolve the durable Better Auth session; the optional hint is not authority.
import { getSession } from "@/lib/auth";
import { getOwnedCartItemIdsForAccount } from "@/lib/owned-cart-items";
import { cartOwnedHandler } from "@/lib/cart-routes";
export const dynamic = "force-dynamic";
export const GET = cartOwnedHandler({
  session: getSession,
  owned: getOwnedCartItemIdsForAccount,
});
