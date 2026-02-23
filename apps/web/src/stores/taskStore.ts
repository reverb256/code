import { create } from "zustand";

interface TaskStoreState {
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
}

export const useTaskStore = create<TaskStoreState>()((set) => ({
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}));
