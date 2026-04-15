import type { Task } from "@shared/types";
import { queryClient } from "@utils/queryClient";

/**
 * Check whether the auto-generated title should be applied for a given task.
 * This must be called AFTER any async work (e.g., LLM title generation)
 * to avoid race conditions where the user manually renames during generation.
 */
export function shouldApplyAutoTitle(taskId: string): boolean {
  const cachedTasks = queryClient.getQueryData<Task[]>(["tasks", "list"]);
  const cachedTask = cachedTasks?.find((t) => t.id === taskId);
  if (cachedTask?.title_manually_set) {
    return false;
  }
  return true;
}
