import type {
  ContentBlock,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type { RenderItem } from "../components/SessionUpdateView";
import type { ToolCall } from "../types/session";
import {
  type AcpMessage,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  type JsonRpcMessage,
} from "../types/session-events";

export interface TurnContext {
  toolCalls: Map<string, ToolCall>;
  turnCancelled: boolean;
  turnComplete: boolean;
}

export type GitActionType =
  | "commit-push"
  | "publish"
  | "push"
  | "pull"
  | "sync"
  | "create-pr";

export type ConversationItem =
  | { type: "user_message"; id: string; content: string }
  | { type: "git_action"; id: string; actionType: GitActionType }
  | {
      type: "session_update";
      id: string;
      update: RenderItem;
      turnContext: TurnContext;
    }
  | {
      type: "git_action_result";
      id: string;
      actionType: GitActionType;
      turnId: string;
    }
  | { type: "turn_cancelled"; id: string; interruptReason?: string };

export interface LastTurnInfo {
  isComplete: boolean;
  durationMs: number;
  stopReason?: string;
}

export interface BuildResult {
  items: ConversationItem[];
  lastTurnInfo: LastTurnInfo | null;
}

type SessionUpdate = SessionNotification["update"];

const GIT_ACTION_MARKER_PREFIX = "<!-- GIT_ACTION:";
const GIT_ACTION_MARKER_SUFFIX = " -->";

function parseGitActionMessage(content: string) {
  if (!content.startsWith(GIT_ACTION_MARKER_PREFIX)) {
    return {
      isGitAction: false,
      actionType: null as GitActionType | null,
      prompt: content,
    };
  }
  const markerEnd = content.indexOf(GIT_ACTION_MARKER_SUFFIX);
  if (markerEnd === -1) {
    return {
      isGitAction: false,
      actionType: null as GitActionType | null,
      prompt: content,
    };
  }
  const actionType = content.slice(
    GIT_ACTION_MARKER_PREFIX.length,
    markerEnd,
  ) as GitActionType;
  const prompt = content.slice(markerEnd + GIT_ACTION_MARKER_SUFFIX.length + 1);
  return { isGitAction: true, actionType, prompt };
}

interface TurnState {
  id: string;
  promptId: number;
  isComplete: boolean;
  stopReason?: string;
  interruptReason?: string;
  durationMs: number;
  toolCalls: Map<string, ToolCall>;
  context: TurnContext;
  gitAction: ReturnType<typeof parseGitActionMessage>;
  itemCount: number;
}

interface ItemBuilder {
  items: ConversationItem[];
  currentTurn: TurnState | null;
  pendingPrompts: Map<number, TurnState>;
  nextId: () => number;
}

function createItemBuilder(): ItemBuilder {
  let idCounter = 0;
  return {
    items: [],
    currentTurn: null,
    pendingPrompts: new Map(),
    nextId: () => idCounter++,
  };
}

function pushItem(b: ItemBuilder, update: RenderItem) {
  const turn = b.currentTurn;
  if (!turn) return;
  turn.itemCount++;
  b.items.push({
    type: "session_update",
    id: `${turn.id}-item-${b.nextId()}`,
    update,
    turnContext: turn.context,
  });
}

export function buildConversationItems(
  events: AcpMessage[],
  isPromptPending: boolean,
): BuildResult {
  const b = createItemBuilder();

  for (const event of events) {
    const msg = event.message;
    if (isJsonRpcNotification(msg)) {
      handleNotification(b, msg, event.ts);
      continue;
    }
    if (isJsonRpcRequest(msg) && msg.method === "session/prompt") {
      handlePromptRequest(b, msg, event.ts);
      continue;
    }
    if (isJsonRpcResponse(msg) && b.pendingPrompts.has(msg.id)) {
      handlePromptResponse(b, msg, event.ts);
    }
  }

  if (!isPromptPending) {
    for (const turn of b.pendingPrompts.values()) {
      turn.isComplete = true;
      turn.stopReason = "cancelled";
      turn.context.turnCancelled = true;
      turn.context.turnComplete = true;
      b.items.push({
        type: "turn_cancelled",
        id: `${turn.id}-cancelled`,
        interruptReason: turn.interruptReason,
      });
    }
  }

  const lastTurnInfo: LastTurnInfo | null = b.currentTurn
    ? {
        isComplete: b.currentTurn.isComplete,
        durationMs: b.currentTurn.durationMs,
        stopReason: b.currentTurn.stopReason,
      }
    : null;

  return { items: b.items, lastTurnInfo };
}

function extractUserContent(params: unknown): string {
  const p = params as { prompt?: ContentBlock[] };
  if (!p?.prompt?.length) return "";
  const visibleTextBlocks = p.prompt.filter(
    (
      b,
    ): b is {
      type: "text";
      text: string;
      _meta?: { ui?: { hidden?: boolean } };
    } => {
      if (b.type !== "text") return false;
      const meta = (b as { _meta?: { ui?: { hidden?: boolean } } })._meta;
      return !meta?.ui?.hidden;
    },
  );
  return visibleTextBlocks.map((b) => b.text).join("");
}

function handlePromptRequest(
  b: ItemBuilder,
  msg: { id: number; params?: unknown },
  ts: number,
) {
  const userContent = extractUserContent(msg.params);
  const turnId = `turn-${ts}-${msg.id}`;
  const toolCalls = new Map<string, ToolCall>();
  const gitAction = parseGitActionMessage(userContent);
  const context: TurnContext = {
    toolCalls,
    turnCancelled: false,
    turnComplete: false,
  };

  b.currentTurn = {
    id: turnId,
    promptId: msg.id,
    isComplete: false,
    durationMs: -ts,
    toolCalls,
    context,
    gitAction,
    itemCount: 0,
  };
  b.pendingPrompts.set(msg.id, b.currentTurn);
  if (userContent.trim().length === 0) return;

  if (gitAction.isGitAction && gitAction.actionType) {
    b.items.push({
      type: "git_action",
      id: `${turnId}-git-action`,
      actionType: gitAction.actionType,
    });
  } else {
    b.items.push({
      type: "user_message",
      id: `${turnId}-user`,
      content: userContent,
    });
  }
}

function handlePromptResponse(
  b: ItemBuilder,
  msg: { id: number; result?: unknown },
  ts: number,
) {
  const turn = b.pendingPrompts.get(msg.id)!;
  turn.isComplete = true;
  turn.durationMs += ts;
  const result = msg.result as {
    stopReason?: string;
    _meta?: { interruptReason?: string };
  };
  turn.stopReason = result?.stopReason;
  turn.interruptReason = result?._meta?.interruptReason;
  turn.context.turnComplete = true;
  const wasCancelled = turn.stopReason === "cancelled";
  turn.context.turnCancelled = wasCancelled;

  if (turn.gitAction.isGitAction && turn.gitAction.actionType) {
    b.items.push({
      type: "git_action_result",
      id: `${turn.id}-git-result`,
      actionType: turn.gitAction.actionType,
      turnId: turn.id,
    });
  }
  if (wasCancelled) {
    b.items.push({
      type: "turn_cancelled",
      id: `${turn.id}-cancelled`,
      interruptReason: turn.interruptReason,
    });
  }
  b.pendingPrompts.delete(msg.id);
}

function handleNotification(
  b: ItemBuilder,
  msg: { method: string; params?: unknown },
  ts: number,
) {
  switch (msg.method) {
    case "session/update": {
      if (!b.currentTurn) return;
      const update = (msg.params as SessionNotification)?.update;
      if (update) processSessionUpdate(b, update);
      return;
    }
    case "_posthog/console": {
      if (!b.currentTurn) return;
      const params = msg.params as { level?: string; message?: string };
      if (params?.message) {
        pushItem(b, {
          sessionUpdate: "console",
          level: params.level ?? "info",
          message: params.message,
          timestamp: new Date(ts).toISOString(),
        });
      }
      return;
    }
    case "_posthog/compact_boundary":
    case "_posthog/status":
    case "_posthog/task_notification": {
      if (!b.currentTurn) return;
      pushItem(b, msg.params as RenderItem);
      return;
    }
  }
}

function processSessionUpdate(b: ItemBuilder, update: SessionUpdate) {
  switch (update.sessionUpdate) {
    case "user_message_chunk":
      break;
    case "agent_message_chunk":
    case "agent_thought_chunk":
      if (update.content.type === "text") appendTextChunk(b, update);
      break;
    case "tool_call": {
      const turn = b.currentTurn!;
      const existing = turn.toolCalls.get(update.toolCallId);
      if (existing) {
        Object.assign(existing, update);
      } else {
        const toolCall = { ...update };
        turn.toolCalls.set(update.toolCallId, toolCall);
        pushItem(b, toolCall);
      }
      break;
    }
    case "tool_call_update": {
      const turn = b.currentTurn!;
      const existing = turn.toolCalls.get(update.toolCallId);
      if (existing) {
        const { sessionUpdate: _, ...rest } = update;
        Object.assign(existing, rest);
      }
      break;
    }
    case "plan":
    case "available_commands_update":
    case "config_option_update":
      break;
    default: {
      const customUpdate = update as unknown as {
        sessionUpdate: string;
        content?: { type: string; text?: string };
        status?: string;
        errorType?: string;
        message?: string;
      };
      if (customUpdate.sessionUpdate === "agent_message") {
        if (customUpdate.content?.type === "text") {
          appendTextChunk(b, {
            sessionUpdate: "agent_message_chunk" as const,
            content: customUpdate.content as { type: "text"; text: string },
          });
        }
      } else if (
        customUpdate.sessionUpdate === "status" ||
        customUpdate.sessionUpdate === "error"
      ) {
        pushItem(b, customUpdate as unknown as SessionUpdate);
      }
      break;
    }
  }
}

function appendTextChunk(
  b: ItemBuilder,
  update: SessionUpdate & {
    sessionUpdate: "agent_message_chunk" | "agent_thought_chunk";
  },
) {
  if (update.content.type !== "text") return;
  const lastItem = b.items[b.items.length - 1];
  if (
    lastItem?.type === "session_update" &&
    lastItem.update.sessionUpdate === update.sessionUpdate &&
    "content" in lastItem.update &&
    lastItem.update.content.type === "text"
  ) {
    b.items[b.items.length - 1] = {
      ...lastItem,
      update: {
        ...lastItem.update,
        content: {
          type: "text",
          text: lastItem.update.content.text + update.content.text,
        },
      },
    };
  } else {
    pushItem(b, { ...update, content: { ...update.content } });
  }
}

export function storedLogEntriesToAcpMessages(
  entries: Array<{
    type: string;
    timestamp?: string;
    notification?: {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: unknown;
    };
  }>,
): AcpMessage[] {
  const messages: AcpMessage[] = [];
  for (const entry of entries) {
    if (!entry.notification) continue;
    const msg = entry.notification as JsonRpcMessage;
    if (
      !("method" in msg) &&
      !("result" in msg) &&
      !("error" in msg) &&
      !("id" in msg)
    )
      continue;
    messages.push({
      type: "acp_message",
      ts: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
      message: msg,
    });
  }
  return messages;
}
