import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createGitClient } from "@posthog/git/client";
import {
  getCurrentBranch,
  getDefaultBranch,
  hasTrackedFiles,
  listWorktrees,
} from "@posthog/git/queries";
import { CreateOrSwitchBranchSaga } from "@posthog/git/sagas/branch";
import { DetachHeadSaga } from "@posthog/git/sagas/head";
import { WorktreeManager } from "@posthog/git/worktree";
import { inject, injectable } from "inversify";
import type { RepositoryRepository } from "../../db/repositories/repository-repository";
import type { WorkspaceRepository } from "../../db/repositories/workspace-repository";
import type { WorktreeRepository } from "../../db/repositories/worktree-repository";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import { deriveWorktreePath } from "../../utils/worktree-helpers";
import type { AgentService } from "../agent/service";
import { FileWatcherEvent } from "../file-watcher/schemas";
import type { FileWatcherService } from "../file-watcher/service";
import type { FocusService } from "../focus/service";
import { FocusServiceEvent } from "../focus/service";
import type { ProcessTrackingService } from "../process-tracking/service";
import type { ProvisioningService } from "../provisioning/service";
import { getWorktreeLocation } from "../settingsStore";
import type { SuspensionService } from "../suspension/service.js";
import { generateTaskBranchName } from "./branch-name";
import type {
  BranchChangedPayload,
  CreateWorkspaceInput,
  SwitchResult,
  Workspace,
  WorkspaceErrorPayload,
  WorkspaceInfo,
  WorkspacePromotedPayload,
  WorkspaceWarningPayload,
  WorktreeInfo,
} from "./schemas";
import { createWipCommit, unwindWipCommit } from "./wip-commit";

const execFileAsync = promisify(execFile);

type TaskAssociation =
  | {
      taskId: string;
      folderId: string;
      mode: "local";
      targetBranch: string | null;
    }
  | { taskId: string; folderId: string | null; mode: "cloud" }
  | {
      taskId: string;
      folderId: string;
      mode: "worktree";
      worktree: string;
      targetBranch: string | null;
    };

async function hasAnyFiles(repoPath: string): Promise<boolean> {
  try {
    const entries = await fsPromises.readdir(repoPath);
    return entries.some((entry) => entry !== ".git");
  } catch {
    return false;
  }
}

/**
 * Get the current branch name for a repo or worktree by reading its Git HEAD file.
 * Returns null if in detached HEAD state or doesn't exist.
 */
async function getBranchFromPath(repoPath: string): Promise<string | null> {
  try {
    const gitPath = path.join(repoPath, ".git");
    const stat = await fsPromises.stat(gitPath);

    let headPath: string;
    if (stat.isDirectory()) {
      // Regular repo - .git is a directory
      headPath = path.join(gitPath, "HEAD");
    } else {
      // Worktree - .git is a file pointing to gitdir
      const gitContent = await fsPromises.readFile(gitPath, "utf-8");
      const gitdirMatch = gitContent.match(/gitdir:\s*(.+)/);
      if (!gitdirMatch) return null;
      headPath = path.join(path.resolve(gitdirMatch[1].trim()), "HEAD");
    }

    const headContent = await fsPromises.readFile(headPath, "utf-8");
    const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
    return branchMatch ? branchMatch[1].trim() : null;
  } catch {
    return null;
  }
}

const log = logger.scope("workspace");

export const WorkspaceServiceEvent = {
  Error: "error",
  Warning: "warning",
  Promoted: "promoted",
  BranchChanged: "branchChanged",
} as const;

export interface WorkspaceServiceEvents {
  [WorkspaceServiceEvent.Error]: WorkspaceErrorPayload;
  [WorkspaceServiceEvent.Warning]: WorkspaceWarningPayload;
  [WorkspaceServiceEvent.Promoted]: WorkspacePromotedPayload;
  [WorkspaceServiceEvent.BranchChanged]: BranchChangedPayload;
}

@injectable()
export class WorkspaceService extends TypedEventEmitter<WorkspaceServiceEvents> {
  @inject(MAIN_TOKENS.AgentService)
  private agentService!: AgentService;

  @inject(MAIN_TOKENS.ProcessTrackingService)
  private processTracking!: ProcessTrackingService;

  @inject(MAIN_TOKENS.RepositoryRepository)
  private repositoryRepo!: RepositoryRepository;

  @inject(MAIN_TOKENS.WorkspaceRepository)
  private workspaceRepo!: WorkspaceRepository;

  @inject(MAIN_TOKENS.WorktreeRepository)
  private worktreeRepo!: WorktreeRepository;

  @inject(MAIN_TOKENS.SuspensionService)
  private suspensionService!: SuspensionService;

  @inject(MAIN_TOKENS.ProvisioningService)
  private provisioningService!: ProvisioningService;

  private creatingWorkspaces = new Map<string, Promise<WorkspaceInfo>>();
  private branchWatcherInitialized = false;

  private findTaskAssociation(taskId: string): TaskAssociation | null {
    const workspace = this.workspaceRepo.findByTaskId(taskId);
    if (!workspace) return null;

    if (workspace.mode === "cloud") {
      return {
        taskId,
        folderId: workspace.repositoryId,
        mode: "cloud",
      };
    }

    if (!workspace.repositoryId) return null;

    if (workspace.mode === "worktree") {
      const worktree = this.worktreeRepo.findByWorkspaceId(workspace.id);
      if (!worktree) return null;
      return {
        taskId,
        folderId: workspace.repositoryId,
        mode: "worktree",
        worktree: worktree.name,
        targetBranch: workspace.targetBranch ?? null,
      };
    }

    return {
      taskId,
      folderId: workspace.repositoryId,
      mode: "local",
      targetBranch: workspace.targetBranch ?? null,
    };
  }

  private getFolderPath(folderId: string): string | null {
    const repo = this.repositoryRepo.findById(folderId);
    return repo?.path ?? null;
  }

  private getAllTaskAssociations(): TaskAssociation[] {
    const workspaces = this.workspaceRepo.findAll();
    const result: TaskAssociation[] = [];

    for (const workspace of workspaces) {
      if (workspace.mode === "cloud") {
        result.push({
          taskId: workspace.taskId,
          folderId: workspace.repositoryId,
          mode: "cloud",
        });
        continue;
      }

      if (!workspace.repositoryId) continue;

      if (workspace.mode === "worktree") {
        const worktree = this.worktreeRepo.findByWorkspaceId(workspace.id);
        if (!worktree) continue;
        result.push({
          taskId: workspace.taskId,
          folderId: workspace.repositoryId,
          mode: "worktree",
          worktree: worktree.name,
          targetBranch: workspace.targetBranch ?? null,
        });
      } else {
        result.push({
          taskId: workspace.taskId,
          folderId: workspace.repositoryId,
          mode: "local",
          targetBranch: workspace.targetBranch ?? null,
        });
      }
    }

    return result;
  }

  /**
   * Initialize branch change watching. Should be called after app is ready.
   * Subscribes to GitStateChanged events and checks for branch renames.
   */
  initBranchWatcher(): void {
    if (this.branchWatcherInitialized) return;
    this.branchWatcherInitialized = true;

    const fileWatcher = container.get<FileWatcherService>(
      MAIN_TOKENS.FileWatcherService,
    );
    const focusService = container.get<FocusService>(MAIN_TOKENS.FocusService);

    fileWatcher.on(
      FileWatcherEvent.GitStateChanged,
      this.handleGitStateChanged.bind(this),
    );

    focusService.on(
      FocusServiceEvent.BranchRenamed,
      this.handleFocusBranchRenamed.bind(this),
    );

    log.info("Branch watcher initialized");
  }

  private handleFocusBranchRenamed({
    worktreePath,
    newBranch,
  }: {
    mainRepoPath: string;
    worktreePath: string;
    oldBranch: string;
    newBranch: string;
  }): void {
    const associations = this.getAllTaskAssociations();
    for (const assoc of associations) {
      if (assoc.mode !== "worktree") continue;
      const folderPath = this.getFolderPath(assoc.folderId);
      if (!folderPath) continue;
      const derivedPath = deriveWorktreePath(folderPath, assoc.worktree);
      if (derivedPath === worktreePath && assoc.targetBranch !== newBranch) {
        this.updateAssociationBranchName(assoc.taskId, newBranch);
        this.emit(WorkspaceServiceEvent.BranchChanged, {
          taskId: assoc.taskId,
          branchName: newBranch,
        });
      }
    }
  }

  private async handleGitStateChanged({
    repoPath,
  }: {
    repoPath: string;
  }): Promise<void> {
    const associations = this.getAllTaskAssociations();

    for (const assoc of associations) {
      if (assoc.mode === "cloud" || !assoc.folderId) continue;

      const folderPath = this.getFolderPath(assoc.folderId);
      if (!folderPath) continue;

      if (assoc.mode === "worktree") {
        const worktreePath = deriveWorktreePath(folderPath, assoc.worktree);
        if (worktreePath !== repoPath) continue;

        const currentBranch = await getBranchFromPath(repoPath);
        if (currentBranch !== null && currentBranch !== assoc.targetBranch) {
          this.updateAssociationBranchName(assoc.taskId, currentBranch);
          this.emit(WorkspaceServiceEvent.BranchChanged, {
            taskId: assoc.taskId,
            branchName: currentBranch,
          });
        }
      } else if (assoc.mode === "local") {
        if (folderPath !== repoPath) continue;

        const localWorktreePath =
          await this.getLocalWorktreePathIfExists(folderPath);
        const branchPath = localWorktreePath ?? folderPath;
        const currentBranch = await getBranchFromPath(branchPath);

        if (currentBranch === null && localWorktreePath) {
          continue;
        }

        this.emit(WorkspaceServiceEvent.BranchChanged, {
          taskId: assoc.taskId,
          branchName: currentBranch,
        });
      }
    }
  }

  private updateAssociationBranchName(
    taskId: string,
    branchName: string,
  ): void {
    this.workspaceRepo.updateTargetBranch(taskId, branchName);
  }

  private async getLocalWorktreePathIfExists(
    mainRepoPath: string,
  ): Promise<string | null> {
    try {
      const worktreeBasePath = getWorktreeLocation();
      const worktreeManager = new WorktreeManager({
        mainRepoPath,
        worktreeBasePath,
      });
      const localPath = worktreeManager.getLocalWorktreePath();
      const exists = await worktreeManager.localWorktreeExists();
      if (exists) {
        return localPath;
      }
      return null;
    } catch (error) {
      log.warn(`Error checking local worktree for ${mainRepoPath}:`, error);
      return null;
    }
  }

  /**
   * Check if a branch name belongs to a PostHog-managed workspace.
   */
  isManagedBranch(branchName: string): boolean {
    return this.workspaceRepo.findByTargetBranch(branchName) !== null;
  }

  /**
   * Check if a repo path has uncommitted changes and whether the current branch is managed.
   */
  async checkDirtyState(repoPath: string): Promise<{
    dirty: boolean;
    currentBranch: string | null;
    managed: boolean;
  }> {
    const currentBranch = await getBranchFromPath(repoPath);
    const git = createGitClient(repoPath);
    const status = await git.status();
    const dirty = !status.isClean();
    const managed = currentBranch ? this.isManagedBranch(currentBranch) : false;
    return { dirty, currentBranch, managed };
  }

  /**
   * Read-only check: does focusing this task require a branch switch?
   */
  async checkSwitchNeeded(taskId: string): Promise<{
    needsSwitch: boolean;
    currentBranch: string | null;
    targetBranch: string | null;
  }> {
    const workspace = this.workspaceRepo.findByTaskId(taskId);
    if (
      !workspace?.targetBranch ||
      workspace.mode !== "local" ||
      !workspace.repositoryId
    ) {
      return {
        needsSwitch: false,
        currentBranch: null,
        targetBranch: workspace?.targetBranch ?? null,
      };
    }

    const folderPath = this.getFolderPath(workspace.repositoryId);
    if (!folderPath) {
      return {
        needsSwitch: false,
        currentBranch: null,
        targetBranch: workspace.targetBranch,
      };
    }

    const currentBranch = await getBranchFromPath(folderPath);
    return {
      needsSwitch: currentBranch !== workspace.targetBranch,
      currentBranch: currentBranch ?? null,
      targetBranch: workspace.targetBranch,
    };
  }

  /**
   * Switch the working tree to the target task's branch.
   * Handles WIP commits for managed branches and blocks on dirty unmanaged branches.
   */
  async switchToTask(taskId: string): Promise<SwitchResult> {
    const workspace = this.workspaceRepo.findByTaskId(taskId);
    if (!workspace || !workspace.targetBranch) {
      return { status: "ok" };
    }

    if (workspace.mode !== "local") {
      return { status: "ok" };
    }

    if (!workspace.repositoryId) {
      return {
        status: "error",
        message: "No repository associated with workspace",
      };
    }

    const folderPath = this.getFolderPath(workspace.repositoryId);
    if (!folderPath) {
      return { status: "error", message: "Workspace folder not found" };
    }

    const currentBranch = await getBranchFromPath(folderPath);
    if (!currentBranch) {
      return { status: "error", message: "Could not determine current branch" };
    }

    // Already on the right branch — just check for WIP to unwind
    if (currentBranch === workspace.targetBranch) {
      const restoredWip = await unwindWipCommit(folderPath);
      return { status: "ok", restoredWip: restoredWip || undefined };
    }

    // Check if the working tree is dirty
    const git = createGitClient(folderPath);
    const status = await git.status();
    const dirty = !status.isClean();

    let wipCreated = false;

    if (dirty) {
      if (this.isManagedBranch(currentBranch)) {
        // Find which task owns the current branch to tag the WIP
        const currentWorkspace =
          this.workspaceRepo.findByTargetBranch(currentBranch);
        const currentTaskId = currentWorkspace?.taskId ?? taskId;
        wipCreated = await createWipCommit(folderPath, currentTaskId);
        log.info(
          `Created WIP commit on ${currentBranch} for task ${currentTaskId}`,
        );
      } else {
        return {
          status: "blocked-dirty-unmanaged",
          currentBranch,
        };
      }
    }

    // Checkout the target branch
    const saga = new CreateOrSwitchBranchSaga();
    const result = await saga.run({
      baseDir: folderPath,
      branchName: workspace.targetBranch,
    });

    if (!result.success) {
      return {
        status: "error",
        message: `Could not switch to branch "${workspace.targetBranch}": ${result.error}`,
      };
    }

    // Unwind any WIP commit on the target branch
    const restoredWip = await unwindWipCommit(folderPath);

    return {
      status: "ok",
      wipCreated: wipCreated || undefined,
      restoredWip: restoredWip || undefined,
    };
  }

  async createWorkspace(options: CreateWorkspaceInput): Promise<WorkspaceInfo> {
    // Prevent concurrent workspace creation for the same task
    const existingPromise = this.creatingWorkspaces.get(options.taskId);
    if (existingPromise) {
      log.warn(
        `Workspace creation already in progress for task ${options.taskId}, waiting for existing operation`,
      );
      return existingPromise;
    }

    const promise = this.doCreateWorkspace(options);
    this.creatingWorkspaces.set(options.taskId, promise);

    try {
      return await promise;
    } finally {
      this.creatingWorkspaces.delete(options.taskId);
    }
  }

  private async doCreateWorkspace(
    options: CreateWorkspaceInput,
  ): Promise<WorkspaceInfo> {
    const {
      taskId,
      mainRepoPath,
      folderPath,
      mode,
      baseBranch: userBaseBranch,
      useExistingBranch,
      taskNumber,
      taskSlug,
    } = options;

    const existingWorkspace = await this.getWorkspaceInfo(taskId);
    if (existingWorkspace) {
      log.info(
        `Workspace already exists for task ${taskId}, returning existing workspace`,
      );
      return existingWorkspace;
    }

    log.info(
      `Creating workspace for task ${taskId} in ${mainRepoPath} (mode: ${mode}, useExistingBranch: ${useExistingBranch})`,
    );

    const repository = this.repositoryRepo.findByPath(mainRepoPath);
    const repositoryId = repository?.id ?? null;

    // Auto-generate branch name from task metadata
    const targetBranch = generateTaskBranchName({
      task_number: taskNumber ?? null,
      slug: taskSlug ?? "",
      id: taskId,
    });

    if (mode === "cloud") {
      this.workspaceRepo.create({
        taskId,
        repositoryId,
        mode: "cloud",
        targetBranch,
      });

      return {
        taskId,
        mode,
        worktree: null,
        branchName: targetBranch,
      };
    }

    // Resolve the base branch to fork from (user selection or default)
    const defaultBranch = await getDefaultBranch(
      mode === "local" ? folderPath : mainRepoPath,
    ).catch(() => "main");
    const baseBranch = userBaseBranch ?? defaultBranch;

    if (mode === "local") {
      const currentBranch = await getCurrentBranch(folderPath);
      if (currentBranch === targetBranch) {
        log.info(`Already on branch ${targetBranch}, skipping checkout`);
      } else {
        log.info(
          `Creating/switching to branch ${targetBranch} for task ${taskId} (base: ${baseBranch})`,
        );
        const saga = new CreateOrSwitchBranchSaga();
        const result = await saga.run({
          baseDir: folderPath,
          branchName: targetBranch,
          baseBranch,
        });
        if (!result.success) {
          const message = `Could not switch to branch "${targetBranch}". Please commit or stash your changes first.`;
          log.error(message, result.error);
          this.emitWorkspaceError(taskId, message);
          throw new Error(message);
        }
        if (result.data.created) {
          log.info(`Created and switched to new branch ${targetBranch}`);
        } else {
          log.info(`Switched to existing branch ${targetBranch}`);
        }
      }

      this.workspaceRepo.create({
        taskId,
        repositoryId,
        mode: "local",
        targetBranch,
      });

      return {
        taskId,
        mode,
        worktree: null,
        branchName: targetBranch,
      };
    }

    await this.suspensionService.suspendLeastRecentIfOverLimit();

    const worktreeBasePath = getWorktreeLocation();
    const worktreeManager = new WorktreeManager({
      mainRepoPath,
      worktreeBasePath,
    });
    let worktree: WorktreeInfo;

    try {
      const isTrunkSelected = baseBranch === defaultBranch;

      const onOutput = (data: string) => {
        this.provisioningService.emitOutput(taskId, data);
      };

      if (isTrunkSelected) {
        log.info(
          `Creating worktree from trunk (${baseBranch}) with branch ${targetBranch}`,
        );
        worktree = await worktreeManager.createWorktree({
          baseBranch,
          onOutput,
        });
        log.info(
          `Created worktree from trunk: ${worktree.worktreeName} at ${worktree.worktreePath}`,
        );
      } else {
        log.info(
          `Creating worktree from non-trunk base (${baseBranch}) with branch ${targetBranch}`,
        );
        try {
          worktree = await worktreeManager.createWorktreeForExistingBranch(
            baseBranch,
            undefined,
            { onOutput },
          );
          log.info(
            `Created worktree with branch checkout: ${worktree.worktreeName} at ${worktree.worktreePath} (base: ${baseBranch})`,
          );
        } catch (checkoutError) {
          const errorMessage =
            checkoutError instanceof Error
              ? checkoutError.message
              : String(checkoutError);
          if (errorMessage.includes("is already used by worktree")) {
            log.info(
              `Branch ${baseBranch} is occupied, falling back to detached worktree`,
            );
            worktree = await worktreeManager.createWorktree({
              baseBranch,
              onOutput,
            });
            log.info(
              `Created detached worktree from occupied branch: ${worktree.worktreeName} at ${worktree.worktreePath}`,
            );
          } else {
            throw checkoutError;
          }
        }
      }

      // Warn if worktree is empty but main repo has files
      const worktreeHasFiles = await hasTrackedFiles(worktree.worktreePath);
      if (!worktreeHasFiles) {
        const mainHasFiles = await hasAnyFiles(mainRepoPath);
        if (mainHasFiles) {
          log.warn(
            `Worktree ${worktree.worktreeName} is empty but main repo has files`,
          );
          this.emitWorkspaceWarning(
            taskId,
            "Workspace is empty",
            "No files are committed yet. Commit your files to see them in workspaces.",
          );
        }
      }
    } catch (error) {
      log.error(`Failed to create worktree for task ${taskId}:`, error);
      throw new Error(`Failed to create worktree: ${String(error)}`);
    }

    const createdWorkspace = this.workspaceRepo.create({
      taskId,
      repositoryId,
      mode: "worktree",
      targetBranch,
    });

    this.worktreeRepo.create({
      workspaceId: createdWorkspace.id,
      name: worktree.worktreeName,
      path: worktree.worktreePath,
    });

    return {
      taskId,
      mode,
      worktree,
      branchName: worktree.branchName,
    };
  }

  async deleteWorkspace(taskId: string, mainRepoPath: string): Promise<void> {
    log.info(`Deleting workspace for task ${taskId}`);

    const association = this.findTaskAssociation(taskId);
    if (!association) {
      log.warn(`No workspace found for task ${taskId}`);
      return;
    }

    if (association.mode === "cloud") {
      this.removeTaskAssociation(taskId);
      log.info(`Cloud workspace deleted for task ${taskId}`);
      return;
    }

    const folderId = association.folderId;
    const folderPath = this.getFolderPath(folderId);
    if (!folderPath) {
      log.warn(`No folder found for task ${taskId}, removing association only`);
      this.removeTaskAssociation(taskId);
      return;
    }

    let worktreePath: string | null = null;

    if (association.mode === "worktree") {
      worktreePath = deriveWorktreePath(folderPath, association.worktree);
    }

    await this.agentService.cancelSessionsByTaskId(taskId);
    this.processTracking.killByTaskId(taskId);

    if (association.mode === "worktree" && worktreePath) {
      await this.cleanupWorktree(
        taskId,
        mainRepoPath,
        worktreePath,
        association.targetBranch,
      );

      const otherWorkspacesForFolder = this.getAllTaskAssociations().filter(
        (a) =>
          a.folderId === folderId &&
          a.taskId !== taskId &&
          a.mode === "worktree",
      );

      if (otherWorkspacesForFolder.length === 0) {
        await this.cleanupRepoWorktreeFolder(folderPath);
      }
    }

    this.removeTaskAssociation(taskId);

    log.info(`Workspace deleted for task ${taskId}`);
  }

  private removeTaskAssociation(taskId: string): void {
    const workspace = this.workspaceRepo.findByTaskId(taskId);
    if (workspace) {
      this.worktreeRepo.deleteByWorkspaceId(workspace.id);
    }
    this.workspaceRepo.deleteByTaskId(taskId);
  }

  private async cleanupRepoWorktreeFolder(folderPath: string): Promise<void> {
    const worktreeBasePath = getWorktreeLocation();
    const repoName = path.basename(folderPath);
    const repoWorktreeFolderPath = path.join(worktreeBasePath, repoName);

    // Safety check 1: Never delete the project folder itself
    if (path.resolve(repoWorktreeFolderPath) === path.resolve(folderPath)) {
      log.warn(
        `Skipping cleanup of worktree folder: path matches project folder (${folderPath})`,
      );
      return;
    }

    if (!fs.existsSync(repoWorktreeFolderPath)) {
      return;
    }

    const allFolders = this.repositoryRepo.findAll();
    const otherFoldersWithSameName = allFolders.filter(
      (f) => f.path !== folderPath && path.basename(f.path) === repoName,
    );

    if (otherFoldersWithSameName.length > 0) {
      log.info(
        `Skipping cleanup of worktree folder ${repoWorktreeFolderPath}: used by other folders: ${otherFoldersWithSameName.map((f) => f.path).join(", ")}`,
      );
      return;
    }

    try {
      // Safety check 3: Only delete if empty (ignoring .DS_Store)
      const files = fs.readdirSync(repoWorktreeFolderPath);
      const validFiles = files.filter((f) => f !== ".DS_Store");

      if (validFiles.length > 0) {
        log.info(
          `Skipping cleanup of worktree folder ${repoWorktreeFolderPath}: folder not empty (contains: ${validFiles.slice(0, 3).join(", ")}${validFiles.length > 3 ? "..." : ""})`,
        );
        return;
      }

      fs.rmSync(repoWorktreeFolderPath, { recursive: true, force: true });
      log.info(`Cleaned up worktree folder at ${repoWorktreeFolderPath}`);
    } catch (error) {
      log.warn(
        `Failed to cleanup worktree folder at ${repoWorktreeFolderPath}:`,
        error,
      );
    }
  }

  async verifyWorkspaceExists(
    taskId: string,
  ): Promise<{ exists: boolean; missingPath?: string }> {
    const association = this.findTaskAssociation(taskId);
    if (!association) {
      return { exists: false };
    }

    if (association.mode === "cloud") {
      return { exists: true };
    }

    const folderPath = this.getFolderPath(association.folderId);
    if (!folderPath) {
      this.removeTaskAssociation(taskId);
      return { exists: false, missingPath: "(folder not found)" };
    }

    if (association.mode === "local") {
      const exists = fs.existsSync(folderPath);
      if (!exists) {
        log.info(
          `Folder for task ${taskId} no longer exists, removing association`,
        );
        this.removeTaskAssociation(taskId);
        return { exists: false, missingPath: folderPath };
      }
      return { exists: true };
    }

    if (association.mode === "worktree") {
      const worktreePath = deriveWorktreePath(folderPath, association.worktree);
      const exists = fs.existsSync(worktreePath);
      if (!exists) {
        log.info(
          `Worktree for task ${taskId} no longer exists, removing association`,
        );
        this.removeTaskAssociation(taskId);
        return { exists: false, missingPath: worktreePath };
      }
      return { exists: true };
    }

    return { exists: false };
  }

  async getWorkspaceInfo(taskId: string): Promise<WorkspaceInfo | null> {
    const association = this.findTaskAssociation(taskId);
    if (!association) {
      return null;
    }

    if (association.mode === "cloud") {
      return {
        taskId,
        mode: "cloud",
        worktree: null,
        branchName: null,
      };
    }

    const folderPath = association.folderId
      ? this.getFolderPath(association.folderId)
      : null;
    let worktreeInfo: WorktreeInfo | null = null;
    const branchName = association.targetBranch;

    if (association.mode === "worktree" && folderPath) {
      const worktreePath = deriveWorktreePath(folderPath, association.worktree);
      worktreeInfo = {
        worktreePath,
        worktreeName: association.worktree,
        branchName,
        baseBranch: "main",
        createdAt: new Date().toISOString(),
      };
    }

    return {
      taskId,
      mode: association.mode,
      worktree: worktreeInfo,
      branchName,
    };
  }

  async getAllWorkspaces(): Promise<Record<string, Workspace>> {
    const associations = this.getAllTaskAssociations();
    const workspaces: Record<string, Workspace> = {};

    for (const assoc of associations) {
      if (assoc.mode === "cloud") {
        workspaces[assoc.taskId] = {
          taskId: assoc.taskId,
          folderId: assoc.folderId ?? "",
          folderPath: "",
          mode: "cloud",
          worktreePath: null,
          worktreeName: null,
          branchName: null,
          baseBranch: null,
          createdAt: new Date().toISOString(),
        };
        continue;
      }

      const folderPath = this.getFolderPath(assoc.folderId);
      if (!folderPath) continue;

      let worktreePath: string | null = null;
      let worktreeName: string | null = null;

      if (assoc.mode === "worktree") {
        worktreeName = assoc.worktree;
        worktreePath = deriveWorktreePath(folderPath, worktreeName);
      }

      workspaces[assoc.taskId] = {
        taskId: assoc.taskId,
        folderId: assoc.folderId,
        folderPath,
        mode: assoc.mode,
        worktreePath,
        worktreeName,
        branchName: assoc.targetBranch,
        baseBranch: null,
        createdAt: new Date().toISOString(),
      };
    }

    return workspaces;
  }

  /**
   * Promote a local-mode task to worktree mode on an existing branch.
   * This is used when focusing on another workspace would disrupt a local-mode task.
   * The task gets its own worktree so it can continue working undisturbed.
   */
  async promoteToWorktree(
    taskId: string,
    mainRepoPath: string,
    branch: string,
  ): Promise<WorktreeInfo | null> {
    log.info(`Promoting task ${taskId} to worktree mode on branch ${branch}`);

    const association = this.findTaskAssociation(taskId);
    if (!association) {
      log.warn(`No association found for task ${taskId}`);
      return null;
    }

    if (association.mode !== "local") {
      log.warn(`Task ${taskId} is not in local mode, cannot promote`);
      return null;
    }

    const worktreeBasePath = getWorktreeLocation();
    const worktreeManager = new WorktreeManager({
      mainRepoPath,
      worktreeBasePath,
    });

    let worktree: WorktreeInfo;
    try {
      const currentBranch = await getCurrentBranch(mainRepoPath);
      if (currentBranch === branch) {
        log.info(
          `Main repo is on target branch ${branch}, detaching before creating worktree`,
        );
        const detachSaga = new DetachHeadSaga();
        const detachResult = await detachSaga.run({ baseDir: mainRepoPath });
        if (!detachResult.success) {
          throw new Error(`Failed to detach HEAD: ${detachResult.error}`);
        }
      }

      worktree = await worktreeManager.createWorktreeForExistingBranch(branch);
      log.info(
        `Created worktree for promoted task: ${worktree.worktreeName} at ${worktree.worktreePath}`,
      );
    } catch (error) {
      log.error(
        `Failed to create worktree for promoted task ${taskId}:`,
        error,
      );
      throw new Error(`Failed to promote task to worktree: ${String(error)}`);
    }

    const workspace = this.workspaceRepo.findByTaskId(taskId);
    if (workspace) {
      this.workspaceRepo.updateMode(taskId, "worktree");
      this.worktreeRepo.create({
        workspaceId: workspace.id,
        name: worktree.worktreeName,
        path: worktree.worktreePath,
      });
      log.info(`Updated task ${taskId} association to worktree mode`);
    }

    this.emit(WorkspaceServiceEvent.Promoted, {
      taskId,
      worktree,
      fromBranch: branch,
    });

    return worktree;
  }

  getLocalTasksForFolder(folderPath: string): Array<{ taskId: string }> {
    const associations = this.getAllTaskAssociations();
    const folder = this.repositoryRepo.findByPath(folderPath);
    if (!folder) return [];

    return associations
      .filter((a) => a.mode === "local" && a.folderId === folder.id)
      .map((a) => ({ taskId: a.taskId }));
  }

  getWorktreeTasks(worktreePath: string): Array<{ taskId: string }> {
    const associations = this.getAllTaskAssociations();
    const result: Array<{ taskId: string }> = [];

    for (const assoc of associations) {
      if (assoc.mode !== "worktree") continue;
      const folderPath = this.getFolderPath(assoc.folderId);
      if (!folderPath) continue;
      const derivedPath = deriveWorktreePath(folderPath, assoc.worktree);
      if (derivedPath === worktreePath) {
        result.push({ taskId: assoc.taskId });
      }
    }

    return result;
  }

  async listGitWorktrees(mainRepoPath: string): Promise<
    Array<{
      worktreePath: string;
      head: string;
      branch: string | null;
      taskIds: string[];
    }>
  > {
    const worktreeBasePath = getWorktreeLocation();
    const rawWorktrees = await listWorktrees(mainRepoPath);

    const twigWorktrees = rawWorktrees.filter((wt) => {
      const isMainRepo = path.resolve(wt.path) === path.resolve(mainRepoPath);
      const isUnderTwig = path
        .resolve(wt.path)
        .startsWith(path.resolve(worktreeBasePath));
      return !isMainRepo && isUnderTwig;
    });

    return twigWorktrees.map((wt) => {
      const taskIds = this.getWorktreeTasks(wt.path).map((t) => t.taskId);
      return {
        worktreePath: wt.path,
        head: wt.head,
        branch: wt.branch,
        taskIds,
      };
    });
  }

  async getWorktreeSize(worktreePath: string): Promise<{ sizeBytes: number }> {
    try {
      const { stdout } = await execFileAsync("du", ["-s", worktreePath]);
      const [sizeStr] = stdout.trim().split("\t");
      const sizeBytes = sizeStr ? parseInt(sizeStr, 10) * 512 : 0;
      return { sizeBytes };
    } catch (error) {
      log.warn(`Failed to get size for ${worktreePath}:`, error);
      return { sizeBytes: 0 };
    }
  }

  async deleteWorktree(
    mainRepoPath: string,
    worktreePath: string,
  ): Promise<void> {
    const worktree = this.worktreeRepo.findByPath(worktreePath);
    if (worktree) {
      const workspace = this.workspaceRepo.findById(worktree.workspaceId);
      if (workspace) {
        await this.deleteWorkspace(workspace.taskId, mainRepoPath);
        return;
      }
    }

    const worktreeBasePath = getWorktreeLocation();
    const manager = new WorktreeManager({ mainRepoPath, worktreeBasePath });
    await manager.deleteWorktree(worktreePath);

    if (worktree) {
      this.worktreeRepo.deleteByWorkspaceId(worktree.workspaceId);
    }
  }

  private async cleanupWorktree(
    taskId: string,
    mainRepoPath: string,
    worktreePath: string,
    branchName: string | null,
  ): Promise<void> {
    try {
      const fileWatcher = container.get<FileWatcherService>(
        MAIN_TOKENS.FileWatcherService,
      );
      await fileWatcher.stopWatching(worktreePath);
    } catch (error) {
      log.warn(
        `Failed to stop file watcher for worktree ${worktreePath}:`,
        error,
      );
    }

    try {
      const worktreeBasePath = getWorktreeLocation();
      const manager = new WorktreeManager({ mainRepoPath, worktreeBasePath });
      await manager.deleteWorktree(worktreePath);
    } catch (error) {
      log.error(`Failed to delete worktree for task ${taskId}:`, error);
    }

    if (branchName) {
      try {
        const git = createGitClient(mainRepoPath);
        await git.deleteLocalBranch(branchName, true);
        log.info(`Deleted branch ${branchName} for task ${taskId}`);
      } catch (error) {
        log.warn(
          `Failed to delete branch ${branchName} for task ${taskId}:`,
          error,
        );
      }
    }
  }

  private emitWorkspaceError(taskId: string, message: string): void {
    this.emit(WorkspaceServiceEvent.Error, { taskId, message });
  }

  private emitWorkspaceWarning(
    taskId: string,
    title: string,
    message: string,
  ): void {
    this.emit(WorkspaceServiceEvent.Warning, { taskId, title, message });
  }
}
