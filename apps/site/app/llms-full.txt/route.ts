import { getLLMText, source } from "@/lib/source";

// The full concatenated corpus for agents (specs/03 §3). Static under output: 'export'.
export const dynamic = "force-static";

export async function GET() {
  const scanned = await Promise.all(source.getPages().map(getLLMText));
  return new Response(scanned.join("\n\n"));
}
