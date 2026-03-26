/**
 * Sanitize a string for use in a git branch name.
 * Replaces spaces/underscores with dashes, strips invalid characters,
 * and cleans up consecutive or trailing dashes/dots.
 */
function sanitizeForBranch(input: string): string {
  return (
    input
      .toLowerCase()
      // Replace spaces and underscores with dashes
      .replace(/[\s_]+/g, "-")
      // Strip characters invalid for git refs: ~ ^ : ? * [ ] \ @ { }
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ASCII control characters forbidden by git
      .replace(/[~^:?*[\]\\@{}"\x00-\x1f\x7f]/g, "")
      // Collapse consecutive dashes/dots
      .replace(/-{2,}/g, "-")
      .replace(/\.{2,}/g, ".")
      // Strip leading/trailing dashes and dots
      .replace(/^[-.]|[-.]$/g, "")
  );
}

/**
 * Generate a branch name for a task.
 *
 * Format: `posthog/<task_number>-<slug>` when task_number is available,
 * otherwise `posthog/task-<short_id>`.
 *
 * Branch names are truncated to ~60 characters to stay within git's
 * practical limits while remaining readable.
 */
export function generateTaskBranchName(task: {
  task_number: number | null;
  slug: string;
  id: string;
}): string {
  const prefix = "posthog/";
  const maxLength = 60;

  if (task.task_number != null) {
    const numberPrefix = `${task.task_number}-`;
    const sanitizedSlug = sanitizeForBranch(task.slug);
    const maxSlugLength = maxLength - prefix.length - numberPrefix.length;
    const truncatedSlug = sanitizedSlug
      .substring(0, maxSlugLength)
      .replace(/-$/, "");
    return `${prefix}${numberPrefix}${truncatedSlug}`;
  }

  return `${prefix}task-${task.id.substring(0, 8)}`;
}
