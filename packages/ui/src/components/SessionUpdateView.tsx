import type { SessionNotification } from "@agentclientprotocol/sdk";
import { memo } from "react";
import type { ToolCall } from "../types/session";
import { AgentMessage } from "./AgentMessage";
import {
  CompactBoundaryView,
  ConsoleMessage,
  ErrorNotificationView,
  StatusNotificationView,
  TaskNotificationView,
} from "./NotificationViews";
import { ThoughtView } from "./ThoughtView";
import { ToolCallBlock } from "./ToolCallBlock";

type SessionUpdate = SessionNotification["update"];

export type RenderItem =
  | SessionUpdate
  | {
      sessionUpdate: "console";
      level: string;
      message: string;
      timestamp?: string;
    }
  | {
      sessionUpdate: "compact_boundary";
      trigger: "manual" | "auto";
      preTokens: number;
    }
  | { sessionUpdate: "status"; status: string; isComplete?: boolean }
  | { sessionUpdate: "error"; errorType: string; message: string }
  | {
      sessionUpdate: "task_notification";
      taskId: string;
      status: "completed" | "failed" | "stopped";
      summary: string;
      outputFile: string;
    };

interface SessionUpdateViewProps {
  item: RenderItem;
  toolCalls?: Map<string, ToolCall>;
  turnCancelled?: boolean;
  turnComplete?: boolean;
}

export const SessionUpdateView = memo(function SessionUpdateView({
  item,
  toolCalls,
  turnCancelled,
  turnComplete,
}: SessionUpdateViewProps) {
  switch (item.sessionUpdate) {
    case "user_message_chunk":
      return null;
    case "agent_message_chunk":
      return item.content.type === "text" ? (
        <AgentMessage content={item.content.text} />
      ) : null;
    case "agent_thought_chunk":
      return item.content.type === "text" ? (
        <ThoughtView content={item.content.text} />
      ) : null;
    case "tool_call":
      return (
        <ToolCallBlock
          toolCall={toolCalls?.get(item.toolCallId) ?? item}
          turnCancelled={turnCancelled}
          turnComplete={turnComplete}
        />
      );
    case "tool_call_update":
    case "plan":
    case "available_commands_update":
    case "config_option_update":
      return null;
    case "console":
      return (
        <ConsoleMessage
          level={item.level as "info" | "debug" | "warn" | "error"}
          message={item.message}
          timestamp={item.timestamp}
        />
      );
    case "compact_boundary":
      return (
        <CompactBoundaryView
          trigger={item.trigger}
          preTokens={item.preTokens}
        />
      );
    case "status":
      return (
        <StatusNotificationView
          status={item.status}
          isComplete={item.isComplete}
        />
      );
    case "error":
      return (
        <ErrorNotificationView
          errorType={item.errorType}
          message={item.message}
        />
      );
    case "task_notification":
      return (
        <TaskNotificationView status={item.status} summary={item.summary} />
      );
    default:
      return null;
  }
});
