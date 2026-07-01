// Clears the better-auth session cookie and redirects home. POST-only (a sign-out is a state
// change, never a GET — avoids a prefetch/crawler accidentally signing a buyer out). This
// explicit segment shadows the `/api/auth/[...all]` catch-all for `/api/auth/sign-out`, keeping
// the dashboard's plain-form-POST sign-out working. Deleting the session cookie logs the buyer
// out (sessions are cookie-gated); every `*session_token` / `*session_data` variant is cleared so
// the production secure-prefixed name is covered too, and the DB session row expires on its own.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (
      cookie.name.endsWith("session_token") ||
      cookie.name.endsWith("session_data")
    ) {
      jar.delete(cookie.name);
    }
  }
  redirect("/");
}
