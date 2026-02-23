import { Box } from "@radix-ui/themes";
import { memo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface UserMessageProps {
  content: string;
}

export const UserMessage = memo(function UserMessage({
  content,
}: UserMessageProps) {
  const cleanContent = content.replace(/<file\s+path="([^"]+)"\s*\/>/g, "`$1`");

  return (
    <Box
      className="relative border-l-2 py-2 pl-3"
      style={{
        borderColor: "var(--accent-9)",
        backgroundColor: "var(--gray-2)",
      }}
    >
      <Box className="font-medium [&>*:last-child]:mb-0">
        <MarkdownRenderer content={cleanContent} />
      </Box>
    </Box>
  );
});
