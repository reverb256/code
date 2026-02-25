import { Spinner } from "@phosphor-icons/react";
import { Badge, Box, Code, Flex, ScrollArea, Text } from "@radix-ui/themes";
import type { ProcessEntry } from "@shared/types/process-manager";

interface AgentBashOutputProps {
  process: ProcessEntry;
}

function stripAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export function AgentBashOutput({ process }: AgentBashOutputProps) {
  const output = process.capturedOutput
    ? stripAnsi(process.capturedOutput)
    : "";

  return (
    <Flex direction="column" className="h-full">
      <Box className="shrink-0 border-[var(--gray-a4)] border-b px-3 py-2">
        <Flex align="center" gap="2">
          <Badge size="1" color="blue" variant="soft">
            bash
          </Badge>
          <Code size="1" className="truncate" title={process.command}>
            {process.command}
          </Code>
          {process.status === "running" && (
            <Spinner size={14} className="animate-spin" />
          )}
        </Flex>
      </Box>
      <ScrollArea className="flex-1">
        <Box className="p-3">
          {output ? (
            <pre className="whitespace-pre-wrap break-all font-mono text-[var(--gray-12)] text-xs leading-5">
              {output}
            </pre>
          ) : process.status === "running" ? (
            <Text size="1" color="gray">
              Waiting for output...
            </Text>
          ) : (
            <Text size="1" color="gray">
              No output captured.
            </Text>
          )}
        </Box>
      </ScrollArea>
    </Flex>
  );
}
