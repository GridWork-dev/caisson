import { z } from "zod";

const stateSchema = z.enum([
  "planned",
  "applied",
  "observed",
  "reverted",
  "verified",
]);
export type MutationState = z.infer<typeof stateSchema>;

const entrySchema = z
  .object({
    id: z.string().trim().min(1),
    state: stateSchema,
    history: z.array(stateSchema),
  })
  .strict();

const journalSchema = z
  .object({
    runId: z.string().trim().min(1),
    ring: z.enum(["buyer", "admin"]),
    mutationLock: z.boolean(),
    entries: z.array(entrySchema),
    blockingFinding: z
      .object({ severity: z.literal("P0"), title: z.string().trim().min(1) })
      .strict()
      .optional(),
  })
  .strict();

export type MutationJournal = z.infer<typeof journalSchema>;

const NEXT: Record<MutationState, MutationState | null> = {
  planned: "applied",
  applied: "observed",
  observed: "reverted",
  reverted: "verified",
  verified: null,
};

export function createJournal(
  runId: string,
  ring: "buyer" | "admin",
): MutationJournal {
  return { runId, ring, mutationLock: false, entries: [] };
}

export function transitionMutation(
  input: MutationJournal,
  id: string,
  next: Exclude<MutationState, "planned">,
  options: { cleanupVerified?: boolean } = {},
): MutationJournal {
  const journal = journalSchema.parse(input);
  if (journal.mutationLock)
    throw new Error("mutation ring is locked by cleanup failure");
  const existing = journal.entries.find((entry) => entry.id === id);
  const unresolved = journal.entries.find(
    (entry) => entry.state !== "verified" && entry.id !== id,
  );
  if (unresolved)
    throw new Error(`unresolved mutation ${unresolved.id} blocks ${id}`);
  const current = existing?.state ?? "planned";
  if (NEXT[current] !== next)
    throw new Error(`invalid mutation transition: ${current} → ${next}`);
  const entry = {
    id,
    state: next,
    history: [...(existing?.history ?? ["planned" as const]), next],
  };
  const entries = existing
    ? journal.entries.map((item) => (item.id === id ? entry : item))
    : [...journal.entries, entry];
  if (next === "reverted" && options.cleanupVerified === false) {
    return {
      ...journal,
      entries,
      mutationLock: true,
      blockingFinding: {
        severity: "P0",
        title: `Cleanup could not be verified for mutation ${id}`,
      },
    };
  }
  return { ...journal, entries };
}
