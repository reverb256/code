import { create } from "zustand";

interface ReviewStoreState {
  scrollTarget: string | null;
  activeFilePath: string | null;
}

interface ReviewStoreActions {
  setScrollTarget: (filePath: string | null) => void;
  setActiveFilePath: (filePath: string | null) => void;
}

type ReviewStore = ReviewStoreState & ReviewStoreActions;

export const useReviewStore = create<ReviewStore>()((set) => ({
  scrollTarget: null,
  activeFilePath: null,
  setScrollTarget: (filePath) =>
    filePath
      ? set({ scrollTarget: filePath, activeFilePath: filePath })
      : set({ scrollTarget: null }),
  setActiveFilePath: (filePath) => set({ activeFilePath: filePath }),
}));
