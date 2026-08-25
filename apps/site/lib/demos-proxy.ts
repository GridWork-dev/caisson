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
type DemosAuthorization = "google-id-token" | "none";

export type DemosOrigin = {
  origin: string;
  authorization: DemosAuthorization;
};

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

/** Resolve the Cloud Run IAM origin or the still-authoritative Railway private-mesh origin. */
export function parseDemosOrigin(
  raw: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DemosOrigin | null {
  const value = raw?.trim();
  if (!value) return null;

  const { origin } = demosOriginSchema.parse({ origin: value });
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("DEMOS_ORIGIN_URL is not a valid URL");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("DEMOS_ORIGIN_URL must not contain credentials");
  }
  if (
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(".run.app") &&
    parsed.hostname !== "run.app"
  ) {
    return { origin: parsed.origin, authorization: "google-id-token" };
  }

  const railwayEnvironmentId = environment.RAILWAY_ENVIRONMENT_ID?.trim() ?? "";
  const cloudRunService = environment.K_SERVICE?.trim() ?? "";
  if (
    parsed.protocol === "http:" &&
    parsed.hostname.endsWith(".railway.internal") &&
    parsed.hostname !== "railway.internal" &&
    railwayEnvironmentId !== "" &&
    cloudRunService === ""
  ) {
    return { origin: parsed.origin, authorization: "none" };
  }
  if (parsed.protocol === "http:") {
    throw new Error("DEMOS_ORIGIN_URL private HTTP origin requires Railway");
  }
  throw new Error("DEMOS_ORIGIN_URL must name an HTTPS Cloud Run service");
}

function upstreamHeaders(
  request: Request,
  authorizationHeaders: Headers,
  authorization: DemosAuthorization,
): Headers {
  const authorizationHeader = authorizationHeaders.get("authorization");
  if (
    authorization === "google-id-token" &&
    (authorizationHeader === null || !authorizationHeader.startsWith("Bearer "))
  ) {
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
  if (authorizationHeader !== null) {
    headers.set("authorization", authorizationHeader);
  }
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
 * Proxy one same-origin `/demos/*` GET/HEAD to the selected private service. The Google ID token
 * exists only on the Cloud Run path and is never copied into the browser response; Railway keeps
 * its existing unauthenticated private-mesh hop until cutover.
 */
export async function proxyDemosRequest(
  request: Request,
  path: string[],
  configuredOrigin: DemosOrigin | null,
  dependencies: DemosProxyDependencies = defaultDependencies,
): Promise<Response> {
  if (configuredOrigin === null) {
    return new Response("Not Found", { status: 404 });
  }
  const demosOrigin = configuredOrigin.origin;
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
    configuredOrigin.authorization === "google-id-token"
      ? await dependencies.getAuthorizationHeaders(demosOrigin)
      : new Headers();
  const upstream = await dependencies.fetchImpl(
    target,
    {
      method: request.method,
      headers: upstreamHeaders(
        request,
        authorizationHeaders,
        configuredOrigin.authorization,
      ),
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
