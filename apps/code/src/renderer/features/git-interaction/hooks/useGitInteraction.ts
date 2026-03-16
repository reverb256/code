import { useAuthStore } from "@features/auth/stores/authStore";
import { useGitQueries } from "@features/git-interaction/hooks/useGitQueries";
import { useGraphiteQueries } from "@features/git-interaction/hooks/useGraphiteQueries";
import { computeGitInteractionState } from "@features/git-interaction/state/gitInteractionLogic";
import {
  type GitInteractionStore,
  useGitInteractionStore,
} from "@features/git-interaction/state/gitInteractionStore";
import type {
  CommitNextStep,
  GitMenuAction,
  GitMenuActionId,
} from "@features/git-interaction/types";
import {
  sanitizeBranchName,
  validateBranchName,
} from "@features/git-interaction/utils/branchNameValidation";
import { invalidateGitBranchQueries } from "@features/git-interaction/utils/gitCacheKeys";
import { updateGitCacheFromSnapshot } from "@features/git-interaction/utils/updateGitCache";
import { trpc, trpcClient } from "@renderer/trpc";
import { ANALYTICS_EVENTS } from "@shared/types/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { track } from "@utils/analytics";
import { logger } from "@utils/logger";
import { useMemo } from "react";

const log = logger.scope("git-interaction");

export type { GitMenuAction, GitMenuActionId };

interface GitInteractionState {
  primaryAction: GitMenuAction;
  actions: GitMenuAction[];
  hasChanges: boolean;
  aheadOfRemote: number;
  behind: number;
  currentBranch: string | null;
  defaultBranch: string | null;
  prBaseBranch: string | null;
  prHeadBranch: string | null;
  diffStats: { filesChanged: number; linesAdded: number; linesRemoved: number };
  prUrl: string | null;
  pushDisabledReason: string | null;
  prDisabledReason: string | null;
  isLoading: boolean;
  isGraphiteRepo: boolean;
  graphiteStack: {
    trunk: string;
    entries: Array<{
      branchName: string;
      isCurrent: boolean;
      isTrunk: boolean;
      needsRestack: boolean;
      prNumber: number | null;
      prUrl: string | null;
      prTitle: string | null;
      prStatus: string | null;
    }>;
    currentStack: Array<{
      branchName: string;
      isCurrent: boolean;
      isTrunk: boolean;
      needsRestack: boolean;
      prNumber: number | null;
      prUrl: string | null;
      prTitle: string | null;
      prStatus: string | null;
    }> | null;
  } | null;
}

interface GitInteractionActions {
  openAction: (actionId: GitMenuActionId) => void;
  closeCommit: () => void;
  closePush: () => void;
  closePr: () => void;
  closeBranch: () => void;
  setCommitMessage: (value: string) => void;
  setCommitNextStep: (value: CommitNextStep) => void;
  setPrTitle: (value: string) => void;
  setPrBody: (value: string) => void;
  setBranchName: (value: string) => void;
  runCommit: () => Promise<void>;
  runPush: () => Promise<void>;
  runPr: () => Promise<void>;
  runBranch: () => Promise<void>;
  generateCommitMessage: () => Promise<void>;
  generatePrTitleAndBody: () => Promise<void>;
  runStackSubmit: () => Promise<void>;
  runStackSync: () => Promise<void>;
  runStackModify: () => Promise<void>;
  runStackCreate: () => Promise<void>;
}

function trackGitAction(taskId: string, actionType: string, success: boolean) {
  track(ANALYTICS_EVENTS.GIT_ACTION_EXECUTED, {
    action_type: actionType as
      | "commit"
      | "push"
      | "sync"
      | "publish"
      | "create-pr"
      | "view-pr"
      | "update-pr",
    success,
    task_id: taskId,
  });
}

export function useGitInteraction(
  taskId: string,
  repoPath?: string,
): {
  state: GitInteractionState;
  modals: GitInteractionStore;
  actions: GitInteractionActions;
} {
  const queryClient = useQueryClient();
  const store = useGitInteractionStore();
  const { actions: modal } = store;

  const git = useGitQueries(repoPath);
  const graphite = useGraphiteQueries(repoPath);

  const computed = useMemo(
    () =>
      computeGitInteractionState({
        repoPath,
        isRepo: git.isRepo,
        isRepoLoading: git.isRepoLoading,
        hasChanges: git.hasChanges,
        aheadOfRemote: git.aheadOfRemote,
        behind: git.behind,
        aheadOfDefault: git.aheadOfDefault,
        hasRemote: git.hasRemote,
        isFeatureBranch: git.isFeatureBranch,
        currentBranch: git.currentBranch,
        defaultBranch: git.defaultBranch,
        ghStatus: git.ghStatus ?? null,
        repoInfo: git.repoInfo ?? null,
        prStatus: git.prStatus ?? null,
        isGraphiteRepo: graphite.isGraphiteRepo,
      }),
    [
      repoPath,
      git.isRepo,
      git.isRepoLoading,
      git.hasChanges,
      git.aheadOfRemote,
      git.behind,
      git.aheadOfDefault,
      git.hasRemote,
      git.isFeatureBranch,
      git.currentBranch,
      git.defaultBranch,
      git.ghStatus,
      git.repoInfo,
      git.prStatus,
      graphite.isGraphiteRepo,
    ],
  );

  const openCreatePr = async () => {
    modal.openPr("", "");
    if (!repoPath) return;

    const authState = useAuthStore.getState();
    const apiKey = authState.oauthAccessToken;
    const cloudRegion = authState.cloudRegion;
    if (!apiKey || !cloudRegion) return;

    const apiHost =
      cloudRegion === "eu"
        ? "https://eu.posthog.com"
        : "https://us.posthog.com";

    modal.setIsGeneratingPr(true);
    try {
      const result = await trpcClient.git.generatePrTitleAndBody.mutate({
        directoryPath: repoPath,
        credentials: { apiKey, apiHost },
      });
      if (result.title || result.body) {
        modal.setPrTitle(result.title);
        modal.setPrBody(result.body);
      }
    } catch (error) {
      log.error("Failed to auto-generate PR title and body", error);
    } finally {
      modal.setIsGeneratingPr(false);
    }
  };

  const openAction = (id: GitMenuActionId) => {
    const actionMap: Record<GitMenuActionId, () => void> = {
      commit: () => modal.openCommit("commit"),
      push: () => modal.openPush("push"),
      sync: () => modal.openPush("sync"),
      publish: () => modal.openPush("publish"),
      "view-pr": () => viewPr(),
      "create-pr": () => openCreatePr(),
      "branch-here": () => modal.openBranch(),
      "stack-submit": () => modal.openStackSubmit(),
      "stack-sync": () => modal.openStackSync(),
      "stack-modify": () => modal.openStackModify(),
      "stack-create": () => modal.openStackCreate(),
    };
    actionMap[id]();
  };

  const viewPr = async () => {
    if (!repoPath) return;
    const result = await trpcClient.git.openPr.mutate({
      directoryPath: repoPath,
    });
    if (result.success && result.prUrl) {
      await trpcClient.os.openExternal.mutate({ url: result.prUrl });
    }
  };

  const runCommit = async () => {
    if (!repoPath) return;

    if (store.commitNextStep === "commit-pr" && computed.prDisabledReason) {
      modal.setCommitError(computed.prDisabledReason);
      return;
    }

    if (store.commitNextStep === "commit-push" && computed.pushDisabledReason) {
      modal.setCommitError(computed.pushDisabledReason);
      return;
    }

    modal.setIsSubmitting(true);
    modal.setCommitError(null);

    let message = store.commitMessage.trim();

    if (!message) {
      const authState = useAuthStore.getState();
      const apiKey = authState.oauthAccessToken;
      const cloudRegion = authState.cloudRegion;

      if (!apiKey || !cloudRegion) {
        modal.setCommitError(
          "Authentication required to generate commit message.",
        );
        modal.setIsSubmitting(false);
        return;
      }

      const apiHost =
        cloudRegion === "eu"
          ? "https://eu.posthog.com"
          : "https://us.posthog.com";

      try {
        const generated = await trpcClient.git.generateCommitMessage.mutate({
          directoryPath: repoPath,
          credentials: { apiKey, apiHost },
        });

        if (!generated.message) {
          modal.setCommitError(
            "No changes detected to generate a commit message.",
          );
          modal.setIsSubmitting(false);
          return;
        }

        message = generated.message;
        modal.setCommitMessage(message);
      } catch (error) {
        log.error("Failed to generate commit message", error);
        modal.setCommitError(
          error instanceof Error
            ? error.message
            : "Failed to generate commit message.",
        );
        modal.setIsSubmitting(false);
        return;
      }
    }

    try {
      const result = await trpcClient.git.commit.mutate({
        directoryPath: repoPath,
        message,
      });

      if (!result.success) {
        trackGitAction(taskId, "commit", false);
        modal.setCommitError(result.message || "Commit failed.");
        return;
      }

      trackGitAction(taskId, "commit", true);

      if (result.state) {
        updateGitCacheFromSnapshot(queryClient, repoPath, result.state);
      }

      modal.setCommitMessage("");
      modal.closeCommit();

      const shouldPush =
        store.commitNextStep === "commit-push" ||
        store.commitNextStep === "commit-pr";
      if (shouldPush) {
        if (store.commitNextStep === "commit-pr" && !git.prStatus?.prExists) {
          modal.setOpenPrAfterPush(true);
        }
        modal.openPush(git.hasRemote ? "push" : "publish");
      }
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runPush = async () => {
    if (!repoPath) return;

    modal.setIsSubmitting(true);
    modal.setPushError(null);

    try {
      const pushFn =
        store.pushMode === "sync"
          ? trpcClient.git.sync
          : store.pushMode === "publish"
            ? trpcClient.git.publish
            : trpcClient.git.push;

      const result = await pushFn.mutate({ directoryPath: repoPath });

      if (!result.success) {
        const message =
          "message" in result
            ? result.message
            : `Pull: ${result.pullMessage}, Push: ${result.pushMessage}`;
        trackGitAction(taskId, store.pushMode, false);
        modal.setPushError(message || "Push failed.");
        modal.setPushState("error");
        return;
      }

      trackGitAction(taskId, store.pushMode, true);

      if (result.state) {
        updateGitCacheFromSnapshot(queryClient, repoPath, result.state);
      }

      modal.setPushState("success");

      if (store.openPrAfterPush) {
        modal.closePush();
        modal.setOpenPrAfterPush(false);
        openCreatePr();
      }
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runPr = async () => {
    if (!repoPath) return;

    const title = store.prTitle.trim();
    const body = store.prBody.trim();

    if (!title) {
      modal.setPrError("PR title is required.");
      return;
    }

    modal.setIsSubmitting(true);
    modal.setPrError(null);

    try {
      if (!git.hasRemote || git.aheadOfRemote > 0) {
        const pushFn = git.hasRemote
          ? trpcClient.git.push
          : trpcClient.git.publish;
        const pushResult = await pushFn.mutate({ directoryPath: repoPath });

        if (!pushResult.success) {
          trackGitAction(taskId, "create-pr", false);
          modal.setPrError(
            pushResult.message || "Failed to push before creating PR.",
          );
          return;
        }

        if (pushResult.state) {
          updateGitCacheFromSnapshot(queryClient, repoPath, pushResult.state);
        }
      }

      const result = await trpcClient.git.createPr.mutate({
        directoryPath: repoPath,
        title,
        body,
      });

      if (!result.success || !result.prUrl) {
        trackGitAction(taskId, "create-pr", false);
        modal.setPrError(result.message || "Unable to create PR.");
        return;
      }

      trackGitAction(taskId, "create-pr", true);
      track(ANALYTICS_EVENTS.PR_CREATED, { task_id: taskId, success: true });

      if (result.state) {
        updateGitCacheFromSnapshot(queryClient, repoPath, result.state);
      }

      await trpcClient.os.openExternal.mutate({ url: result.prUrl });
      modal.closePr();
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const generateCommitMessage = async () => {
    if (!repoPath) return;

    const authState = useAuthStore.getState();
    const apiKey = authState.oauthAccessToken;
    const cloudRegion = authState.cloudRegion;

    if (!apiKey || !cloudRegion) {
      modal.setCommitError(
        "Authentication required to generate commit message.",
      );
      return;
    }

    const apiHost =
      cloudRegion === "eu"
        ? "https://eu.posthog.com"
        : "https://us.posthog.com";

    modal.setIsGeneratingCommitMessage(true);
    modal.setCommitError(null);

    try {
      const result = await trpcClient.git.generateCommitMessage.mutate({
        directoryPath: repoPath,
        credentials: { apiKey, apiHost },
      });

      if (result.message) {
        modal.setCommitMessage(result.message);
      } else {
        modal.setCommitError(
          "No changes detected to generate a commit message.",
        );
      }
    } catch (error) {
      log.error("Failed to generate commit message", error);
      modal.setCommitError(
        error instanceof Error
          ? error.message
          : "Failed to generate commit message.",
      );
    } finally {
      modal.setIsGeneratingCommitMessage(false);
    }
  };

  const generatePrTitleAndBody = async () => {
    if (!repoPath) return;

    const authState = useAuthStore.getState();
    const apiKey = authState.oauthAccessToken;
    const cloudRegion = authState.cloudRegion;

    if (!apiKey || !cloudRegion) {
      modal.setPrError("Authentication required to generate PR description.");
      return;
    }

    const apiHost =
      cloudRegion === "eu"
        ? "https://eu.posthog.com"
        : "https://us.posthog.com";

    modal.setIsGeneratingPr(true);
    modal.setPrError(null);

    try {
      const result = await trpcClient.git.generatePrTitleAndBody.mutate({
        directoryPath: repoPath,
        credentials: { apiKey, apiHost },
      });

      if (result.title || result.body) {
        modal.setPrTitle(result.title);
        modal.setPrBody(result.body);
      } else {
        modal.setPrError("No changes detected to generate PR description.");
      }
    } catch (error) {
      log.error("Failed to generate PR title and body", error);
      modal.setPrError(
        error instanceof Error
          ? error.message
          : "Failed to generate PR description.",
      );
    } finally {
      modal.setIsGeneratingPr(false);
    }
  };

  const runBranch = async () => {
    if (!repoPath) return;

    const branchName = store.branchName.trim();
    if (!branchName) {
      modal.setBranchError("Branch name is required.");
      return;
    }

    const validationError = validateBranchName(branchName);
    if (validationError) {
      modal.setBranchError(validationError);
      return;
    }

    modal.setIsSubmitting(true);
    modal.setBranchError(null);

    try {
      await trpcClient.git.createBranch.mutate({
        directoryPath: repoPath,
        branchName,
      });

      trackGitAction(taskId, "branch-here", true);

      invalidateGitBranchQueries(repoPath);
      await queryClient.invalidateQueries(trpc.workspace.getAll.pathFilter());

      modal.closeBranch();
    } catch (error) {
      log.error("Failed to create branch", error);
      trackGitAction(taskId, "branch-here", false);
      modal.setBranchError(
        error instanceof Error ? error.message : "Failed to create branch.",
      );
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runStackSubmit = async () => {
    if (!repoPath) return;

    modal.setIsSubmitting(true);
    modal.setStackSubmitError(null);

    try {
      const result = await trpcClient.graphite.submit.mutate({
        directoryPath: repoPath,
        stack: true,
        draft: store.stackSubmitDraft,
      });

      if (!result.success) {
        trackGitAction(taskId, "stack-submit", false);
        modal.setStackSubmitError(result.error || "Submit failed.");
        return;
      }

      trackGitAction(taskId, "stack-submit", true);
      modal.closeStackSubmit();
    } catch (error) {
      log.error("Failed to submit stack", error);
      trackGitAction(taskId, "stack-submit", false);
      modal.setStackSubmitError(
        error instanceof Error ? error.message : "Failed to submit stack.",
      );
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runStackSync = async () => {
    if (!repoPath) return;

    modal.setIsSubmitting(true);
    modal.setStackSyncError(null);

    try {
      const result = await trpcClient.graphite.sync.mutate({
        directoryPath: repoPath,
      });

      if (!result.success) {
        trackGitAction(taskId, "stack-sync", false);
        modal.setStackSyncError(result.error || "Sync failed.");
        return;
      }

      trackGitAction(taskId, "stack-sync", true);

      invalidateGitBranchQueries(repoPath);
      await queryClient.invalidateQueries(trpc.workspace.getAll.pathFilter());

      modal.closeStackSync();
    } catch (error) {
      log.error("Failed to sync", error);
      trackGitAction(taskId, "stack-sync", false);
      modal.setStackSyncError(
        error instanceof Error ? error.message : "Failed to sync.",
      );
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runStackModify = async () => {
    if (!repoPath) return;

    modal.setIsSubmitting(true);
    modal.setStackModifyError(null);

    try {
      const result = await trpcClient.graphite.modify.mutate({
        directoryPath: repoPath,
      });

      if (!result.success) {
        trackGitAction(taskId, "stack-modify", false);
        modal.setStackModifyError(result.error || "Modify failed.");
        return;
      }

      trackGitAction(taskId, "stack-modify", true);

      invalidateGitBranchQueries(repoPath);
      await queryClient.invalidateQueries(trpc.workspace.getAll.pathFilter());

      modal.closeStackModify();
    } catch (error) {
      log.error("Failed to modify stack branch", error);
      trackGitAction(taskId, "stack-modify", false);
      modal.setStackModifyError(
        error instanceof Error ? error.message : "Failed to modify branch.",
      );
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  const runStackCreate = async () => {
    if (!repoPath) return;

    const message = store.stackCreateMessage.trim();
    if (!message) {
      modal.setStackCreateError("Message is required.");
      return;
    }

    modal.setIsSubmitting(true);
    modal.setStackCreateError(null);

    try {
      const result = await trpcClient.graphite.createBranch.mutate({
        directoryPath: repoPath,
        message,
      });

      if (!result.success) {
        trackGitAction(taskId, "stack-create", false);
        modal.setStackCreateError(result.error || "Failed to create branch.");
        return;
      }

      trackGitAction(taskId, "stack-create", true);

      invalidateGitBranchQueries(repoPath);
      await queryClient.invalidateQueries(trpc.workspace.getAll.pathFilter());

      modal.closeStackCreate();
    } catch (error) {
      log.error("Failed to create stack branch", error);
      trackGitAction(taskId, "stack-create", false);
      modal.setStackCreateError(
        error instanceof Error ? error.message : "Failed to create branch.",
      );
    } finally {
      modal.setIsSubmitting(false);
    }
  };

  return {
    state: {
      primaryAction: computed.primaryAction,
      actions: computed.actions,
      hasChanges: git.hasChanges,
      aheadOfRemote: git.aheadOfRemote,
      behind: git.behind,
      currentBranch: git.currentBranch,
      defaultBranch: git.defaultBranch,
      prBaseBranch: computed.prBaseBranch,
      prHeadBranch: computed.prHeadBranch,
      diffStats: git.diffStats,
      prUrl: computed.prUrl,
      pushDisabledReason: computed.pushDisabledReason,
      prDisabledReason: computed.prDisabledReason,
      isLoading: git.isLoading,
      isGraphiteRepo: graphite.isGraphiteRepo,
      graphiteStack: graphite.stack,
    },
    modals: store,
    actions: {
      openAction,
      closeCommit: modal.closeCommit,
      closePush: modal.closePush,
      closePr: modal.closePr,
      closeBranch: modal.closeBranch,
      setCommitMessage: modal.setCommitMessage,
      setCommitNextStep: modal.setCommitNextStep,
      setPrTitle: modal.setPrTitle,
      setPrBody: modal.setPrBody,
      setBranchName: (value: string) => {
        const sanitized = sanitizeBranchName(value);
        modal.setBranchName(sanitized);
        modal.setBranchError(validateBranchName(sanitized));
      },
      runCommit,
      runPush,
      runPr,
      runBranch,
      generateCommitMessage,
      generatePrTitleAndBody,
      runStackSubmit,
      runStackSync,
      runStackModify,
      runStackCreate,
    },
  };
}
