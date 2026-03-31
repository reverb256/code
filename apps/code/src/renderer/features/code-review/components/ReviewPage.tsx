import { useGitQueries } from "@features/git-interaction/hooks/useGitQueries";
import { useCwd } from "@features/sidebar/hooks/useCwd";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { Task } from "@shared/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReviewStore } from "../stores/reviewStore";
import { ReviewFileDiff } from "./ReviewFileDiff";
import { ReviewFileHeader } from "./ReviewFileHeader";
import { ReviewToolbar } from "./ReviewToolbar";

interface ReviewPageProps {
  taskId: string;
  task: Task;
}

const COLLAPSE_THRESHOLD = 20;

export function ReviewPage({ taskId }: ReviewPageProps) {
  const repoPath = useCwd(taskId);
  const { changedFiles, changesLoading } = useGitQueries(repoPath);

  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => {
    if (changedFiles.length > COLLAPSE_THRESHOLD) {
      return new Set(changedFiles.map((f) => f.path));
    }
    return new Set();
  });

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Subscribe to scroll target without causing re-renders.
  // Only re-renders if the file was collapsed and needs expanding.
  useEffect(() => {
    return useReviewStore.subscribe((state, prev) => {
      if (!state.scrollTarget || state.scrollTarget === prev.scrollTarget)
        return;

      const target = state.scrollTarget;
      useReviewStore.getState().setScrollTarget(null);

      // Expand if collapsed — this is the only thing that triggers a re-render
      setCollapsedFiles((prev) => {
        if (prev.has(target)) {
          const next = new Set(prev);
          next.delete(target);
          return next;
        }
        return prev;
      });

      requestAnimationFrame(() => {
        const el = fileRefs.current.get(target);
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      });
    });
  }, []);

  const toggleFile = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedFiles(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedFiles(new Set(changedFiles.map((f) => f.path)));
  }, [changedFiles]);

  const allExpanded = collapsedFiles.size === 0;

  const setFileRef = useCallback(
    (filePath: string) => (el: HTMLDivElement | null) => {
      if (el) {
        fileRefs.current.set(filePath, el);
      } else {
        fileRefs.current.delete(filePath);
      }
    },
    [],
  );

  const { linesAdded, linesRemoved } = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const file of changedFiles) {
      added += file.linesAdded ?? 0;
      removed += file.linesRemoved ?? 0;
    }
    return { linesAdded: added, linesRemoved: removed };
  }, [changedFiles]);

  if (!repoPath) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text size="2" color="gray">
          No repository path available
        </Text>
      </Flex>
    );
  }

  if (changesLoading) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text size="2" color="gray">
          Loading changes...
        </Text>
      </Flex>
    );
  }

  if (changedFiles.length === 0) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text size="2" color="gray">
          No file changes to review
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%">
      <ReviewToolbar
        fileCount={changedFiles.length}
        linesAdded={linesAdded}
        linesRemoved={linesRemoved}
        allExpanded={allExpanded}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
      <Box style={{ flex: 1, overflowY: "auto" }}>
        {changedFiles.map((file) => {
          const isExpanded = !collapsedFiles.has(file.path);

          return (
            <Box key={file.path} ref={setFileRef(file.path)}>
              <ReviewFileHeader
                file={file}
                isExpanded={isExpanded}
                onToggle={toggleFile}
              />
              {isExpanded && (
                <ReviewFileDiff
                  filePath={file.path}
                  repoPath={repoPath}
                  status={file.status}
                  originalPath={file.originalPath}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Flex>
  );
}
