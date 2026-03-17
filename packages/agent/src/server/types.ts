import type { AgentMode } from "../types";
import type { RemoteMcpServer } from "./schemas";

export type ToolsPreset = "default" | "research_background_agent";

export interface ClaudeCodeConfig {
  systemPrompt?:
    | string
    | { type: "preset"; preset: "claude_code"; append?: string };
  plugins?: { type: "local"; path: string }[];
}

export interface AgentServerConfig {
  port: number;
  repositoryPath?: string;
  apiUrl: string;
  apiKey: string;
  projectId: number;
  jwtPublicKey: string; // RS256 public key for JWT verification
  mode: AgentMode;
  taskId: string;
  runId: string;
  version?: string;
  mcpServers?: RemoteMcpServer[];
  baseBranch?: string;
  claudeCode?: ClaudeCodeConfig;
  toolsPreset?: ToolsPreset;
}
