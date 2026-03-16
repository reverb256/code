import type {
  CommitNextStep,
  GitMenuActionId,
  PushMode,
  PushState,
} from "@features/git-interaction/types";
import { create } from "zustand";

export type { CommitNextStep, PushMode, PushState };

interface GitInteractionState {
  commitOpen: boolean;
  pushOpen: boolean;
  prOpen: boolean;
  branchOpen: boolean;
  commitMessage: string;
  commitNextStep: CommitNextStep;
  pushMode: PushMode;
  pushState: PushState;
  pushError: string | null;
  prTitle: string;
  prBody: string;
  prError: string | null;
  commitError: string | null;
  branchName: string;
  branchError: string | null;
  isSubmitting: boolean;
  openPrAfterPush: boolean;
  isGeneratingCommitMessage: boolean;
  isGeneratingPr: boolean;

  // Graphite stack dialogs
  stackSubmitOpen: boolean;
  stackSubmitDraft: boolean;
  stackSubmitError: string | null;
  stackSyncOpen: boolean;
  stackSyncError: string | null;
  stackModifyOpen: boolean;
  stackModifyError: string | null;
  stackCreateOpen: boolean;
  stackCreateMessage: string;
  stackCreateError: string | null;
}

interface GitInteractionActions {
  setCommitOpen: (open: boolean) => void;
  setPushOpen: (open: boolean) => void;
  setPrOpen: (open: boolean) => void;
  setBranchOpen: (open: boolean) => void;
  setCommitMessage: (value: string) => void;
  setCommitNextStep: (value: CommitNextStep) => void;
  setPushMode: (value: PushMode) => void;
  setPushState: (value: PushState) => void;
  setPushError: (value: string | null) => void;
  setPrTitle: (value: string) => void;
  setPrBody: (value: string) => void;
  setPrError: (value: string | null) => void;
  setCommitError: (value: string | null) => void;
  setBranchName: (value: string) => void;
  setBranchError: (value: string | null) => void;
  setIsSubmitting: (value: boolean) => void;
  setOpenPrAfterPush: (value: boolean) => void;
  setIsGeneratingCommitMessage: (value: boolean) => void;
  setIsGeneratingPr: (value: boolean) => void;

  openCommit: (nextStep: CommitNextStep) => void;
  openPush: (mode: PushMode) => void;
  openPr: (defaultTitle?: string, defaultBody?: string) => void;
  openBranch: () => void;
  closeCommit: () => void;
  closePush: () => void;
  closePr: () => void;
  closeBranch: () => void;

  // Graphite stack actions
  openStackSubmit: () => void;
  closeStackSubmit: () => void;
  setStackSubmitDraft: (value: boolean) => void;
  setStackSubmitError: (value: string | null) => void;
  openStackSync: () => void;
  closeStackSync: () => void;
  setStackSyncError: (value: string | null) => void;
  openStackModify: () => void;
  closeStackModify: () => void;
  setStackModifyError: (value: string | null) => void;
  openStackCreate: () => void;
  closeStackCreate: () => void;
  setStackCreateMessage: (value: string) => void;
  setStackCreateError: (value: string | null) => void;
}

export interface GitInteractionStore extends GitInteractionState {
  actions: GitInteractionActions;
}

const initialState: GitInteractionState = {
  commitOpen: false,
  pushOpen: false,
  prOpen: false,
  branchOpen: false,
  commitMessage: "",
  commitNextStep: "commit",
  pushMode: "push",
  pushState: "idle",
  pushError: null,
  prTitle: "",
  prBody: "",
  prError: null,
  commitError: null,
  branchName: "",
  branchError: null,
  isSubmitting: false,
  openPrAfterPush: false,
  isGeneratingCommitMessage: false,
  isGeneratingPr: false,

  stackSubmitOpen: false,
  stackSubmitDraft: false,
  stackSubmitError: null,
  stackSyncOpen: false,
  stackSyncError: null,
  stackModifyOpen: false,
  stackModifyError: null,
  stackCreateOpen: false,
  stackCreateMessage: "",
  stackCreateError: null,
};

export const useGitInteractionStore = create<GitInteractionStore>((set) => ({
  ...initialState,
  actions: {
    setCommitOpen: (open) => set({ commitOpen: open }),
    setPushOpen: (open) => set({ pushOpen: open }),
    setPrOpen: (open) => set({ prOpen: open }),
    setBranchOpen: (open) => set({ branchOpen: open }),
    setCommitMessage: (value) => set({ commitMessage: value }),
    setCommitNextStep: (value) => set({ commitNextStep: value }),
    setPushMode: (value) => set({ pushMode: value }),
    setPushState: (value) => set({ pushState: value }),
    setPushError: (value) => set({ pushError: value }),
    setPrTitle: (value) => set({ prTitle: value }),
    setPrBody: (value) => set({ prBody: value }),
    setPrError: (value) => set({ prError: value }),
    setCommitError: (value) => set({ commitError: value }),
    setBranchName: (value) => set({ branchName: value }),
    setBranchError: (value) => set({ branchError: value }),
    setIsSubmitting: (value) => set({ isSubmitting: value }),
    setOpenPrAfterPush: (value) => set({ openPrAfterPush: value }),
    setIsGeneratingCommitMessage: (value) =>
      set({ isGeneratingCommitMessage: value }),
    setIsGeneratingPr: (value) => set({ isGeneratingPr: value }),

    openCommit: (nextStep) =>
      set({ commitNextStep: nextStep, commitError: null, commitOpen: true }),
    openPush: (mode) =>
      set({
        pushMode: mode,
        pushState: "idle",
        pushError: null,
        pushOpen: true,
      }),
    openPr: (defaultTitle, defaultBody) =>
      set({
        prTitle: defaultTitle ?? "",
        prBody: defaultBody ?? "",
        prError: null,
        prOpen: true,
      }),
    openBranch: () =>
      set({ branchName: "", branchError: null, branchOpen: true }),
    closeCommit: () => set({ commitOpen: false, commitError: null }),
    closePush: () =>
      set({
        pushOpen: false,
        pushState: "idle",
        pushError: null,
        openPrAfterPush: false,
      }),
    closePr: () =>
      set({ prOpen: false, prError: null, prTitle: "", prBody: "" }),
    closeBranch: () =>
      set({ branchOpen: false, branchError: null, branchName: "" }),

    // Graphite stack actions
    openStackSubmit: () =>
      set({
        stackSubmitOpen: true,
        stackSubmitDraft: false,
        stackSubmitError: null,
      }),
    closeStackSubmit: () =>
      set({ stackSubmitOpen: false, stackSubmitError: null }),
    setStackSubmitDraft: (value) => set({ stackSubmitDraft: value }),
    setStackSubmitError: (value) => set({ stackSubmitError: value }),
    openStackSync: () => set({ stackSyncOpen: true, stackSyncError: null }),
    closeStackSync: () => set({ stackSyncOpen: false, stackSyncError: null }),
    setStackSyncError: (value) => set({ stackSyncError: value }),
    openStackModify: () =>
      set({ stackModifyOpen: true, stackModifyError: null }),
    closeStackModify: () =>
      set({ stackModifyOpen: false, stackModifyError: null }),
    setStackModifyError: (value) => set({ stackModifyError: value }),
    openStackCreate: () =>
      set({
        stackCreateOpen: true,
        stackCreateMessage: "",
        stackCreateError: null,
      }),
    closeStackCreate: () =>
      set({
        stackCreateOpen: false,
        stackCreateError: null,
        stackCreateMessage: "",
      }),
    setStackCreateMessage: (value) => set({ stackCreateMessage: value }),
    setStackCreateError: (value) => set({ stackCreateError: value }),
  },
}));

export function getGitInteractionActionLabel(
  actionId: GitMenuActionId,
): string {
  switch (actionId) {
    case "commit":
      return "Commit";
    case "push":
      return "Push";
    case "sync":
      return "Sync";
    case "publish":
      return "Publish Branch";
    case "create-pr":
      return "Create PR";
    case "view-pr":
      return "View PR";
    case "branch-here":
      return "New branch";
    case "stack-submit":
      return "Submit Stack";
    case "stack-sync":
      return "Sync";
    case "stack-create":
      return "Stack Branch";
    case "stack-modify":
      return "Amend";
    default:
      return "Git Action";
  }
}
