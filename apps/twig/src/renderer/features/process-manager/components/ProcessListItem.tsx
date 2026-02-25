import { GearSix, Play, Stop, Terminal } from "@phosphor-icons/react";
import { Badge, Box, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes";
import type { ProcessEntry } from "@shared/types/process-manager";

interface ProcessListItemProps {
  process: ProcessEntry;
  isSelected: boolean;
  onSelect: () => void;
  onKill: () => void;
}

function getCategoryIcon(category: ProcessEntry["category"]) {
  switch (category) {
    case "agent-bash":
      return <GearSix size={14} />;
    case "workspace-terminal":
      return <Play size={14} />;
    case "shell":
      return <Terminal size={14} />;
  }
}

function getStatusColor(
  status: ProcessEntry["status"],
): "green" | "gray" | "red" | "orange" {
  switch (status) {
    case "running":
      return "green";
    case "completed":
      return "gray";
    case "failed":
      return "red";
    case "cancelled":
      return "orange";
  }
}

function formatDuration(startedAt: number, endedAt?: number): string {
  const end = endedAt ?? Date.now();
  const ms = end - startedAt;
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function ProcessListItem({
  process,
  isSelected,
  onSelect,
  onKill,
}: ProcessListItemProps) {
  const statusColor = getStatusColor(process.status);

  return (
    <Box
      className={`cursor-pointer border-[var(--gray-a4)] border-b px-3 py-2 transition-colors hover:bg-[var(--gray-a3)] ${
        isSelected ? "bg-[var(--gray-a4)]" : ""
      }`}
      onClick={onSelect}
    >
      <Flex align="center" gap="2">
        <Box className="shrink-0 text-[var(--gray-a11)]">
          {getCategoryIcon(process.category)}
        </Box>
        <Box className="min-w-0 flex-1">
          <Text
            size="1"
            weight="medium"
            className="block truncate"
            title={process.command}
          >
            {process.label}
          </Text>
          <Flex align="center" gap="2" mt="1">
            <Badge size="1" color={statusColor} variant="soft">
              {process.status}
            </Badge>
            {process.exitCode !== undefined && (
              <Text size="1" color="gray">
                exit: {process.exitCode}
              </Text>
            )}
            <Text size="1" color="gray">
              {formatDuration(process.startedAt, process.endedAt)}
            </Text>
          </Flex>
        </Box>
        {process.status === "running" && (
          <Tooltip content="Kill process">
            <IconButton
              size="1"
              variant="ghost"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onKill();
              }}
            >
              <Stop size={14} />
            </IconButton>
          </Tooltip>
        )}
      </Flex>
    </Box>
  );
}
