import { trpcReact, trpcVanilla } from "@renderer/trpc";
import type { ProcessChangeEvent } from "@shared/types/process-manager";
import { useEffect } from "react";
import { useProcessManagerStore } from "../stores/processManagerStore";

export function useProcessManager(taskId: string) {
  const { setProcesses, handleProcessChange } = useProcessManagerStore();

  // Fetch initial process list
  const { data: processes } = trpcReact.processManager.listByTaskId.useQuery(
    { taskId },
    { refetchOnWindowFocus: false },
  );

  // Set initial data when it arrives
  useEffect(() => {
    if (processes) {
      setProcesses(taskId, processes);
    }
  }, [processes, taskId, setProcesses]);

  // Subscribe to live process changes
  trpcReact.processManager.onProcessChange.useSubscription(
    { taskId },
    {
      onData: (event: ProcessChangeEvent) => {
        handleProcessChange(event);
      },
    },
  );

  const killProcess = async (processId: string) => {
    await trpcVanilla.processManager.kill.mutate({ processId });
  };

  const clearExited = async () => {
    await trpcVanilla.processManager.clearExited.mutate({ taskId });
    useProcessManagerStore.getState().clearExited(taskId);
  };

  const getOutput = async (processId: string) => {
    return trpcVanilla.processManager.getOutput.query({ processId });
  };

  return { killProcess, clearExited, getOutput };
}
