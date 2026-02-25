import { z } from "zod";

export const processCategory = z.enum([
  "agent-bash",
  "shell",
  "workspace-terminal",
]);
export const processStatus = z.enum([
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const processEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  category: processCategory,
  label: z.string(),
  command: z.string(),
  status: processStatus,
  pid: z.number().optional(),
  exitCode: z.number().optional(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  toolCallId: z.string().optional(),
  capturedOutput: z.string().optional(),
  shellSessionId: z.string().optional(),
  scriptType: z.enum(["init", "start"]).optional(),
});

export const processChangeEventSchema = z.object({
  taskId: z.string(),
  type: z.enum(["added", "updated", "removed"]),
  process: processEntrySchema,
});

export const ProcessManagerEvent = {
  ProcessChanged: "process-changed",
} as const;

export interface ProcessManagerEvents {
  [ProcessManagerEvent.ProcessChanged]: z.infer<
    typeof processChangeEventSchema
  >;
}
