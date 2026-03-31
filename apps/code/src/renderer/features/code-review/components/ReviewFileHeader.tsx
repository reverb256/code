import { FileIcon } from "@components/ui/FileIcon";
import { getStatusIndicator } from "@features/git-interaction/utils/gitFileStatus";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Badge, Flex, Text } from "@radix-ui/themes";
import type { ChangedFile } from "@shared/types";
import { memo, useCallback } from "react";

interface ReviewFileHeaderProps {
  file: ChangedFile;
  isExpanded: boolean;
  onToggle: (filePath: string) => void;
}

export const ReviewFileHeader = memo(function ReviewFileHeader({
  file,
  isExpanded,
  onToggle,
}: ReviewFileHeaderProps) {
  const handleToggle = useCallback(
    () => onToggle(file.path),
    [onToggle, file.path],
  );
  const fileName = file.path.split("/").pop() || file.path;
  const indicator = getStatusIndicator(file.status);
  const hasLineStats =
    file.linesAdded !== undefined || file.linesRemoved !== undefined;

  return (
    <Flex
      align="center"
      gap="2"
      px="3"
      py="2"
      onClick={handleToggle}
      className="hover:bg-gray-3"
      style={{
        cursor: "pointer",
        borderBottom: "1px solid var(--gray-5)",
        background: "var(--gray-2)",
        userSelect: "none",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      {isExpanded ? (
        <CaretDown size={12} color="var(--gray-9)" />
      ) : (
        <CaretRight size={12} color="var(--gray-9)" />
      )}
      <FileIcon filename={fileName} size={14} />
      <Text
        size="1"
        weight="medium"
        style={{ fontFamily: "var(--code-font-family)" }}
      >
        {fileName}
      </Text>
      <Text
        size="1"
        color="gray"
        style={{ fontFamily: "var(--code-font-family)" }}
      >
        {file.originalPath
          ? `${file.originalPath} \u2192 ${file.path}`
          : file.path}
      </Text>
      <Flex align="center" gap="1" ml="auto">
        {hasLineStats && (
          <Flex
            align="center"
            gap="1"
            style={{ fontSize: "10px", fontFamily: "monospace" }}
          >
            {(file.linesAdded ?? 0) > 0 && (
              <Text style={{ color: "var(--green-9)" }}>
                +{file.linesAdded}
              </Text>
            )}
            {(file.linesRemoved ?? 0) > 0 && (
              <Text style={{ color: "var(--red-9)" }}>
                -{file.linesRemoved}
              </Text>
            )}
          </Flex>
        )}
        <Badge
          size="1"
          color={indicator.color}
          style={{ fontSize: "10px", padding: "0 4px" }}
        >
          {indicator.label}
        </Badge>
      </Flex>
    </Flex>
  );
});
