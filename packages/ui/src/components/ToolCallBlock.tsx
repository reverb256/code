import { Box } from "@radix-ui/themes";
import { EditToolView } from "./EditToolView";
import { ExecuteToolView } from "./ExecuteToolView";
import {
  DeleteToolView,
  FetchToolView,
  GenericToolCallView,
  MoveToolView,
  QuestionToolView,
  SearchToolView,
  ThinkToolView,
} from "./GenericToolViews";
import { ReadToolView } from "./ReadToolView";
import type { ToolViewProps } from "./toolCallUtils";

export function ToolCallBlock({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const meta = toolCall._meta as
    | { claudeCode?: { toolName?: string } }
    | undefined;
  if (meta?.claudeCode?.toolName === "EnterPlanMode") return null;

  const props = { toolCall, turnCancelled, turnComplete };

  const content = (() => {
    switch (toolCall.kind) {
      case "execute":
        return <ExecuteToolView {...props} />;
      case "read":
        return <ReadToolView {...props} />;
      case "edit":
        return <EditToolView {...props} />;
      case "delete":
        return <DeleteToolView {...props} />;
      case "move":
        return <MoveToolView {...props} />;
      case "search":
        return <SearchToolView {...props} />;
      case "think":
        return <ThinkToolView {...props} />;
      case "fetch":
        return <FetchToolView {...props} />;
      case "question":
        return <QuestionToolView {...props} />;
      default:
        return <GenericToolCallView {...props} />;
    }
  })();

  return <Box className="pl-3">{content}</Box>;
}
