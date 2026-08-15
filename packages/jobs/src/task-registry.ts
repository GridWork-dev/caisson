// Private task-registry lookup shared by every driver (in-memory, Trigger.dev, Inngest, pg-boss,
// BullMQ): same map construction, same NotFoundError contract on an unregistered task name.
// Registration, payload parsing, scheduling, and provider worker semantics stay driver-local.
import { NotFoundError } from "@caisson/kernel";
import type { TaskDefinition } from "./queue.ts";

export function createTaskRegistry(
  tasks: readonly TaskDefinition<unknown>[],
): ReadonlyMap<string, TaskDefinition<unknown>> {
  return new Map(tasks.map((task) => [task.name, task]));
}

/** The task registered under `name`, or the exact NotFoundError every driver already threw. */
export function requireRegisteredTask(
  registry: ReadonlyMap<string, TaskDefinition<unknown>>,
  name: string,
): TaskDefinition<unknown> {
  const task = registry.get(name);
  if (task === undefined) {
    throw new NotFoundError(`No task registered for "${name}"`, {
      task: name,
    });
  }
  return task;
}
