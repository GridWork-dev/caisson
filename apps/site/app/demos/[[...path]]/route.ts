import { parseDemosOrigin, proxyDemosRequest } from "@/lib/demos-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path?: string[] }> };

async function handle(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const { path = [] } = await params;
  try {
    return await proxyDemosRequest(
      request,
      path,
      parseDemosOrigin(process.env.DEMOS_ORIGIN_URL),
    );
  } catch {
    return new Response("Demos service unavailable", { status: 502 });
  }
}

export const GET = handle;
export const HEAD = handle;
