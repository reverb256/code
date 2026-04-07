import { useSessionCallbacks } from "@features/sessions/hooks/useSessionCallbacks";
import { useSessionForTask } from "@features/sessions/hooks/useSession";
import { Eye } from "@phosphor-icons/react";
import { Button, Flex, Text } from "@radix-ui/themes";
import type { Task } from "@shared/types";

interface CloudGitInteractionHeaderProps {
  taskId: string;
  task: Task;
}

export function CloudGitInteractionHeader({
  taskId,
  task,
}: CloudGitInteractionHeaderProps) {
  const session = useSessionForTask(taskId);
  const prUrl = (session?.cloudOutput?.pr_url as string) ?? null;
  const { handleContinueLocally } = useSessionCallbacks({
    taskId,
    task,
    session: session ?? undefined,
    repoPath: null,
  });

  return (
    <Flex className="no-drag" align="center" gap="2">
      <Button
        size="1"
        variant="soft"
        disabled={session?.handoffInProgress}
        onClick={handleContinueLocally}
      >
        <Text size="1">
          {session?.handoffInProgress ? "Transferring..." : "Continue locally"}
        </Text>
      </Button>
      {prUrl && (
        <Button size="1" variant="solid" asChild>
          <a href={prUrl} target="_blank" rel="noopener noreferrer">
            <Flex align="center" gap="2">
              <Eye size={12} weight="bold" />
              <Text size="1">View PR</Text>
            </Flex>
          </a>
        </Button>
      )}
    </Flex>
  );
}
