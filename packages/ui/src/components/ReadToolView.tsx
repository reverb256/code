import { FileText } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import {
  ContentPre,
  ExpandableIcon,
  getFilename,
  getReadToolContent,
  StatusIndicators,
  ToolTitle,
  type ToolViewProps,
  useToolCallStatus,
} from "./toolCallUtils";

export function ReadToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { status, locations, content } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );

  const filePath = locations?.[0]?.path ?? "";
  const fileContent = getReadToolContent(content);
  const lineCount = fileContent ? fileContent.split("\n").length : null;
  const isExpandable = !!fileContent;

  return (
    <Box>
      <Flex
        align="center"
        gap="2"
        className={`group py-0.5 ${isExpandable ? "cursor-pointer" : ""}`}
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
      >
        <ExpandableIcon
          icon={FileText}
          isLoading={isLoading}
          isExpandable={isExpandable}
          isExpanded={isExpanded}
        />
        <ToolTitle>
          Read{lineCount !== null ? ` ${lineCount} lines in` : ""}
        </ToolTitle>
        {filePath && (
          <Text size="1" className="font-mono text-accent-11">
            {getFilename(filePath)}
          </Text>
        )}
        <StatusIndicators isFailed={isFailed} wasCancelled={wasCancelled} />
      </Flex>
      {isExpanded && fileContent && (
        <Box className="mt-2 ml-5 max-w-4xl overflow-hidden rounded-lg border border-gray-6">
          <ContentPre>{fileContent}</ContentPre>
        </Box>
      )}
    </Box>
  );
}
