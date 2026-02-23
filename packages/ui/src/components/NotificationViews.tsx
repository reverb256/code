import {
  CheckCircle,
  Lightning,
  Spinner,
  Stop,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { Badge, Box, Callout, Flex, Text } from "@radix-ui/themes";

export function ConsoleMessage({
  level,
  message,
}: {
  level: "info" | "debug" | "warn" | "error";
  message: string;
  timestamp?: string;
}) {
  const color =
    level === "error"
      ? "text-red-11"
      : level === "warn"
        ? "text-yellow-11"
        : level === "debug"
          ? "text-purple-11"
          : "text-gray-10";

  return (
    <Box className="border-gray-4 border-l-2 py-0.5 pl-3">
      <Text size="1" className="font-mono text-gray-11">
        <Text className={color}>[{level}]</Text> {message}
      </Text>
    </Box>
  );
}

export function CompactBoundaryView({
  trigger,
  preTokens,
}: {
  trigger: "manual" | "auto";
  preTokens: number;
}) {
  const tokensK = Math.round(preTokens / 1000);
  return (
    <Box className="my-1 border-blue-6 border-l-2 py-1 pl-3">
      <Flex align="center" gap="2">
        <Lightning size={14} weight="fill" className="text-blue-9" />
        <Text size="1" className="text-gray-11">
          Conversation compacted
        </Text>
        <Badge
          size="1"
          color={trigger === "auto" ? "orange" : "blue"}
          variant="soft"
        >
          {trigger}
        </Badge>
        <Text size="1" className="text-gray-9">
          (~{tokensK}K tokens summarized)
        </Text>
      </Flex>
    </Box>
  );
}

export function StatusNotificationView({
  status,
  isComplete,
}: {
  status: string;
  isComplete?: boolean;
}) {
  if (status === "compacting") {
    if (isComplete) return null;
    return (
      <Box className="my-1 border-blue-6 border-l-2 py-1 pl-3">
        <Flex align="center" gap="2">
          <Spinner size={14} className="animate-spin text-blue-9" />
          <Text size="1" className="text-gray-11">
            Compacting conversation history...
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box className="my-1 border-gray-6 border-l-2 py-1 pl-3">
      <Flex align="center" gap="2">
        <Text size="1" className="text-gray-11">
          Status: {status}
        </Text>
      </Flex>
    </Box>
  );
}

export function ErrorNotificationView({
  errorType,
  message,
}: {
  errorType: string;
  message: string;
}) {
  const isContextError = errorType === "invalid_request";
  return (
    <Box className="my-2">
      <Callout.Root color={isContextError ? "orange" : "red"} size="1">
        <Callout.Icon>
          <Warning weight="fill" />
        </Callout.Icon>
        <Callout.Text>
          <Text size="2" weight="medium">
            {message}
          </Text>
        </Callout.Text>
      </Callout.Root>
    </Box>
  );
}

const statusConfig = {
  completed: {
    icon: <CheckCircle size={14} weight="fill" className="text-green-9" />,
    label: "Task completed",
    border: "border-green-6",
  },
  failed: {
    icon: <XCircle size={14} weight="fill" className="text-red-9" />,
    label: "Task failed",
    border: "border-red-6",
  },
  stopped: {
    icon: <Stop size={14} weight="fill" className="text-orange-9" />,
    label: "Task stopped",
    border: "border-orange-6",
  },
};

export function TaskNotificationView({
  status,
  summary,
}: {
  status: "completed" | "failed" | "stopped";
  summary: string;
}) {
  const config = statusConfig[status];
  return (
    <Box className={`my-1 border-l-2 py-1 pl-3 ${config.border}`}>
      <Flex direction="column" gap="1">
        <Flex align="center" gap="2">
          {config.icon}
          <Text size="1" weight="medium" className="text-gray-12">
            {config.label}
          </Text>
        </Flex>
        {summary && (
          <Text size="1" className="text-gray-11">
            {summary}
          </Text>
        )}
      </Flex>
    </Box>
  );
}

export function GitActionMessage({ actionType }: { actionType: string }) {
  const labels: Record<string, string> = {
    "commit-push": "Commit & Push",
    publish: "Publish Branch",
    push: "Push",
    pull: "Pull",
    sync: "Sync",
    "create-pr": "Create PR",
  };
  return (
    <Box className="mt-4">
      <Flex
        align="center"
        gap="2"
        className="rounded-lg border border-accent-6 bg-accent-3 px-3 py-2"
      >
        <Text size="2" weight="medium">
          {labels[actionType] ?? "Git Action"}
        </Text>
        <Badge size="1" color="gray" variant="soft">
          Git Action
        </Badge>
      </Flex>
    </Box>
  );
}

export function TurnCancelledView({
  interruptReason,
}: {
  interruptReason?: string;
}) {
  const message =
    interruptReason === "moving_to_worktree"
      ? "Paused while worktree is focused"
      : "Interrupted by user";
  return (
    <Box className="border-gray-4 border-l-2 py-0.5 pl-3">
      <Flex align="center" gap="2" className="text-gray-9">
        <XCircle size={14} />
        <Text size="1" color="gray">
          {message}
        </Text>
      </Flex>
    </Box>
  );
}
