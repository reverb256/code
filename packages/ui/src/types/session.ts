import type {
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
} from "@agentclientprotocol/sdk";

export type TwigToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "question"
  | "other";

export type { ToolCallContent, ToolCallStatus, ToolCallLocation };

export interface ToolCall {
  _meta?: { [key: string]: unknown } | null;
  content?: ToolCallContent[];
  kind?: TwigToolKind | null;
  locations?: ToolCallLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
  status?: ToolCallStatus | null;
  title: string;
  toolCallId: string;
}
