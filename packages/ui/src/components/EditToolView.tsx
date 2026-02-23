import { PencilSimple } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import {
  ContentPre,
  findDiffContent,
  getFilename,
  LoadingIcon,
  StatusIndicators,
  type ToolViewProps,
  useToolCallStatus,
} from "./toolCallUtils";

export function EditToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { status, content, locations } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );

  const diff = findDiffContent(content);
  const filePath = diff?.path ?? locations?.[0]?.path ?? "";
  const oldText = diff?.oldText;
  const newText = diff?.newText;

  const added = newText ? newText.split("\n").length : 0;
  const removed = oldText ? oldText.split("\n").length : 0;

  return (
    <Box className="max-w-4xl overflow-hidden rounded-lg border border-gray-6">
      <Flex align="center" gap="2" className="px-3 py-2">
        <LoadingIcon icon={PencilSimple} isLoading={isLoading} />
        {filePath && (
          <Text size="1" className="font-mono text-accent-11">
            {getFilename(filePath)}
          </Text>
        )}
        {diff && (
          <Text size="1">
            <span className="text-green-11">+{added}</span>{" "}
            <span className="text-red-11">-{removed}</span>
          </Text>
        )}
        <StatusIndicators isFailed={isFailed} wasCancelled={wasCancelled} />
      </Flex>
      {newText && <ContentPre>{newText}</ContentPre>}
    </Box>
  );
}
