import { fetchWithTimeout } from "@caisson/kernel";

export interface GrafanaDatasourceEnv {
  base: string;
  token: string;
  uid: string;
}

/** GET through a Grafana datasource proxy. Dormant env and request failures resolve to null. */
export async function proxyGet(
  env: GrafanaDatasourceEnv | null,
  path: string,
  params: URLSearchParams,
  options: { timeoutMs: number },
): Promise<unknown | null> {
  if (!env) return null;
  try {
    const url = `${env.base}/api/datasources/proxy/uid/${encodeURIComponent(env.uid)}${path}?${params.toString()}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${env.token}`,
          Accept: "application/json",
        },
      },
      options,
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}
