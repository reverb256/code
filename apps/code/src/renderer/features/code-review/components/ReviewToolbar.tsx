import { DiffSettingsMenu } from "@features/code-editor/components/DiffSettingsMenu";
import { useDiffViewerStore } from "@features/code-editor/stores/diffViewerStore";
import { ArrowsIn, ArrowsOut, Columns, Rows } from "@phosphor-icons/react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { memo } from "react";

interface ReviewToolbarProps {
  fileCount: number;
  linesAdded: number;
  linesRemoved: number;
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const ReviewToolbar = memo(function ReviewToolbar({
  fileCount,
  linesAdded,
  linesRemoved,
  allExpanded,
  onExpandAll,
  onCollapseAll,
}: ReviewToolbarProps) {
  const viewMode = useDiffViewerStore((s) => s.viewMode);
  const toggleViewMode = useDiffViewerStore((s) => s.toggleViewMode);

  return (
    <Flex
      px="3"
      py="2"
      align="center"
      gap="3"
      style={{
        borderBottom: "1px solid var(--gray-6)",
        background: "var(--color-background)",
        position: "sticky",
        top: 0,
        zIndex: 2,
        flexShrink: 0,
      }}
    >
      <Text size="2" weight="medium">
        {fileCount} file{fileCount !== 1 ? "s" : ""} changed
      </Text>
      <Flex
        align="center"
        gap="1"
        style={{ fontSize: "12px", fontFamily: "monospace" }}
      >
        {linesAdded > 0 && (
          <Text style={{ color: "var(--green-9)" }}>+{linesAdded}</Text>
        )}
        {linesRemoved > 0 && (
          <Text style={{ color: "var(--red-9)" }}>-{linesRemoved}</Text>
        )}
      </Flex>

      <Flex align="center" gap="1" ml="auto">
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={toggleViewMode}
          style={{ cursor: "pointer" }}
        >
          {viewMode === "split" ? <Rows size={14} /> : <Columns size={14} />}
          <Text size="1">{viewMode === "split" ? "Unified" : "Split"}</Text>
        </Button>

        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={allExpanded ? onCollapseAll : onExpandAll}
          style={{ cursor: "pointer" }}
        >
          {allExpanded ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}
          <Text size="1">{allExpanded ? "Collapse" : "Expand"}</Text>
        </Button>

        <DiffSettingsMenu />
      </Flex>
    </Flex>
  );
});
