import type { RenderItem } from "@posthog/ui";
import {
  type AcpMessage,
  buildConversationItems,
  type ConversationItem,
  GitActionMessage,
  SessionUpdateView,
  TurnCancelledView,
  type TurnContext,
  UserMessage,
} from "@posthog/ui";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

interface ConversationViewProps {
  events: AcpMessage[];
  isPromptPending: boolean;
}

const SessionUpdateRow = memo(function SessionUpdateRow({
  update,
  turnContext,
}: {
  update: RenderItem;
  turnContext: TurnContext;
}) {
  return (
    <SessionUpdateView
      item={update}
      toolCalls={turnContext.toolCalls}
      turnCancelled={turnContext.turnCancelled}
      turnComplete={turnContext.turnComplete}
    />
  );
});

export function ConversationView({
  events,
  isPromptPending,
}: ConversationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const { items } = useMemo(
    () => buildConversationItems(events, isPromptPending),
    [events, isPromptPending],
  );

  useEffect(() => {
    if (items.length > prevCountRef.current) {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  const renderItem = useCallback((item: ConversationItem) => {
    switch (item.type) {
      case "user_message":
        return <UserMessage content={item.content} />;
      case "git_action":
        return <GitActionMessage actionType={item.actionType} />;
      case "session_update":
        return (
          <SessionUpdateRow
            update={item.update}
            turnContext={item.turnContext}
          />
        );
      case "git_action_result":
        return <GitActionMessage actionType={item.actionType} />;
      case "turn_cancelled":
        return <TurnCancelledView interruptReason={item.interruptReason} />;
      default:
        return null;
    }
  }, []);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-1 p-4">
      <div className="mx-auto flex max-w-[750px] flex-col gap-3">
        {items.map((item) => (
          <div key={item.id}>{renderItem(item)}</div>
        ))}
      </div>
    </div>
  );
}
