import { createGitClient } from "@posthog/git/client";

const WIP_TRAILER_KEY = "Posthog-WIP";

/**
 * Check if the working tree has uncommitted changes (staged, unstaged, or untracked).
 */
async function isDirty(repoPath: string): Promise<boolean> {
  const git = createGitClient(repoPath);
  const status = await git.status();
  return !status.isClean();
}

/**
 * Check if HEAD is a WIP commit by looking for the Posthog-WIP trailer.
 * Returns the task ID from the trailer, or null if HEAD is not a WIP commit.
 */
export async function getWipTaskId(repoPath: string): Promise<string | null> {
  const git = createGitClient(repoPath);
  const result = await git.log({ maxCount: 1, format: { body: "%B" } });
  const body = result.latest?.body ?? "";
  const match = body.match(new RegExp(`${WIP_TRAILER_KEY}: (.+)`));
  return match?.[1]?.trim() ?? null;
}

/**
 * Check if HEAD is a WIP commit without modifying anything.
 */
export async function isWipCommit(repoPath: string): Promise<boolean> {
  return (await getWipTaskId(repoPath)) !== null;
}

/**
 * Create a WIP commit with a trailer identifying the owning task.
 * Stages all changes (including untracked files) before committing.
 *
 * Returns true if a commit was created, false if the tree was clean.
 *
 * Uses --no-verify to skip hooks — these are internal bookkeeping commits
 * that never get pushed.
 */
export async function createWipCommit(
  repoPath: string,
  taskId: string,
): Promise<boolean> {
  if (!(await isDirty(repoPath))) {
    return false;
  }

  const git = createGitClient(repoPath);
  await git.add("-A");
  await git.commit(`WIP\n\n${WIP_TRAILER_KEY}: ${taskId}`, {
    "--no-verify": null,
  });
  return true;
}

/**
 * If HEAD is a WIP commit, soft-reset it to restore the working state.
 * This undoes the WIP commit but keeps all changes staged.
 *
 * Returns true if a WIP commit was unwound, false if HEAD was not a WIP.
 */
export async function unwindWipCommit(repoPath: string): Promise<boolean> {
  if (!(await isWipCommit(repoPath))) {
    return false;
  }

  const git = createGitClient(repoPath);
  await git.reset(["--soft", "HEAD~1"]);
  return true;
}
