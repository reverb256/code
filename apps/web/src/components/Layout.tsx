import { Cloud } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import { useTaskStore } from "@/stores/taskStore";
import { AgentDetail } from "./AgentDetail";
import { Sidebar } from "./Sidebar";

function EmptyState() {
  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="3"
      className="h-full bg-gray-1"
    >
      <Cloud size={48} weight="duotone" className="text-gray-6" />
      <Text size="3" color="gray">
        Select a cloud agent to view its logs
      </Text>
    </Flex>
  );
}

export function Layout() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);

  return (
    <Flex className="h-full">
      <Sidebar />
      <Flex direction="column" className="min-w-0 flex-1">
        {selectedTaskId ? (
          <AgentDetail key={selectedTaskId} taskId={selectedTaskId} />
        ) : (
          <EmptyState />
        )}
      </Flex>
    </Flex>
  );
}
