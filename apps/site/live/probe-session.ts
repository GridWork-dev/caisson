// Probe-account session bootstrap, shared by `scripts/visual-harness.ts` (dashboard leg) and
// `live/buyer-dashboard-flow.live.test.ts`.
//
// Why not Playwright's own `context.request.post`: under BUN, playwright-core's APIRequestContext
// crashes parsing the response's Set-Cookie header — `_parseSetCookieHeader` receives a path-only
// response URL ("/api/auth/sign-in/email"), `new URL()` throws ERR_INVALID_URL, and the request
// never resolves, surfacing as a timeout on every call (caught 2026-07-09, the first credentialed
// run of the buyer-dashboard leg). Native fetch + manual cookie injection sidesteps it.
//
// Note the mandatory Origin header: better-auth's CSRF check 403s any auth POST without one
// (MISSING_OR_NULL_ORIGIN).
import type { BrowserContext } from "playwright";

interface SignInResult {
  ok: boolean;
  status: number;
}

function parseSetCookie(
  sc: string,
  hostname: string,
): Parameters<BrowserContext["addCookies"]>[0][number] {
  const [pair = "", ...attrs] = sc.split(";");
  const eq = pair.indexOf("=");
  // Flag attributes (Secure/HttpOnly) are matched as whole attribute names — a substring test
  // over the raw header would false-positive on a `__Secure-` name prefix or a value containing
  // "httponly". SameSite comes from the real attribute (better-auth sends Lax), defaulting to
  // Lax like a browser does, not Strict.
  const flags = attrs.map((a) => a.trim().toLowerCase());
  const attr = (k: string): string | undefined =>
    attrs
      .find((a) => a.trim().toLowerCase().startsWith(`${k}=`))
      ?.split("=")[1]
      ?.trim();
  const rawSameSite = attr("samesite")?.toLowerCase();
  const sameSite: "Strict" | "Lax" | "None" =
    rawSameSite === "strict"
      ? "Strict"
      : rawSameSite === "none"
        ? "None"
        : "Lax";
  return {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
    domain: attr("domain") ?? hostname,
    path: attr("path") ?? "/",
    expires: -1,
    httpOnly: flags.includes("httponly"),
    secure: flags.includes("secure"),
    sameSite,
  };
}

/** POST an auth boundary with native fetch (15s deadline) and return {ok, status}. */
export async function postAuth(
  baseUrl: string,
  path: string,
  body: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Promise<{ res: Response | null; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        ...extraHeaders,
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { res, status: res.status };
  } catch {
    return { res: null, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sign the probe account in via the API and inject the session cookies into `context` so every
 * subsequent `page.goto` in that context carries the session.
 */
export async function signInProbeAccount(
  context: BrowserContext,
  baseUrl: string,
  email: string,
  password: string,
  extraHeaders?: Record<string, string>,
): Promise<SignInResult> {
  const { res, status } = await postAuth(
    baseUrl,
    "/api/auth/sign-in/email",
    { email, password },
    extraHeaders,
  );
  if (res === null || !res.ok) return { ok: false, status };
  const hostname = new URL(baseUrl).hostname;
  const cookies = res.headers
    .getSetCookie()
    .map((sc) => parseSetCookie(sc, hostname))
    .filter((c) => c.name !== "" && c.value !== "");
  if (cookies.length === 0) return { ok: false, status };
  await context.addCookies(cookies);
  return { ok: true, status };
}
