import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";

// Agent-readable index (specs/03 §3). Static under output: 'export'.
export const revalidate = false;

export function GET() {
  return new Response(llms(source).index());
}
