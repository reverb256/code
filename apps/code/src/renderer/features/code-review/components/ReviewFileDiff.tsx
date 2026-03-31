import { useDiffViewerStore } from "@features/code-editor/stores/diffViewerStore";
import { MultiFileDiff } from "@pierre/diffs/react";
import { Flex, Spinner, Text } from "@radix-ui/themes";
import { useTRPC } from "@renderer/trpc/client";
import type { GitFileStatus } from "@shared/types";
import { useThemeStore } from "@stores/themeStore";
import { useQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";

interface ReviewFileDiffProps {
  filePath: string;
  repoPath: string;
  status: GitFileStatus;
  originalPath?: string;
}

export const ReviewFileDiff = memo(function ReviewFileDiff({
  filePath,
  repoPath,
  status,
  originalPath,
}: ReviewFileDiffProps) {
  const trpc = useTRPC();

  const isDeleted = status === "deleted";
  const isNew = status === "untracked" || status === "added";
  const effectiveOriginalPath = originalPath ?? filePath;

  const { data: modifiedContent, isLoading: loadingModified } = useQuery(
    trpc.fs.readRepoFile.queryOptions(
      { repoPath, filePath },
      { enabled: !isDeleted, staleTime: 30_000 },
    ),
  );

  const { data: originalContent, isLoading: loadingOriginal } = useQuery(
    trpc.git.getFileAtHead.queryOptions(
      { directoryPath: repoPath, filePath: effectiveOriginalPath },
      { enabled: !isNew, staleTime: 30_000 },
    ),
  );

  const viewMode = useDiffViewerStore((s) => s.viewMode);
  const wordWrap = useDiffViewerStore((s) => s.wordWrap);
  const loadFullFiles = useDiffViewerStore((s) => s.loadFullFiles);
  const wordDiffs = useDiffViewerStore((s) => s.wordDiffs);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);

  const options = useMemo(
    () => ({
      diffStyle: viewMode as "split" | "unified",
      overflow: (wordWrap ? "wrap" : "scroll") as "wrap" | "scroll",
      expandUnchanged: loadFullFiles,
      lineDiffType: (wordDiffs ? "word" : "none") as "word" | "none",
      themeType: (isDarkMode ? "dark" : "light") as "dark" | "light",
      disableFileHeader: true,
      theme: { dark: "github-dark" as const, light: "github-light" as const },
    }),
    [viewMode, wordWrap, loadFullFiles, wordDiffs, isDarkMode],
  );

  const isLoading =
    (!isDeleted && loadingModified) || (!isNew && loadingOriginal);

  if (isLoading) {
    return (
      <Flex align="center" justify="center" gap="2" py="6">
        <Spinner size="1" />
        <Text size="1" color="gray">
          Loading...
        </Text>
      </Flex>
    );
  }

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <MultiFileDiff
      oldFile={{ name: fileName, contents: originalContent ?? "" }}
      newFile={{ name: fileName, contents: modifiedContent ?? "" }}
      options={options}
    />
  );
});
