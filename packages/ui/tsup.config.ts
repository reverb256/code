import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/conversation/buildConversationItems.ts",
    "src/types/session-events.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "react-markdown",
    "remark-gfm",
    "remark-breaks",
    "@radix-ui/themes",
    "@phosphor-icons/react",
    "@agentclientprotocol/sdk",
  ],
});
