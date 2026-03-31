import { DotsThree } from "@phosphor-icons/react";
import { DropdownMenu, IconButton, Text } from "@radix-ui/themes";
import { useDiffViewerStore } from "../stores/diffViewerStore";

interface DiffSettingsMenuProps {
  onRefresh?: () => void;
}

export function DiffSettingsMenu({ onRefresh }: DiffSettingsMenuProps) {
  const wordWrap = useDiffViewerStore((s) => s.wordWrap);
  const toggleWordWrap = useDiffViewerStore((s) => s.toggleWordWrap);
  const loadFullFiles = useDiffViewerStore((s) => s.loadFullFiles);
  const toggleLoadFullFiles = useDiffViewerStore((s) => s.toggleLoadFullFiles);
  const wordDiffs = useDiffViewerStore((s) => s.wordDiffs);
  const toggleWordDiffs = useDiffViewerStore((s) => s.toggleWordDiffs);
  const hideWhitespaceChanges = useDiffViewerStore(
    (s) => s.hideWhitespaceChanges,
  );
  const toggleHideWhitespaceChanges = useDiffViewerStore(
    (s) => s.toggleHideWhitespaceChanges,
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton size="1" variant="ghost" style={{ color: "var(--gray-9)" }}>
          <DotsThree size={16} weight="bold" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1" align="end">
        <DropdownMenu.Item onSelect={toggleWordWrap}>
          <Text size="1">
            {wordWrap ? "Disable word wrap" : "Enable word wrap"}
          </Text>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={toggleLoadFullFiles}>
          <Text size="1">
            {loadFullFiles ? "Collapse unchanged" : "Load full files"}
          </Text>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={toggleWordDiffs}>
          <Text size="1">
            {wordDiffs ? "Disable word diffs" : "Enable word diffs"}
          </Text>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={toggleHideWhitespaceChanges}>
          <Text size="1">
            {hideWhitespaceChanges ? "Show whitespace" : "Hide whitespace"}
          </Text>
        </DropdownMenu.Item>

        {onRefresh && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={onRefresh}>
              <Text size="1">Refresh</Text>
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
