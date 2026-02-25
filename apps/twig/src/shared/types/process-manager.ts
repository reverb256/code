export type ProcessCategory = "agent-bash" | "shell" | "workspace-terminal";

export type ProcessStatus = "running" | "completed" | "failed" | "cancelled";

export interface ProcessEntry {
  /** Unique ID for this process entry */
  id: string;
  /** Task this process belongs to */
  taskId: string;
  /** Category of process */
  category: ProcessCategory;
  /** Display label (command for bash, "Terminal" for shells) */
  label: string;
  /** Full command text */
  command: string;
  /** Current status */
  status: ProcessStatus;
  /** PID if available */
  pid?: number;
  /** PID of parent process (shell or other parent) */
  parentPid?: number;
  /** Exit code when completed */
  exitCode?: number;
  /** When the process started */
  startedAt: number;
  /** When the process ended */
  endedAt?: number;
  /** For agent bash: the ACP toolCallId */
  toolCallId?: string;
  /** For agent bash: captured output text */
  capturedOutput?: string;
  /** For shell/workspace: the shell sessionId for terminal reuse */
  shellSessionId?: string;
  /** For workspace terminals: script type */
  scriptType?: "init" | "start";
}

export interface ProcessChangeEvent {
  taskId: string;
  type: "added" | "updated" | "removed";
  process: ProcessEntry;
}
