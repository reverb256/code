import { BackgroundWrapper } from "@components/BackgroundWrapper";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { useFolders } from "@features/folders/hooks/useFolders";
import {
  useCloudBranchChangedFiles,
  useCloudPrChangedFiles,
} from "@features/git-interaction/hooks/useGitQueries";
import { useDraftStore } from "@features/message-editor/stores/draftStore";
import { ProvisioningView } from "@features/provisioning/components/ProvisioningView";
import { useProvisioningStore } from "@features/provisioning/stores/provisioningStore";
import { SessionView } from "@features/sessions/components/SessionView";
import { useSessionCallbacks } from "@features/sessions/hooks/useSessionCallbacks";
import { useSessionConnection } from "@features/sessions/hooks/useSessionConnection";
import { useSessionViewState } from "@features/sessions/hooks/useSessionViewState";
import { useRestoreTask } from "@features/suspension/hooks/useRestoreTask";
import { useSuspendedTaskIds } from "@features/suspension/hooks/useSuspendedTaskIds";
import { WorkspaceSetupPrompt } from "@features/task-detail/components/WorkspaceSetupPrompt";
import { useCloudRunState } from "@features/task-detail/hooks/useCloudRunState";
import {
  useCreateWorkspace,
  useWorkspaceLoaded,
} from "@features/workspace/hooks/useWorkspace";
import { Box, Button, Flex, Spinner, Text } from "@radix-ui/themes";
import type { Task } from "@shared/types";
import type { AcpMessage } from "@shared/types/session-events";
import { getTaskRepository } from "@utils/repository";
import { useCallback, useEffect, useMemo } from "react";

interface TaskLogsPanelProps {
  taskId: string;
  task: Task;
}

export function TaskLogsPanel({ taskId, task }: TaskLogsPanelProps) {
  const { freshTask } = useCloudRunState(taskId, task);
  const effectiveTask = freshTask;
  const isWorkspaceLoaded = useWorkspaceLoaded();
  const { isPending: isCreatingWorkspace } = useCreateWorkspace();
  const repoKey = getTaskRepository(effectiveTask);
  const { folders } = useFolders();
  const hasDirectoryMapping = repoKey
    ? folders.some((f) => f.remoteUrl === repoKey)
    : false;

  const suspendedTaskIds = useSuspendedTaskIds();
  const isSuspended = suspendedTaskIds.has(taskId);
  const { restoreTask, isRestoring } = useRestoreTask();

  const isProvisioning = useProvisioningStore((s) => s.activeTasks.has(taskId));

  const { requestFocus } = useDraftStore((s) => s.actions);

  const {
    session,
    repoPath,
    isCloud,
    isCloudRunNotTerminal,
    cloudStatus,
    isRunning,
    hasError,
    events,
    isPromptPending,
    promptStartedAt,
    isInitializing,
    cloudBranch,
    errorTitle,
    errorMessage,
  } = useSessionViewState(taskId, effectiveTask);

  useSessionConnection({
    taskId,
    task: effectiveTask,
    session,
    repoPath,
    isCloud,
    isSuspended,
  });

  const {
    handleSendPrompt,
    handleCancelPrompt,
    handleRetry,
    handleNewSession,
    handleBashCommand,
  } = useSessionCallbacks({ taskId, task: effectiveTask, session, repoPath });

  const cloudStage =
    session?.cloudStage ?? effectiveTask.latest_run?.stage ?? null;
  const cloudOutput =
    session?.cloudOutput ?? effectiveTask.latest_run?.output ?? null;
  const cloudErrorMessage =
    session?.cloudErrorMessage ??
    effectiveTask.latest_run?.error_message ??
    null;
  const prUrl =
    isCloud && cloudOutput?.pr_url ? (cloudOutput.pr_url as string) : null;
  const slackThreadUrl =
    typeof effectiveTask.latest_run?.state?.slack_thread_url === "string"
      ? effectiveTask.latest_run.state.slack_thread_url
      : undefined;

  const cloudRepo = isCloud ? (effectiveTask.repository ?? null) : null;
  const { data: prFiles } = useCloudPrChangedFiles(prUrl);
  const { data: branchFiles } = useCloudBranchChangedFiles(
    !prUrl ? cloudRepo : null,
    !prUrl ? cloudBranch : null,
  );
  const cloudDiffStats = useMemo(() => {
    if (!isCloud) return null;
    const files = prUrl ? prFiles : branchFiles;
    if (!files || files.length === 0) return null;
    return {
      filesChanged: files.length,
      linesAdded: files.reduce((sum, f) => sum + (f.linesAdded ?? 0), 0),
      linesRemoved: files.reduce((sum, f) => sum + (f.linesRemoved ?? 0), 0),
    };
  }, [isCloud, prUrl, prFiles, branchFiles]);

  const displayEvents = useMemo(() => {
    if (events.length > 0) return events;
    if (!isCloud || isCloudRunNotTerminal) return events;

    const fallbackMarkdown = buildCloudFallbackMarkdown({
      prompt: effectiveTask.description,
      repository: effectiveTask.repository ?? null,
      branch: effectiveTask.latest_run?.branch ?? cloudBranch ?? null,
      stage: cloudStage,
      status: cloudStatus ?? effectiveTask.latest_run?.status ?? null,
      output: cloudOutput,
      errorMessage: cloudErrorMessage,
    });

    if (!fallbackMarkdown) return events;

    const startedAt = effectiveTask.latest_run?.created_at
      ? new Date(effectiveTask.latest_run.created_at).getTime()
      : Date.now();
    const syntheticEvents: AcpMessage[] = [];

    if (effectiveTask.description?.trim()) {
      syntheticEvents.push(
        createSyntheticUserPromptEvent(
          effectiveTask.description.trim(),
          startedAt - 1,
        ),
      );
    }

    syntheticEvents.push(
      createSyntheticAgentMessageEvent(fallbackMarkdown, startedAt),
    );

    return syntheticEvents;
  }, [
    events,
    isCloud,
    isCloudRunNotTerminal,
    effectiveTask.description,
    effectiveTask.repository,
    effectiveTask.latest_run?.branch,
    effectiveTask.latest_run?.created_at,
    effectiveTask.latest_run?.status,
    cloudBranch,
    cloudStage,
    cloudStatus,
    cloudOutput,
    cloudErrorMessage,
  ]);

  useEffect(() => {
    requestFocus(taskId);
  }, [taskId, requestFocus]);

  const handleRestoreWorktree = useCallback(async () => {
    await restoreTask(taskId);
  }, [taskId, restoreTask]);

  if (isProvisioning) {
    return <ProvisioningView taskId={taskId} />;
  }

  if (
    !repoPath &&
    !isCloud &&
    !isSuspended &&
    isWorkspaceLoaded &&
    !hasDirectoryMapping &&
    !isCreatingWorkspace
  ) {
    return (
      <BackgroundWrapper>
        <Box height="100%" width="100%">
          <WorkspaceSetupPrompt taskId={taskId} task={effectiveTask} />
        </Box>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      <Flex direction="column" height="100%" width="100%">
        <Box style={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary name="SessionView">
            <SessionView
              events={displayEvents}
              taskId={taskId}
              isRunning={isRunning}
              isSuspended={isSuspended}
              onRestoreWorktree={
                isSuspended ? handleRestoreWorktree : undefined
              }
              isRestoring={isRestoring}
              isPromptPending={isCloud ? null : isPromptPending}
              promptStartedAt={isCloud ? undefined : promptStartedAt}
              onSendPrompt={handleSendPrompt}
              onBashCommand={isCloud ? undefined : handleBashCommand}
              onCancelPrompt={handleCancelPrompt}
              repoPath={repoPath}
              cloudBranch={cloudBranch}
              cloudDiffStats={cloudDiffStats}
              hasError={hasError}
              errorTitle={errorTitle}
              errorMessage={errorMessage}
              onRetry={isCloud ? undefined : handleRetry}
              onNewSession={isCloud ? undefined : handleNewSession}
              isInitializing={isInitializing}
              slackThreadUrl={slackThreadUrl}
            />
          </ErrorBoundary>
        </Box>
        {isCloud && (
          <Flex
            align="center"
            justify="center"
            gap="2"
            py="2"
            className="border-gray-4 border-t"
          >
            {prUrl ? (
              <>
                <Text size="2" color="gray">
                  Task completed
                </Text>
                <Button size="2" variant="soft" asChild>
                  <a href={prUrl} target="_blank" rel="noopener noreferrer">
                    View Pull Request
                  </a>
                </Button>
              </>
            ) : isCloudRunNotTerminal ? (
              <>
                <Spinner size="2" />
                <Text size="2" color="gray">
                  Running in cloud
                  {cloudStage ? ` \u2014 ${cloudStage}` : ""}
                  ...
                </Text>
              </>
            ) : cloudStatus === "failed" ? (
              <Text size="2" color="red">
                Task failed
                {cloudErrorMessage ? `: ${cloudErrorMessage}` : ""}
              </Text>
            ) : cloudStatus === "cancelled" ? (
              <Text size="2" color="red">
                Task cancelled
              </Text>
            ) : cloudStatus ? (
              <Text size="2" color="gray">
                Cloud task completed
              </Text>
            ) : null}
          </Flex>
        )}
      </Flex>
    </BackgroundWrapper>
  );
}

function createSyntheticUserPromptEvent(text: string, ts: number): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      id: ts,
      method: "session/prompt",
      params: {
        prompt: [{ type: "text", text }],
      },
    },
  };
}

function createSyntheticAgentMessageEvent(
  text: string,
  ts: number,
): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "agent_message",
          content: { type: "text", text },
        },
      },
    },
  };
}

function buildCloudFallbackMarkdown({
  prompt,
  repository,
  branch,
  stage,
  status,
  output,
  errorMessage,
}: {
  prompt?: string | null;
  repository?: string | null;
  branch?: string | null;
  stage?: string | null;
  status?: string | null;
  output?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): string | null {
  const sections: string[] = [
    "No transcript was recorded for this cloud run, so this view is showing the persisted run output instead.",
  ];

  const naturalLanguageOutput = findNaturalLanguageOutput(output);
  if (naturalLanguageOutput) {
    sections.push(naturalLanguageOutput);
  }

  if (errorMessage) {
    sections.push(`**Run error**\n\n${errorMessage}`);
  }

  const metadata = [
    status ? `- Status: \`${status}\`` : null,
    stage ? `- Stage: \`${stage}\`` : null,
    repository ? `- Repository: \`${repository}\`` : null,
    branch ? `- Branch: \`${branch}\`` : null,
    readString(output, "pr_url")
      ? `- Pull request: ${readString(output, "pr_url")}`
      : null,
    readString(output, "commit_sha")
      ? `- Commit: \`${readString(output, "commit_sha")}\``
      : null,
  ].filter(Boolean);

  if (metadata.length > 0) {
    sections.push(`**Run metadata**\n\n${metadata.join("\n")}`);
  }

  const structuredOutput = buildStructuredOutputBlock(
    output,
    naturalLanguageOutput,
  );
  if (structuredOutput) {
    sections.push(structuredOutput);
  }

  if (sections.length === 1 && prompt?.trim()) {
    return null;
  }

  return sections.join("\n\n");
}

function findNaturalLanguageOutput(
  output: Record<string, unknown> | null | undefined,
): string | null {
  if (!output) return null;

  const candidateKeys = [
    "summary",
    "message",
    "result",
    "response",
    "content",
    "text",
    "final_output",
  ] as const;

  for (const key of candidateKeys) {
    const value = output[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildStructuredOutputBlock(
  output: Record<string, unknown> | null | undefined,
  naturalLanguageOutput: string | null,
): string | null {
  if (!output || Object.keys(output).length === 0) return null;

  const filteredEntries = Object.entries(output).filter(([key, value]) => {
    if (value == null) return false;
    if (
      naturalLanguageOutput &&
      [
        "summary",
        "message",
        "result",
        "response",
        "content",
        "text",
        "final_output",
      ].includes(key) &&
      value === naturalLanguageOutput
    ) {
      return false;
    }
    return !["pr_url", "commit_sha"].includes(key);
  });

  if (filteredEntries.length === 0) return null;

  return `**Structured output**\n\n\`\`\`json\n${JSON.stringify(
    Object.fromEntries(filteredEntries),
    null,
    2,
  )}\n\`\`\``;
}

function readString(
  output: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = output?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}
