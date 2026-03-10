import { container } from "../../di/container.js";
import { MAIN_TOKENS } from "../../di/tokens.js";
import { claudeStatsOutput } from "../../services/claude-stats/schemas.js";
import type { ClaudeStatsService } from "../../services/claude-stats/service.js";
import { publicProcedure, router } from "../trpc.js";

const getService = () =>
  container.get<ClaudeStatsService>(MAIN_TOKENS.ClaudeStatsService);

export const claudeStatsRouter = router({
  getStats: publicProcedure
    .output(claudeStatsOutput)
    .query(() => getService().getStats()),
});
