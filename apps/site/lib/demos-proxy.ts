import { fetchWithTimeout } from "@caisson/kernel/fetch";
import { z } from "zod";

const demosOriginSchema = z
  .object({ origin: z.string().trim().min(1).max(2_048) })
  .strict();
const demosPathSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(512)
      .refine(
        (segment) =>
          segment !== "." &&
          segment !== ".." &&
          !segment.includes("/") &&
          !segment.includes("\\") &&
          !segment.includes("\0"),
      ),
  )
  .max(64);

const REQUEST_HEADER_DENYLIST = new Set([
  "authorization",
  "connection",
  "cookie",
  "forwarded",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-gridwork-origin-secret",
]);

const RESPONSE_HEADER_DENYLIST = new Set([
  "authorization",
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  "set-cookie2",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type FetchImpl = typeof fetchWithTimeout;

export interface DemosProxyDependencies {
  getAuthorizationHeaders: (audience: string) => Promise<Headers>;
  fetchImpl: FetchImpl;
}

type IdTokenClient = {
  getRequestHeaders: () => Promise<Headers>;
};

const idTokenClients = new Map<string, Promise<IdTokenClient>>();

async function googleAuthorizationHeaders(audience: string): Promise<Headers> {
  let client = idTokenClients.get(audience);
  if (client === undefined) {
    client = import("google-auth-library").then(async ({ GoogleAuth }) => {
      const auth = new GoogleAuth();
      return auth.getIdTokenClient(audience);
    });
    idTokenClients.set(audience, client);
  }
  try {
    return await (await client).getRequestHeaders();
  } catch (error) {
    idTokenClients.delete(audience);
    throw error;
  }
}

const defaultDependencies: DemosProxyDependencies = {
  getAuthorizationHeaders: googleAuthorizationHeaders,
  fetchImpl: fetchWithTimeout,
};

/** Resolve the private Cloud Run service origin and ID-token audience. */
export function parseDemosOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const { origin } = demosOriginSchema.parse({ origin: value });
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("DEMOS_ORIGIN_URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("DEMOS_ORIGIN_URL must use https");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("DEMOS_ORIGIN_URL must not contain credentials");
  }
  return parsed.origin;
}

function upstreamHeaders(
  request: Request,
  authorizationHeaders: Headers,
): Headers {
  const authorization = authorizationHeaders.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) {
    throw new Error("Google identity client returned no Bearer token");
  }

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    if (
      REQUEST_HEADER_DENYLIST.has(lower) ||
      lower.startsWith("cf-") ||
      lower.startsWith("x-goog-")
    ) {
      continue;
    }
    headers.set(name, value);
  }
  headers.set("authorization", authorization);
  return headers;
}

function downstreamHeaders(
  upstream: Response,
  requestUrl: URL,
  demosOrigin: string,
): Headers {
  const headers = new Headers();
  for (const [name, value] of upstream.headers) {
    if (!RESPONSE_HEADER_DENYLIST.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }

  const location = headers.get("location");
  if (location !== null) {
    const resolved = new URL(location, demosOrigin);
    if (resolved.origin === demosOrigin) {
      headers.set(
        "location",
        `${requestUrl.origin}${resolved.pathname}${resolved.search}${resolved.hash}`,
      );
    } else {
      headers.delete("location");
    }
  }
  return headers;
}

/**
 * Proxy one same-origin `/demos/*` GET/HEAD to an IAM-private Cloud Run service. The Google ID
 * token exists only in this server-side request and is never copied into the browser response.
 */
export async function proxyDemosRequest(
  request: Request,
  path: string[],
  configuredOrigin: string | null,
  dependencies: DemosProxyDependencies = defaultDependencies,
): Promise<Response> {
  if (configuredOrigin === null) {
    return new Response("Not Found", { status: 404 });
  }
  const demosOrigin = parseDemosOrigin(configuredOrigin);
  if (demosOrigin === null) {
    return new Response("Not Found", { status: 404 });
  }
  const parsedPath = demosPathSchema.safeParse(path);
  if (!parsedPath.success) {
    throw new Error("invalid demos path");
  }

  const requestUrl = new URL(request.url);
  const encodedPath = parsedPath.data
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const target = new URL(
    encodedPath === "" ? "/demos" : `/demos/${encodedPath}`,
    demosOrigin,
  );
  target.search = requestUrl.search;

  const authorizationHeaders =
    await dependencies.getAuthorizationHeaders(demosOrigin);
  const upstream = await dependencies.fetchImpl(
    target,
    {
      method: request.method,
      headers: upstreamHeaders(request, authorizationHeaders),
      redirect: "manual",
    },
    { timeoutMs: 30_000 },
  );

  const noBody =
    request.method === "HEAD" ||
    upstream.status === 204 ||
    upstream.status === 304;
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamHeaders(upstream, requestUrl, demosOrigin),
  });
}
