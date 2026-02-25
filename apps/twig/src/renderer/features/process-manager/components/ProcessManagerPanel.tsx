import { Terminal } from "@features/terminal/components/Terminal";
import { ClipboardText, Eraser } from "@phosphor-icons/react";
import { Box, Button, Flex, ScrollArea, Text } from "@radix-ui/themes";
import type { ProcessEntry } from "@shared/types/process-manager";
import { useCallback } from "react";
import { useProcessManager } from "../hooks/useProcessManager";
import { useProcessManagerStore } from "../stores/processManagerStore";
import { AgentBashOutput } from "./AgentBashOutput";
import { ProcessListItem } from "./ProcessListItem";

interface ProcessManagerPanelProps {
  taskId: string;
}

export function ProcessManagerPanel({ taskId }: ProcessManagerPanelProps) {
  const { killProcess, clearExited, getOutput } = useProcessManager(taskId);

  const processes = useProcessManagerStore(
    (s) => s.taskProcesses[taskId] ?? [],
  );
  const selectedProcessId = useProcessManagerStore(
    (s) => s.selectedProcessId[taskId] ?? null,
  );
  const selectProcess = useProcessManagerStore((s) => s.selectProcess);

  const selectedProcess = processes.find((p) => p.id === selectedProcessId);

  const running = processes.filter((p) => p.status === "running");
  const exited = processes.filter((p) => p.status !== "running");

  const handleCopyOutput = useCallback(async () => {
    if (!selectedProcess) return;

    let output: string | null = null;
    if (selectedProcess.category === "agent-bash") {
      output = selectedProcess.capturedOutput ?? null;
      if (!output) {
        output = await getOutput(selectedProcess.id);
      }
    } else if (selectedProcess.shellSessionId) {
      // For PTY terminals, get output via getOutput tRPC call
      output = await getOutput(selectedProcess.id);
    }

    if (output) {
      await navigator.clipboard.writeText(output);
    }
  }, [selectedProcess, getOutput]);

  return (
    <Flex className="h-full">
      {/* Sidebar - process list */}
      <Flex
        direction="column"
        className="w-[250px] shrink-0 border-[var(--gray-a4)] border-r"
      >
        <Box className="shrink-0 border-[var(--gray-a4)] border-b px-3 py-2">
          <Flex align="center" justify="between">
            <Text size="1" weight="bold" color="gray">
              PROCESSES ({processes.length})
            </Text>
            {exited.length > 0 && (
              <Button
                size="1"
                variant="ghost"
                color="gray"
                onClick={clearExited}
              >
                <Eraser size={12} />
                Clear
              </Button>
            )}
          </Flex>
        </Box>
        <ScrollArea className="flex-1">
          {processes.length === 0 ? (
            <Box className="px-3 py-4">
              <Text size="1" color="gray">
                No processes yet. Start an agent session or open a terminal to
                see processes here.
              </Text>
            </Box>
          ) : (
            <>
              {running.length > 0 && (
                <ProcessGroup
                  label="Running"
                  processes={running}
                  selectedProcessId={selectedProcessId}
                  onSelect={(id) => selectProcess(taskId, id)}
                  onKill={killProcess}
                />
              )}
              {exited.length > 0 && (
                <ProcessGroup
                  label="Exited"
                  processes={exited}
                  selectedProcessId={selectedProcessId}
                  onSelect={(id) => selectProcess(taskId, id)}
                  onKill={killProcess}
                />
              )}
            </>
          )}
        </ScrollArea>
      </Flex>

      {/* Content area - process output */}
      <Flex direction="column" className="min-w-0 flex-1">
        {selectedProcess ? (
          <>
            {/* Action toolbar */}
            <Box className="shrink-0 border-[var(--gray-a4)] border-b px-3 py-1">
              <Flex align="center" gap="2">
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={handleCopyOutput}
                >
                  <ClipboardText size={12} />
                  Copy Output
                </Button>
              </Flex>
            </Box>
            <Box className="flex-1">
              <ProcessOutput process={selectedProcess} taskId={taskId} />
            </Box>
          </>
        ) : (
          <Flex align="center" justify="center" className="h-full">
            <Text size="2" color="gray">
              Select a process to view its output
            </Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

interface ProcessGroupProps {
  label: string;
  processes: ProcessEntry[];
  selectedProcessId: string | null;
  onSelect: (processId: string) => void;
  onKill: (processId: string) => void;
}

function ProcessGroup({
  label,
  processes,
  selectedProcessId,
  onSelect,
  onKill,
}: ProcessGroupProps) {
  return (
    <Box>
      <Box className="px-3 py-1">
        <Text size="1" color="gray" weight="medium">
          {label}
        </Text>
      </Box>
      {processes.map((process) => (
        <ProcessListItem
          key={process.id}
          process={process}
          isSelected={process.id === selectedProcessId}
          onSelect={() => onSelect(process.id)}
          onKill={() => onKill(process.id)}
        />
      ))}
    </Box>
  );
}

interface ProcessOutputProps {
  process: ProcessEntry;
  taskId: string;
}

function ProcessOutput({ process, taskId }: ProcessOutputProps) {
  // Agent bash commands always show their captured output
  // (even after completion, since they may have spawned background processes)
  if (process.category === "agent-bash") {
    return <AgentBashOutput process={process} />;
  }

  // For shell and workspace terminals
  if (process.shellSessionId) {
    // Only render Terminal for running processes
    if (process.status === "running") {
      return (
        <Terminal
          sessionId={process.shellSessionId}
          persistenceKey={`pm-${process.shellSessionId}`}
          taskId={taskId}
        />
      );
    }

    // For exited processes, show exit message
    return (
      <Box className="h-full p-4">
        <Text size="2" color="gray">
          Process exited with code {process.exitCode ?? "unknown"}
        </Text>
        {process.exitCode !== 0 && (
          <Text size="1" color="red" className="mt-2">
            Script failed - check terminal output above for errors
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Flex align="center" justify="center" className="h-full">
      <Text size="2" color="gray">
        No output available
      </Text>
    </Flex>
  );
}
