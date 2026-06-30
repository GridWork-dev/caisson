// Clears the session cookie and redirects home. POST-only (a sign-out is a state change, never a
// GET — avoids a prefetch/crawler accidentally signing a buyer out).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(): Promise<Response> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect("/");
}
