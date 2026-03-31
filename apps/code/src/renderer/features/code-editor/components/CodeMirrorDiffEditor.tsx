import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { Columns, Rows } from "@phosphor-icons/react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useMemo } from "react";
import { useCodeMirror } from "../hooks/useCodeMirror";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { useDiffViewerStore } from "../stores/diffViewerStore";
import { DiffSettingsMenu } from "./DiffSettingsMenu";

interface CodeMirrorDiffEditorProps {
  originalContent: string;
  modifiedContent: string;
  filePath?: string;
  relativePath?: string;
  onContentChange?: (content: string) => void;
  onRefresh?: () => void;
  hideToolbar?: boolean;
}

export function CodeMirrorDiffEditor({
  originalContent,
  modifiedContent,
  filePath,
  relativePath,
  onContentChange,
  onRefresh,
  hideToolbar,
}: CodeMirrorDiffEditorProps) {
  const viewMode = useDiffViewerStore((s) => s.viewMode);
  const toggleViewMode = useDiffViewerStore((s) => s.toggleViewMode);
  const loadFullFiles = useDiffViewerStore((s) => s.loadFullFiles);
  const wordDiffs = useDiffViewerStore((s) => s.wordDiffs);
  const hideWhitespaceChanges = useDiffViewerStore(
    (s) => s.hideWhitespaceChanges,
  );
  const extensions = useEditorExtensions(filePath, true, true);
  const options = useMemo(
    () => ({
      original: originalContent,
      modified: modifiedContent,
      extensions,
      mode: viewMode,
      loadFullFiles,
      wordDiffs,
      hideWhitespaceChanges,
      filePath,
      onContentChange,
    }),
    [
      originalContent,
      modifiedContent,
      extensions,
      viewMode,
      loadFullFiles,
      wordDiffs,
      hideWhitespaceChanges,
      filePath,
      onContentChange,
    ],
  );
  const { containerRef, instanceRef } = useCodeMirror(options);

  // Capture Cmd+F / Ctrl+F globally and open CodeMirror search when diff is mounted
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "f") return;

      const instance = instanceRef.current;
      if (!instance) return;

      e.preventDefault();
      e.stopPropagation();
      const editorView = instance instanceof EditorView ? instance : instance.b;
      openSearchPanel(editorView);
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [instanceRef]);

  if (hideToolbar) {
    return <div ref={containerRef} style={{ width: "100%" }} />;
  }

  return (
    <Flex direction="column" height="100%">
      <Flex
        px="3"
        py="2"
        align="center"
        justify="between"
        style={{ borderBottom: "1px solid var(--gray-6)", flexShrink: 0 }}
      >
        {relativePath ? (
          <Text
            size="1"
            color="gray"
            style={{ fontFamily: "var(--code-font-family)" }}
          >
            {relativePath}
          </Text>
        ) : (
          <span />
        )}
        <Flex align="center" gap="1">
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
          <DiffSettingsMenu onRefresh={onRefresh} />
        </Flex>
      </Flex>
      <Box style={{ flex: 1, overflow: "auto" }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      </Box>
    </Flex>
  );
}
