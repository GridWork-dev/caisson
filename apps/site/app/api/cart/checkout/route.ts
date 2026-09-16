import { getCheckoutSession } from "@/lib/auth";
import { getOwnedCartItemIdsForAccount } from "@/lib/owned-cart-items";
import { cartCheckoutHandler } from "@/lib/cart-routes";
import { createPaddleCartTransaction } from "@/lib/paddle-cart-transaction";
export const dynamic = "force-dynamic";
export const POST = cartCheckoutHandler({
  session: getCheckoutSession,
  owned: getOwnedCartItemIdsForAccount,
  createTransaction: createPaddleCartTransaction,
});
