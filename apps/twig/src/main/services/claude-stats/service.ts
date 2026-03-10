import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { injectable } from "inversify";
import { logger } from "../../utils/logger.js";
import type { ClaudeStats } from "./schemas.js";

const log = logger.scope("claude-stats");

@injectable()
export class ClaudeStatsService {
  private readonly statsPath = path.join(
    os.homedir(),
    ".claude",
    "stats-cache.json",
  );

  async getStats(): Promise<ClaudeStats | null> {
    try {
      const content = await fs.promises.readFile(this.statsPath, "utf-8");
      return JSON.parse(content) as ClaudeStats;
    } catch (error) {
      log.warn("Failed to read Claude stats", { error });
      return null;
    }
  }
}
