import type {
  ProcessChangeEvent,
  ProcessEntry,
} from "@shared/types/process-manager";
import { createWithEqualityFn } from "zustand/traditional";

interface ProcessManagerStoreState {
  /** Map of taskId -> ProcessEntry[] */
  taskProcesses: Record<string, ProcessEntry[]>;
  /** Currently selected process ID per task */
  selectedProcessId: Record<string, string | null>;
}

interface ProcessManagerStoreActions {
  setProcesses: (taskId: string, processes: ProcessEntry[]) => void;
  handleProcessChange: (event: ProcessChangeEvent) => void;
  selectProcess: (taskId: string, processId: string | null) => void;
  clearExited: (taskId: string) => void;
}

type ProcessManagerStore = ProcessManagerStoreState &
  ProcessManagerStoreActions;

export const useProcessManagerStore =
  createWithEqualityFn<ProcessManagerStore>()((set) => ({
    taskProcesses: {},
    selectedProcessId: {},

    setProcesses: (taskId, processes) =>
      set((state) => ({
        taskProcesses: {
          ...state.taskProcesses,
          [taskId]: processes,
        },
      })),

    handleProcessChange: (event) =>
      set((state) => {
        const existing = state.taskProcesses[event.taskId] ?? [];

        let updated: ProcessEntry[];
        switch (event.type) {
          case "added":
            updated = [...existing, event.process];
            break;
          case "updated":
            updated = existing.map((p) =>
              p.id === event.process.id ? event.process : p,
            );
            break;
          case "removed":
            updated = existing.filter((p) => p.id !== event.process.id);
            break;
          default:
            return state;
        }

        // Auto-select the first running process if nothing is selected
        const selectedId = state.selectedProcessId[event.taskId];
        const selectedStillExists = updated.some((p) => p.id === selectedId);
        let newSelectedId = selectedStillExists ? selectedId : null;
        if (!newSelectedId && updated.length > 0) {
          const running = updated.find((p) => p.status === "running");
          newSelectedId = running?.id ?? updated[0].id;
        }

        return {
          taskProcesses: {
            ...state.taskProcesses,
            [event.taskId]: updated,
          },
          selectedProcessId: {
            ...state.selectedProcessId,
            [event.taskId]: newSelectedId,
          },
        };
      }),

    selectProcess: (taskId, processId) =>
      set((state) => ({
        selectedProcessId: {
          ...state.selectedProcessId,
          [taskId]: processId,
        },
      })),

    clearExited: (taskId) =>
      set((state) => {
        const existing = state.taskProcesses[taskId] ?? [];
        const running = existing.filter((p) => p.status === "running");
        return {
          taskProcesses: {
            ...state.taskProcesses,
            [taskId]: running,
          },
        };
      }),
  }));
