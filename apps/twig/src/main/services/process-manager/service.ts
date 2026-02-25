import type {
  ProcessEntry,
  ProcessStatus,
} from "@shared/types/process-manager";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens.js";
import { logger } from "../../lib/logger.js";
import { TypedEventEmitter } from "../../lib/typed-event-emitter.js";
import type { ProcessTrackingService } from "../process-tracking/service.js";
import { ProcessManagerEvent, type ProcessManagerEvents } from "./schemas.js";

const log = logger.scope("process-manager");

/** Maximum captured output size per process (100KB) */
const MAX_OUTPUT_SIZE = 100 * 1024;

@injectable()
export class ProcessManagerService extends TypedEventEmitter<ProcessManagerEvents> {
  /** Map<taskId, Map<processId, ProcessEntry>> */
  private taskProcesses = new Map<string, Map<string, ProcessEntry>>();

  /** Map<toolCallId, processId> for correlating ACP tool_call updates */
  private toolCallIndex = new Map<string, string>();

  /** Map<shellSessionId, processId> for correlating shell events */
  private shellSessionIndex = new Map<string, string>();

  /** Map<taskId, agentSubprocessPid> for discovering agent bash children */
  private agentPidsByTask = new Map<string, number>();

  private processTracking: ProcessTrackingService;

  constructor(
    @inject(MAIN_TOKENS.ProcessTrackingService)
    processTracking: ProcessTrackingService,
  ) {
    super();
    this.processTracking = processTracking;
  }

  /**
   * Handle an ACP message from the agent session to detect bash tool calls.
   * Messages are JSON-RPC notifications with method "session/update".
   */
  handleAcpMessage(taskId: string, message: unknown): void {
    const msg = message as {
      method?: string;
      params?: {
        update?: {
          sessionUpdate?: string;
          toolCallId?: string;
          kind?: string;
          status?: string;
          title?: string;
          rawInput?: unknown;
          _meta?: {
            claudeCode?: {
              toolName?: string;
              toolResponse?: unknown;
            };
            [key: string]: unknown;
          };
          content?: Array<{ type?: string; text?: string }>;
        };
      };
    };

    if (msg.method !== "session/update") return;
    const update = msg.params?.update;
    if (!update) return;

    if (update.sessionUpdate === "tool_call") {
      this.handleToolCall(taskId, update);
    } else if (update.sessionUpdate === "tool_call_update") {
      this.handleToolCallUpdate(update);
    }
  }

  private handleToolCall(
    taskId: string,
    update: {
      toolCallId?: string;
      kind?: string;
      status?: string;
      title?: string;
      rawInput?: unknown;
      _meta?: {
        claudeCode?: { toolName?: string };
        [key: string]: unknown;
      };
      content?: Array<{ type?: string; text?: string }>;
    },
  ): void {
    // Only track "execute" kind (bash/shell commands)
    if (update.kind !== "execute") return;

    const toolCallId = update.toolCallId;
    if (!toolCallId) return;

    // Extract command from _meta or rawInput
    const meta = update._meta as Record<string, unknown> | undefined;
    const bashMeta = meta?.bash as
      | { command?: string; description?: string }
      | undefined;
    const rawInput = update.rawInput as
      | { command?: string; description?: string }
      | undefined;

    const command =
      bashMeta?.command || rawInput?.command || update.title || "bash";
    const label = bashMeta?.description || command.split("\n")[0].slice(0, 80);

    const processId = `agent-bash-${toolCallId}`;

    // Extract any initial content
    let capturedOutput = "";
    if (update.content) {
      for (const item of update.content) {
        if (item.type === "text" && item.text) {
          capturedOutput += item.text;
        }
      }
    }

    const status: ProcessStatus =
      update.status === "completed"
        ? "completed"
        : update.status === "errored"
          ? "failed"
          : "running";

    const entry: ProcessEntry = {
      id: processId,
      taskId,
      category: "agent-bash",
      label,
      command,
      status,
      startedAt: Date.now(),
      endedAt: status !== "running" ? Date.now() : undefined,
      toolCallId,
      capturedOutput: capturedOutput || undefined,
    };

    this.addProcess(taskId, entry);
    this.toolCallIndex.set(toolCallId, processId);

    // Start discovering children of the agent subprocess for this bash command
    const agentPid = this.agentPidsByTask.get(taskId);
    if (agentPid && status === "running") {
      this.startChildDiscovery(taskId, processId, agentPid);
    }
  }

  private handleToolCallUpdate(update: {
    toolCallId?: string;
    status?: string;
    _meta?: {
      claudeCode?: {
        toolName?: string;
        toolResponse?: unknown;
      };
    };
    content?: Array<{ type?: string; text?: string }>;
  }): void {
    const toolCallId = update.toolCallId;
    if (!toolCallId) return;

    const processId = this.toolCallIndex.get(toolCallId);
    if (!processId) return;

    // Find the entry
    const entry = this.findProcess(processId);
    if (!entry) return;

    // Extract output from content or toolResponse
    let newOutput = "";

    const toolResponse = update._meta?.claudeCode?.toolResponse;
    if (toolResponse) {
      if (typeof toolResponse === "string") {
        newOutput = toolResponse;
      } else if (typeof toolResponse === "object" && toolResponse !== null) {
        const resp = toolResponse as Record<string, unknown>;
        newOutput = String(resp.stdout || "") + String(resp.stderr || "");
        if (!newOutput && resp.output) {
          newOutput = String(resp.output);
        }
      }
    }

    if (update.content) {
      for (const item of update.content) {
        if (item.type === "text" && item.text) {
          newOutput += item.text;
        }
      }
    }

    // Update captured output (with size limit)
    const existingOutput = entry.capturedOutput || "";
    let capturedOutput = existingOutput + newOutput;
    if (capturedOutput.length > MAX_OUTPUT_SIZE) {
      capturedOutput =
        "[output truncated]\n..." +
        capturedOutput.slice(capturedOutput.length - MAX_OUTPUT_SIZE);
    }

    // Update status
    const status: ProcessStatus =
      update.status === "completed"
        ? "completed"
        : update.status === "errored"
          ? "failed"
          : entry.status;

    this.updateProcess(entry.taskId, processId, {
      capturedOutput: capturedOutput || undefined,
      status,
      endedAt: status !== "running" ? Date.now() : undefined,
    });
  }

  registerShellSession(taskId: string, sessionId: string, label: string): void {
    const processId = `shell-${sessionId}`;
    const entry: ProcessEntry = {
      id: processId,
      taskId,
      category: "shell",
      label,
      command: label,
      status: "running",
      startedAt: Date.now(),
      shellSessionId: sessionId,
    };

    this.addProcess(taskId, entry);
    this.shellSessionIndex.set(sessionId, processId);
  }

  /**
   * Register the agent subprocess PID for a task
   * This allows us to discover children spawned by agent bash commands
   */
  registerAgentSubprocess(taskId: string, agentPid: number): void {
    this.agentPidsByTask.set(taskId, agentPid);
    log.info(`Registered agent subprocess for task ${taskId}: PID ${agentPid}`);
  }

  /**
   * Unregister agent subprocess when session ends
   */
  unregisterAgentSubprocess(taskId: string): void {
    this.agentPidsByTask.delete(taskId);
    log.info(`Unregistered agent subprocess for task ${taskId}`);
  }

  registerWorkspaceTerminal(
    taskId: string,
    sessionId: string,
    command: string,
    scriptType: "init" | "start",
    shellPid?: number,
  ): void {
    const processId = `workspace-${sessionId}`;
    const label =
      scriptType === "init" ? `Init: ${command}` : `Start: ${command}`;

    const entry: ProcessEntry = {
      id: processId,
      taskId,
      category: "workspace-terminal",
      label,
      command,
      status: "running",
      pid: shellPid,
      startedAt: Date.now(),
      shellSessionId: sessionId,
      scriptType,
    };

    this.addProcess(taskId, entry);
    this.shellSessionIndex.set(sessionId, processId);

    // Start discovering children for this shell
    if (shellPid && scriptType === "start") {
      this.startChildDiscovery(taskId, processId, shellPid);
    }
  }

  getProcessesForTask(taskId: string): ProcessEntry[] {
    const processes = this.taskProcesses.get(taskId);
    if (!processes) return [];
    return Array.from(processes.values());
  }

  getProcessOutput(processId: string): string | null {
    const entry = this.findProcess(processId);
    if (!entry) return null;
    return entry.capturedOutput ?? null;
  }

  killProcess(processId: string): void {
    const entry = this.findProcess(processId);
    if (!entry) {
      log.warn(`Cannot kill process: not found (${processId})`);
      return;
    }

    if (entry.status !== "running") {
      log.warn(`Cannot kill process: not running (${processId})`);
      return;
    }

    if (entry.pid) {
      this.processTracking.kill(entry.pid);
    }

    this.updateProcess(entry.taskId, processId, {
      status: "cancelled",
      endedAt: Date.now(),
    });
  }

  clearExitedProcesses(taskId: string): void {
    const processes = this.taskProcesses.get(taskId);
    if (!processes) return;

    const toRemove: string[] = [];
    for (const [id, entry] of processes) {
      if (entry.status !== "running") {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const entry = processes.get(id);
      processes.delete(id);

      // Clean up indexes
      if (entry?.toolCallId) {
        this.toolCallIndex.delete(entry.toolCallId);
      }
      if (entry?.shellSessionId) {
        this.shellSessionIndex.delete(entry.shellSessionId);
      }

      if (entry) {
        this.emit(ProcessManagerEvent.ProcessChanged, {
          taskId,
          type: "removed",
          process: entry,
        });
      }
    }
  }

  private addProcess(taskId: string, entry: ProcessEntry): void {
    let processes = this.taskProcesses.get(taskId);
    if (!processes) {
      processes = new Map();
      this.taskProcesses.set(taskId, processes);
    }

    processes.set(entry.id, entry);
    log.info(
      `Process added: ${entry.id} (${entry.category}) for task ${taskId}`,
    );

    this.emit(ProcessManagerEvent.ProcessChanged, {
      taskId,
      type: "added",
      process: entry,
    });
  }

  private updateProcess(
    taskId: string,
    processId: string,
    updates: Partial<ProcessEntry>,
  ): void {
    const processes = this.taskProcesses.get(taskId);
    if (!processes) return;

    const existing = processes.get(processId);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    processes.set(processId, updated);

    this.emit(ProcessManagerEvent.ProcessChanged, {
      taskId,
      type: "updated",
      process: updated,
    });
  }

  private findProcess(processId: string): ProcessEntry | undefined {
    for (const processes of this.taskProcesses.values()) {
      const entry = processes.get(processId);
      if (entry) return entry;
    }
    return undefined;
  }

  /** Map<parentProcessId, interval handle> for child discovery polling */
  private childDiscoveryIntervals = new Map<string, NodeJS.Timeout>();

  /** Map<childPid, parentProcessId> to track discovered children */
  private childToParentIndex = new Map<number, string>();

  /**
   * Start periodic discovery of child processes for a parent shell
   */
  private startChildDiscovery(
    taskId: string,
    parentProcessId: string,
    parentPid: number,
  ): void {
    // Don't start if already discovering
    if (this.childDiscoveryIntervals.has(parentProcessId)) {
      return;
    }

    log.info(
      `Starting child discovery for ${parentProcessId} (PID ${parentPid})`,
    );

    // Discover immediately
    this.discoverAndRegisterChildren(taskId, parentProcessId, parentPid);

    // Then poll every 2 seconds
    const interval = setInterval(() => {
      this.discoverAndRegisterChildren(taskId, parentProcessId, parentPid);
    }, 2000);

    this.childDiscoveryIntervals.set(parentProcessId, interval);
  }

  /**
   * Stop child discovery for a parent process
   */
  private stopChildDiscovery(parentProcessId: string): void {
    const interval = this.childDiscoveryIntervals.get(parentProcessId);
    if (interval) {
      clearInterval(interval);
      this.childDiscoveryIntervals.delete(parentProcessId);
      log.info(`Stopped child discovery for ${parentProcessId}`);
    }
  }

  /**
   * Discover children of a parent PID and register them as separate processes
   */
  private async discoverAndRegisterChildren(
    taskId: string,
    parentProcessId: string,
    parentPid: number,
  ): Promise<void> {
    try {
      const snapshot = await this.processTracking.getSnapshot(true);
      const discovered = snapshot.discovered || [];

      // Find all descendants of the parent PID
      const children = discovered.filter((p) => {
        // Direct children
        if (p.ppid === parentPid) return true;

        // Grandchildren - check if any ancestor is the parent
        let current = p;
        while (current.ppid) {
          if (current.ppid === parentPid) return true;
          current =
            discovered.find((proc) => proc.pid === current.ppid) || current;
          if (!current || current.pid === current.ppid) break;
        }
        return false;
      });

      const parentEntry = this.findProcess(parentProcessId);
      if (!parentEntry) return;

      // Register each child as a separate process
      for (const child of children) {
        const childProcessId = `child-${child.pid}`;

        // Skip if already registered
        if (this.findProcess(childProcessId)) {
          continue;
        }

        // Skip the parent itself
        if (child.pid === parentPid) {
          continue;
        }

        log.info(
          `Discovered child process: ${child.command} (PID ${child.pid}, parent: ${parentProcessId})`,
        );

        const childEntry: ProcessEntry = {
          id: childProcessId,
          taskId,
          category: "workspace-terminal",
          label: `Child: ${child.command}`,
          command: child.command,
          status: "running",
          pid: child.pid,
          parentPid: parentPid,
          startedAt: Date.now(),
          shellSessionId: parentEntry.shellSessionId, // Inherit parent's session for terminal output
        };

        this.addProcess(taskId, childEntry);
        this.childToParentIndex.set(child.pid, parentProcessId);

        // Register with ProcessTrackingService for cleanup
        this.processTracking.register(
          child.pid,
          "child",
          `child:${child.command}`,
          { parentProcessId },
          taskId,
        );
      }
    } catch (error) {
      log.error(`Failed to discover children for ${parentProcessId}:`, error);
    }
  }

  /**
   * Called when a shell exits - stop discovery and clean up children
   */
  handleShellExit(sessionId: string, exitCode: number): void {
    const processId = this.shellSessionIndex.get(sessionId);
    if (!processId) return;

    const entry = this.findProcess(processId);
    if (!entry) return;

    // Stop child discovery
    this.stopChildDiscovery(processId);

    // Update shell process status
    this.updateProcess(entry.taskId, processId, {
      status: exitCode === 0 ? "completed" : "failed",
      exitCode,
      endedAt: Date.now(),
    });

    // Update any child processes to show they're orphaned but still running
    if (entry.pid) {
      const processes = this.taskProcesses.get(entry.taskId);
      if (processes) {
        for (const [id, childEntry] of processes) {
          if (
            childEntry.parentPid === entry.pid &&
            childEntry.status === "running"
          ) {
            // Keep children as running - they're detached now
            log.info(
              `Child process ${id} continues running after parent ${processId} exit`,
            );
          }
        }
      }
    }
  }
}
