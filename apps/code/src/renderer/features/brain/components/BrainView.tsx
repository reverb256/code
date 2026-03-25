import { BrainGraph } from "@features/brain/components/BrainGraph";
import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { Brain } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useMemo } from "react";

export function BrainView() {
  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Brain size={12} className="shrink-0 text-gray-10" />
        <Text
          size="1"
          weight="medium"
          className="truncate whitespace-nowrap font-mono text-[12px]"
          title="Brain"
        >
          Brain
        </Text>
      </Flex>
    ),
    [],
  );

  useSetHeaderContent(headerContent);

  return (
    <Box height="100%" width="100%" position="relative">
      <BrainGraph />
    </Box>
  );
}
