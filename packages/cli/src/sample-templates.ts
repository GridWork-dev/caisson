// The FREE SAMPLE generator engine (ADR-0095 W3). A free, standalone, Apache-2.0 evaluation sample
// is a DIFFERENT product from the paid buyer generator (`engine-templates.ts`): it carries no
// module selection and is never composed over `base`/an edition — it is its own complete,
// self-contained template tree, so it never reaches the paid `Selection`/registry-allowlist gate
// (ADR-0095: "without giving away an edition"). It reuses the SAME read/token-replace primitives as
// the paid engine (`readTemplateDir`/`replaceTokens`, from `engine-templates.ts`/`transform.ts`) so
// the two generator paths stay mechanically consistent, but is wired through its OWN allowlist
// (`SAMPLE_TEMPLATES`) — adding a sample here never touches the paid `EDITIONS` enum.
import { join } from "node:path";
import { TEMPLATES_ROOT, readTemplateDir } from "./engine-templates.ts";
import { ProjectName } from "./seam.ts";
import type { GeneratedFile, GeneratedFileSet } from "./seam.ts";
import { replaceTokens } from "./transform.ts";

/** The allowlist/registry of free sample templates. ADR-0095 W3 ships the first: the EU-AI-Act
 *  evidence-path sample. Add a new free sample by adding its template dir + an id here. */
export const SAMPLE_TEMPLATES = ["eu-ai-act-sample"] as const;
export type SampleTemplateId = (typeof SAMPLE_TEMPLATES)[number];

const SAMPLE_ALLOWLIST: ReadonlySet<string> = new Set(SAMPLE_TEMPLATES);

/** Assert `id` is a known sample template id — checked BEFORE any path is constructed, the same
 *  fail-closed discipline `assertKnownModule` applies to the paid registry allowlist. */
export function assertKnownSample(id: string): asserts id is SampleTemplateId {
  if (!SAMPLE_ALLOWLIST.has(id)) {
    throw new Error(`unknown sample template id: ${JSON.stringify(id)}`);
  }
}

/**
 * Materialize a free sample template — `templates/<id>/`, token-substituted with just
 * `{{projectName}}` (samples carry no module selection, so no `{{moduleList}}`/`{{editionLabel}}`
 * token is offered). Validates the id against the allowlist and the project name against the SAME
 * slug rule the paid `Selection.projectName` enforces (reused directly — one rule, one place)
 * BEFORE any path construction or read.
 */
export function materializeSample(
  id: string,
  projectName: string,
): GeneratedFileSet {
  assertKnownSample(id);
  const name = ProjectName.parse(projectName);
  const dir = join(TEMPLATES_ROOT, id);
  const files: GeneratedFile[] = readTemplateDir(dir).map(
    ({ rel, content }) => ({
      path: rel,
      content: replaceTokens(content, { projectName: name }).content,
    }),
  );
  return [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
}
