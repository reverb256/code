import { z } from "zod";

const modelUsageEntry = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cacheReadInputTokens: z.number().default(0),
  cacheCreationInputTokens: z.number().default(0),
  webSearchRequests: z.number().default(0),
  costUSD: z.number().default(0),
  contextWindow: z.number().default(0),
  maxOutputTokens: z.number().default(0),
});

const dailyActivity = z.object({
  date: z.string(),
  messageCount: z.number(),
  sessionCount: z.number(),
  toolCallCount: z.number(),
});

const dailyModelTokens = z.object({
  date: z.string(),
  tokensByModel: z.record(z.string(), z.number()),
});

const longestSession = z.object({
  sessionId: z.string(),
  duration: z.number(),
  messageCount: z.number(),
  timestamp: z.string(),
});

export const claudeStatsSchema = z.object({
  version: z.number(),
  lastComputedDate: z.string(),
  dailyActivity: z.array(dailyActivity),
  dailyModelTokens: z.array(dailyModelTokens),
  modelUsage: z.record(z.string(), modelUsageEntry),
  totalSessions: z.number(),
  totalMessages: z.number(),
  longestSession: longestSession.optional(),
  firstSessionDate: z.string(),
  hourCounts: z.record(z.string(), z.number()),
});

export const claudeStatsOutput = claudeStatsSchema.nullable();

export type ClaudeStats = z.infer<typeof claudeStatsSchema>;
