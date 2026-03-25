import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import posthog from "@posthog/rollup-plugin";
import type { Alias, Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createPosthogPlugin(
  env: Record<string, string>,
  project: string,
): Plugin | null {
  if (!env.POSTHOG_SOURCEMAP_API_KEY || !env.POSTHOG_ENV_ID) {
    return null;
  }
  return posthog({
    personalApiKey: env.POSTHOG_SOURCEMAP_API_KEY,
    envId: env.POSTHOG_ENV_ID,
    host: env.POSTHOG_HOST,
    sourcemaps: {
      project,
      deleteAfterUpload: true,
    },
  });
}

export function createForceDevModeDefine(): Record<string, string> | undefined {
  if (process.env.FORCE_DEV_MODE !== "1") {
    return undefined;
  }
  return {
    "import.meta.env.DEV": "true",
    "import.meta.env.PROD": "false",
    "import.meta.env.MODE": '"development"',
  };
}

const baseAliases: Alias[] = [
  { find: "@main", replacement: path.resolve(__dirname, "./src/main") },
  { find: "@renderer", replacement: path.resolve(__dirname, "./src/renderer") },
  { find: "@shared", replacement: path.resolve(__dirname, "./src/shared") },
];

const agentPkg = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../packages/agent/package.json"),
    "utf-8",
  ),
);
const agentSrc = path.resolve(__dirname, "../../packages/agent/src");
const agentExportMap = new Map<string, string>();
for (const [key, value] of Object.entries(
  agentPkg.exports as Record<string, { import: string }>,
)) {
  const srcFile = value.import.replace("./dist/", "").replace(/\.js$/, ".ts");
  agentExportMap.set(
    key === "." ? "@posthog/agent" : `@posthog/agent/${key.slice(2)}`,
    srcFile,
  );
}

export function resolveAgentPlugin(): Plugin {
  return {
    name: "resolve-agent-workspace",
    resolveId(source) {
      const mapped = agentExportMap.get(source);
      if (mapped) return path.resolve(agentSrc, mapped);
      return null;
    },
  };
}

const workspaceAliases: Alias[] = [
  {
    find: "@posthog/shared",
    replacement: path.resolve(__dirname, "../../packages/shared/src/index.ts"),
  },
];

export const mainAliases: Alias[] = [
  ...baseAliases,
  {
    find: "@posthog/electron-trpc/main",
    replacement: path.resolve(
      __dirname,
      "../../packages/electron-trpc/src/main/index.ts",
    ),
  },
  ...workspaceAliases,
];

export const rendererAliases: Alias[] = [
  ...baseAliases,
  {
    find: "@features",
    replacement: path.resolve(__dirname, "./src/renderer/features"),
  },
  {
    find: "@components",
    replacement: path.resolve(__dirname, "./src/renderer/components"),
  },
  {
    find: "@stores",
    replacement: path.resolve(__dirname, "./src/renderer/stores"),
  },
  {
    find: "@hooks",
    replacement: path.resolve(__dirname, "./src/renderer/hooks"),
  },
  {
    find: "@utils",
    replacement: path.resolve(__dirname, "./src/renderer/utils"),
  },
  {
    find: "@posthog/electron-trpc/renderer",
    replacement: path.resolve(
      __dirname,
      "../../packages/electron-trpc/src/renderer/index.ts",
    ),
  },
  ...workspaceAliases,
];
