// One dynamic route file serves every embed (ADR-0400): `/demos/embed/<module>` renders exactly
// one poke, no chrome, no nav, no analytics — the document apps/site frames inside a module page's
// media slot. Adding a poke is adding a record to POKE_IDS and an entry to the registry, never a
// new route file (the same spoke pattern the glossary and module depth pages already use).
import { notFound } from "next/navigation";

import { isPokeId, POKE_IDS } from "@/components/poke/ids";
import { Poke } from "@/components/poke/registry";

type Params = { params: Promise<{ module: string }> };

// Every embed is a static shell whose poke hydrates client-side, so the whole route set
// pre-renders at build. `dynamicParams: false` makes an unknown id a 404 instead of an
// on-demand render of a route that can never resolve — a typo'd site link fails loudly.
export const dynamicParams = false;

export function generateStaticParams() {
  return POKE_IDS.map((module) => ({ module }));
}

export default async function EmbedPage(props: Params) {
  const { module } = await props.params;
  if (!isPokeId(module)) notFound();

  return (
    <div className="embed">
      <Poke id={module} />
    </div>
  );
}
