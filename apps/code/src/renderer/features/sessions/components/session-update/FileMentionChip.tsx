import { FileIcon } from "@components/ui/FileIcon";
import { usePanelLayoutStore } from "@features/panels";
import { useCwd } from "@features/sidebar/hooks/useCwd";
import { useTaskStore } from "@features/tasks/stores/taskStore";
import { useWorkspace } from "@features/workspace/hooks/useWorkspace";
import { Flex, Text, Tooltip } from "@radix-ui/themes";
import { prepare, layout } from "@chenglou/pretext";
import { trpcClient } from "@renderer/trpc/client";
import { handleExternalAppAction } from "@utils/handleExternalAppAction";
import { isAbsolutePath } from "@utils/path";
import { memo, useCallback, useMemo, useState } from "react";
import { getFilename } from "./toolCallUtils";

const FONT =
  '12px ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const LINE_HEIGHT = 16;

interface FileMentionChipProps {
  filePath: string;
}

function toRelativePath(absolutePath: string, repoPath: string | null): string {
  if (!absolutePath) return absolutePath;
  if (!repoPath) return absolutePath;
  const normalizedRepo = repoPath.endsWith("/")
    ? repoPath.slice(0, -1)
    : repoPath;
  if (absolutePath.startsWith(`${normalizedRepo}/`)) {
    return absolutePath.slice(normalizedRepo.length + 1);
  }
  if (absolutePath === normalizedRepo) {
    return "";
  }
  return absolutePath;
}

function fitsInOneLine(text: string, maxWidth: number): boolean {
  try {
    const prepared = prepare(text, FONT);
    const { lineCount } = layout(prepared, maxWidth, LINE_HEIGHT);
    return lineCount <= 1;
  } catch {
    return true;
  }
}

/**
 * Middle-truncate a path, always breaking between slashes.
 * Keeps first segment(s) + filename, replaces middle with "..."
 * e.g. "a/b/c/d/file.tsx" → "a/.../d/file.tsx"
 */
function middleTruncatePath(
  path: string,
  maxWidth: number,
): { display: string; isTruncated: boolean } {
  if (fitsInOneLine(path, maxWidth)) {
    return { display: path, isTruncated: false };
  }

  const parts = path.split("/");
  const filename = parts[parts.length - 1];

  // Try keeping first N segments + last M segments, with "..." between
  // Prefer keeping more leading segments (left-to-right preference)
  for (let totalRemove = 1; totalRemove < parts.length - 1; totalRemove++) {
    for (
      let keepLeading = 1;
      keepLeading <= parts.length - totalRemove - 1;
      keepLeading++
    ) {
      const candidate = [
        ...parts.slice(0, keepLeading),
        "...",
        ...parts.slice(keepLeading + totalRemove),
      ].join("/");

      if (fitsInOneLine(candidate, maxWidth)) {
        return { display: candidate, isTruncated: true };
      }
    }
  }

  // Last resort: just ".../filename"
  return { display: `.../${filename}`, isTruncated: true };
}

export const FileMentionChip = memo(function FileMentionChip({
  filePath,
}: FileMentionChipProps) {
  const taskId = useTaskStore((s) => s.selectedTaskId);
  const repoPath = useCwd(taskId ?? "");
  const workspace = useWorkspace(taskId ?? undefined);
  const openFileInSplit = usePanelLayoutStore((s) => s.openFileInSplit);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const filename = getFilename(filePath);
  const mainRepoPath = workspace?.folderPath;

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const available = node.parentElement?.clientWidth ?? 0;
      // Account for icon (~16px) and gap (4px)
      setContainerWidth(Math.max(available - 20, 60));
    }
  }, []);

  const relativePath = toRelativePath(filePath, repoPath ?? null);

  const truncated = useMemo(() => {
    if (!containerWidth || !relativePath) {
      return { display: relativePath || filename, isTruncated: false };
    }
    return middleTruncatePath(relativePath, containerWidth);
  }, [relativePath, filename, containerWidth]);

  const handleClick = useCallback(() => {
    if (!taskId) return;
    const relPath = toRelativePath(filePath, repoPath ?? null);
    openFileInSplit(taskId, relPath, true);
  }, [taskId, filePath, repoPath, openFileInSplit]);

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const absolutePath = isAbsolutePath(filePath)
        ? filePath
        : repoPath
          ? `${repoPath}/${filePath}`
          : filePath;

      const result = await trpcClient.contextMenu.showFileContextMenu.mutate({
        filePath: absolutePath,
        showCollapseAll: false,
      });

      if (!result.action) return;

      if (result.action.type === "external-app") {
        await handleExternalAppAction(
          result.action.action,
          absolutePath,
          filename,
          { workspace, mainRepoPath },
        );
      }
    },
    [filePath, repoPath, filename, workspace, mainRepoPath],
  );

  const isClickable = !!taskId;

  const content = (
    <Flex
      ref={measuredRef}
      align="center"
      gap="1"
      asChild
      onClick={isClickable ? handleClick : undefined}
      onContextMenu={handleContextMenu}
      className={`min-w-0 shrink ${isClickable ? "cursor-pointer hover:underline" : ""}`}
    >
      <Text size="1">
        <FileIcon filename={filename} size={12} />
        <span className="font-mono">{truncated.display}</span>
      </Text>
    </Flex>
  );

  if (truncated.isTruncated) {
    return <Tooltip content={relativePath}>{content}</Tooltip>;
  }

  return content;
});
