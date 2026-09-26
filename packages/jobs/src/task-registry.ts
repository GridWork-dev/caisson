// Private task-registry lookup shared by every driver (in-memory, Trigger.dev, Inngest, pg-boss,
// BullMQ): same map construction, same NotFoundError contract on an unregistered task name.
// Registration, payload parsing, scheduling, and provider worker semantics stay driver-local.
// Generic over the task shape so this module imports nothing from queue.ts (no-circular gate).
import { NotFoundError } from "@caisson-sh/kernel";

export function createTaskRegistry<T extends { readonly name: string }>(
  tasks: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(tasks.map((task) => [task.name, task]));
}

/** The task registered under `name`, or the exact NotFoundError every driver already threw. */
export function requireRegisteredTask<T>(
  registry: ReadonlyMap<string, T>,
  name: string,
): T {
  const task = registry.get(name);
  if (task === undefined) {
    throw new NotFoundError(`No task registered for "${name}"`, {
      task: name,
    });
  }
  return task;
}
