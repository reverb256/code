import {
  ArrowsClockwise,
  ArrowsLeftRight,
  Brain,
  ChatCircle,
  CheckCircle,
  FileText,
  Globe,
  type Icon,
  MagnifyingGlass,
  PencilSimple,
  Terminal,
  Trash,
  Wrench,
} from "@phosphor-icons/react";
import { Box, Flex, Link, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { TwigToolKind } from "../types/session";
import { ToolRow } from "./ToolRow";
import {
  ContentPre,
  ExpandableIcon,
  ExpandedContentBox,
  findDiffContent,
  findResourceLink,
  getContentText,
  getFilename,
  LoadingIcon,
  StatusIndicators,
  ToolTitle,
  type ToolViewProps,
  truncateText,
  useToolCallStatus,
} from "./toolCallUtils";

export function DeleteToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { status, locations, content } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const filePath = locations?.[0]?.path ?? "";
  const diff = findDiffContent(content);
  const deletedLines = diff?.oldText ? diff.oldText.split("\n").length : null;

  return (
    <Box className="max-w-4xl overflow-hidden rounded-lg border border-gray-6">
      <Flex align="center" gap="2" className="px-3 py-2">
        <LoadingIcon icon={Trash} isLoading={isLoading} />
        {filePath && (
          <Text size="1" className="font-mono text-accent-11">
            {getFilename(filePath)}
          </Text>
        )}
        {deletedLines !== null && (
          <Text size="1">
            <span className="text-red-11">-{deletedLines}</span>
          </Text>
        )}
        <StatusIndicators isFailed={isFailed} wasCancelled={wasCancelled} />
      </Flex>
    </Box>
  );
}

export function MoveToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { status, locations, title } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const sourcePath = locations?.[0]?.path ?? "";
  const destPath = locations?.[1]?.path ?? "";

  return (
    <ToolRow
      icon={ArrowsLeftRight}
      isLoading={isLoading}
      isFailed={isFailed}
      wasCancelled={wasCancelled}
    >
      {title ||
        (sourcePath && destPath
          ? `Move ${getFilename(sourcePath)} → ${getFilename(destPath)}`
          : "Move file")}
    </ToolRow>
  );
}

export function SearchToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { status, content, title } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const searchResults = getContentText(content) ?? "";
  const hasResults = searchResults.trim().length > 0;
  const resultCount = hasResults
    ? searchResults.split("\n").filter((l) => l.trim()).length
    : 0;

  if (!hasResults) {
    return (
      <ToolRow
        icon={MagnifyingGlass}
        isLoading={isLoading}
        isFailed={isFailed}
        wasCancelled={wasCancelled}
      >
        {title || "Search"}
      </ToolRow>
    );
  }

  return (
    <Box>
      <Flex
        align="center"
        gap="2"
        className="group cursor-pointer py-0.5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ExpandableIcon
          icon={MagnifyingGlass}
          isLoading={isLoading}
          isExpandable
          isExpanded={isExpanded}
        />
        <ToolTitle>{title || "Search"}</ToolTitle>
        <ToolTitle>
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </ToolTitle>
        <StatusIndicators isFailed={isFailed} wasCancelled={wasCancelled} />
      </Flex>
      {isExpanded && <ExpandedContentBox>{searchResults}</ExpandedContentBox>}
    </Box>
  );
}

export function ThinkToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { status, content, title } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const thinkingContent = getContentText(content) ?? "";
  const hasContent = thinkingContent.trim().length > 0;
  const lines = thinkingContent.split("\n");
  const preview = lines.slice(0, 5).join("\n");
  const hiddenCount = Math.max(0, lines.length - 5);

  if (!hasContent) {
    return (
      <ToolRow
        icon={Brain}
        isLoading={isLoading}
        isFailed={isFailed}
        wasCancelled={wasCancelled}
      >
        {title || "Thinking"}
      </ToolRow>
    );
  }

  return (
    <Box className="my-2 max-w-4xl overflow-hidden rounded-lg border border-gray-6 bg-gray-1">
      <Flex align="center" justify="between" className="px-3 py-2">
        <Flex align="center" gap="2">
          <LoadingIcon
            icon={Brain}
            isLoading={isLoading}
            className="text-gray-10"
          />
          <Text size="1" className="text-gray-10">
            {title || "Thinking"}
          </Text>
        </Flex>
      </Flex>
      <Box className="border-gray-6 border-t px-3 py-2">
        <Text asChild size="1" className="text-gray-11 italic">
          <pre className="m-0 whitespace-pre-wrap break-all">
            {isExpanded ? thinkingContent : preview}
          </pre>
        </Text>
        {hiddenCount > 0 && !isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="mt-1 cursor-pointer border-none bg-transparent p-0 text-gray-10 hover:text-gray-12"
          >
            <Text size="1">+{hiddenCount} more lines</Text>
          </button>
        )}
      </Box>
    </Box>
  );
}

export function FetchToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { status, content, title } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const resourceLink = findResourceLink(content);
  const fetchedContent = getContentText(content) ?? "";
  const hasContent = fetchedContent.trim().length > 0;
  const url = resourceLink?.uri ?? "";
  const isExpandable = hasContent || url.length > 60;

  return (
    <Box>
      <Flex
        align="center"
        gap="2"
        className={`group py-0.5 ${isExpandable ? "cursor-pointer" : ""}`}
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
      >
        <ExpandableIcon
          icon={Globe}
          isLoading={isLoading}
          isExpandable={isExpandable}
          isExpanded={isExpanded}
        />
        <ToolTitle>{title || "Fetch"}</ToolTitle>
        {url && (
          <ToolTitle>
            <span className="font-mono text-accent-11">
              {truncateText(url, 60)}
            </span>
          </ToolTitle>
        )}
        <StatusIndicators isFailed={isFailed} wasCancelled={wasCancelled} />
      </Flex>
      {isExpanded && (
        <Box className="max-w-4xl overflow-hidden rounded-lg border border-gray-6">
          {url.length > 60 && (
            <Box
              className={
                hasContent ? "border-gray-6 border-b px-3 py-2" : "px-3 py-2"
              }
            >
              <Link
                size="1"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all"
              >
                {url}
              </Link>
            </Box>
          )}
          {hasContent && <ContentPre>{fetchedContent}</ContentPre>}
        </Box>
      )}
    </Box>
  );
}

export function QuestionToolView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { status, content, title } = toolCall;
  const { isLoading, isComplete, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const answerText = getContentText(content);

  if (!isComplete || !answerText) {
    return (
      <ToolRow
        icon={ChatCircle}
        isLoading={isLoading}
        isFailed={isFailed}
        wasCancelled={wasCancelled}
      >
        {title || "Question"}
      </ToolRow>
    );
  }

  return (
    <Box className="my-2 max-w-4xl overflow-hidden rounded-lg border border-gray-6 bg-gray-1">
      <Flex align="center" gap="2" className="px-3 py-2">
        <ChatCircle size={12} className="text-gray-10" />
        <Text size="1" className="text-gray-10">
          {title || "Question"}
        </Text>
      </Flex>
      <Box className="border-gray-6 border-t px-3 py-2">
        <Flex align="center" gap="2">
          <CheckCircle size={14} weight="fill" className="text-green-9" />
          <Text size="1" className="text-green-11">
            {answerText}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}

const kindIcons: Record<TwigToolKind, Icon> = {
  read: FileText,
  edit: PencilSimple,
  delete: Trash,
  move: ArrowsLeftRight,
  search: MagnifyingGlass,
  execute: Terminal,
  think: Brain,
  fetch: Globe,
  switch_mode: ArrowsClockwise,
  question: ChatCircle,
  other: Wrench,
};

export function GenericToolCallView({
  toolCall,
  turnCancelled,
  turnComplete,
}: ToolViewProps) {
  const { title, kind, status, locations } = toolCall;
  const { isLoading, isFailed, wasCancelled } = useToolCallStatus(
    status,
    turnCancelled,
    turnComplete,
  );
  const KindIcon = (kind && kindIcons[kind]) || Wrench;
  const filePath = kind === "read" && locations?.[0]?.path;
  const displayText = filePath
    ? `Read ${getFilename(filePath)}`
    : (title ?? undefined);

  return (
    <ToolRow
      icon={KindIcon}
      isLoading={isLoading}
      isFailed={isFailed}
      wasCancelled={wasCancelled}
    >
      {displayText}
    </ToolRow>
  );
}
