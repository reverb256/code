import { AgentMemoryService } from "./service";
import { MemoryType, RelationType } from "./types";

interface SeedOptions {
  dataDir: string;
}

export function seedMemories(options: SeedOptions): AgentMemoryService {
  const svc = new AgentMemoryService({
    dataDir: options.dataDir,
  });

  // ── Identity (6) ───────────────────────────────────────────────────────

  const identity = svc.save({
    content:
      "I am an AI coding agent that helps engineers ship code through PostHog Code",
    memoryType: MemoryType.Identity,
  });

  const identityStack = svc.save({
    content:
      "My primary tech stack is TypeScript, React, Electron and the Claude Agent SDK",
    memoryType: MemoryType.Identity,
  });

  const identityUser = svc.save({
    content:
      "The user prefers concise answers, avoids over-engineering and values working code over abstractions",
    memoryType: MemoryType.Identity,
  });

  const identityRole = svc.save({
    content:
      "I operate as a pair programmer that can run in parallel across multiple worktrees",
    memoryType: MemoryType.Identity,
  });

  const identityContext = svc.save({
    content:
      "I work inside an Electron desktop app and communicate with the main process over tRPC IPC",
    memoryType: MemoryType.Identity,
  });

  const identityStyle = svc.save({
    content:
      "The user writes TypeScript with strict mode, 2-space indent, double quotes and Tailwind for styling",
    memoryType: MemoryType.Identity,
  });

  // ── Goals (6) ──────────────────────────────────────────────────────────

  const goalShipPR = svc.save({
    content:
      "Ship the PR review workflow so agents can review diffs and leave inline comments",
    memoryType: MemoryType.Goal,
    importance: 0.95,
  });

  const goalParallelTasks = svc.save({
    content:
      "Enable parallel task execution with isolated worktrees so multiple agents work concurrently",
    memoryType: MemoryType.Goal,
    importance: 0.9,
  });

  const goalMemorySystem = svc.save({
    content:
      "Build a persistent memory system so agents retain context across sessions",
    memoryType: MemoryType.Goal,
    importance: 0.85,
  });

  const goalBrainView = svc.save({
    content:
      "Visualize the knowledge graph in an interactive brain view with force-directed layout",
    memoryType: MemoryType.Goal,
    importance: 0.8,
  });

  const goalMultiRepo = svc.save({
    content:
      "Support multi-repo workspaces so users can manage related repositories together",
    memoryType: MemoryType.Goal,
    importance: 0.75,
  });

  const goalSessionRestore = svc.save({
    content:
      "Restore agent sessions from persisted logs so work survives app restarts",
    memoryType: MemoryType.Goal,
    importance: 0.7,
  });

  // ── Preferences (8) ───────────────────────────────────────────────────

  const prefBiome = svc.save({
    content: "Use Biome for linting and formatting, not ESLint or Prettier",
    memoryType: MemoryType.Preference,
  });

  const prefNoBarrel = svc.save({
    content: "No barrel files (index.ts). Import directly from source modules",
    memoryType: MemoryType.Preference,
  });

  const _prefLogger = svc.save({
    content: "Use a scoped logger instead of console.log for all output",
    memoryType: MemoryType.Preference,
  });

  const prefSimple = svc.save({
    content: "Prefer simple over clever. Write the obvious solution first",
    memoryType: MemoryType.Preference,
  });

  const prefPnpm = svc.save({
    content: "Use pnpm for package management with turbo for the monorepo",
    memoryType: MemoryType.Preference,
  });

  const prefPathAliases = svc.save({
    content:
      "Use path aliases (@features/*, @components/*, @stores/*) in renderer code instead of relative imports",
    memoryType: MemoryType.Preference,
  });

  const prefAtomicCommits = svc.save({
    content:
      "One logical change per commit. Split if addressing different concerns",
    memoryType: MemoryType.Preference,
  });

  const prefZod = svc.save({
    content:
      "Validate external data with Zod schemas instead of manual type guards",
    memoryType: MemoryType.Preference,
  });

  // ── Facts (12) ─────────────────────────────────────────────────────────

  const factMonorepo = svc.save({
    content:
      "The repo is a pnpm monorepo with apps/code (Electron), apps/cli, packages/agent, packages/core and packages/shared",
    memoryType: MemoryType.Fact,
  });

  const factDrizzle = svc.save({
    content:
      "The Electron app uses Drizzle ORM with better-sqlite3 for workspace data (repositories, workspaces, worktrees)",
    memoryType: MemoryType.Fact,
  });

  const factMemoryDb = svc.save({
    content:
      "The memory system uses raw better-sqlite3 with FTS5 for full-text search, stored in knowledge.db",
    memoryType: MemoryType.Fact,
  });

  const factFts = svc.save({
    content:
      "FTS5 provides full-text search via virtual tables with content-sync triggers for automatic index updates",
    memoryType: MemoryType.Fact,
  });

  const factDI = svc.save({
    content:
      "Main process uses InversifyJS for dependency injection with tokens defined in src/main/di/",
    memoryType: MemoryType.Fact,
  });

  const factTRPC = svc.save({
    content:
      "IPC between main and renderer uses tRPC over Electron IPC via @posthog/electron-trpc",
    memoryType: MemoryType.Fact,
  });

  const factClaudeSDK = svc.save({
    content:
      "The agent package wraps @anthropic-ai/claude-agent-sdk and communicates via ACP protocol",
    memoryType: MemoryType.Fact,
  });

  const factZustand = svc.save({
    content:
      "Renderer state lives in Zustand stores with thin actions that call tRPC mutations",
    memoryType: MemoryType.Fact,
  });

  const factWorktrees = svc.save({
    content:
      "Agent isolation uses jj-managed worktrees so multiple agents can operate on the same repo concurrently",
    memoryType: MemoryType.Fact,
  });

  const factSigma = svc.save({
    content:
      "Brain graph uses Sigma.js with Graphology for GPU-accelerated graph rendering and ForceAtlas2 layout",
    memoryType: MemoryType.Fact,
  });

  const factShared = svc.save({
    content:
      "packages/shared is a zero-dependency utility package with Saga pattern for atomic multi-step operations",
    memoryType: MemoryType.Fact,
  });

  const factSessionLogs = svc.save({
    content:
      "Agent sessions are persisted as JSONL logs that can be hydrated back into a running session",
    memoryType: MemoryType.Fact,
  });

  // ── Decisions (6) ─────────────────────────────────────────────────────

  const decisionRawSqlite = svc.save({
    content:
      "Chose raw better-sqlite3 over Drizzle for memory because graph operations are simpler without ORM overhead",
    memoryType: MemoryType.Decision,
  });

  const decisionWorktrees = svc.save({
    content:
      "Use jj-managed worktrees for agent isolation instead of raw git worktrees for safer concurrent access",
    memoryType: MemoryType.Decision,
  });

  const decisionRepoService = svc.save({
    content:
      "Split memory storage into Repository (data access) and Service (dedup, decay, prune, merge)",
    memoryType: MemoryType.Decision,
  });

  const decisionTRPCSubs = svc.save({
    content:
      "Stream real-time data from main to renderer via tRPC subscriptions instead of polling",
    memoryType: MemoryType.Decision,
  });

  const decisionSigma = svc.save({
    content:
      "Chose Sigma.js + Graphology over D3 force simulation for brain graph because WebGL handles larger graphs",
    memoryType: MemoryType.Decision,
  });

  const decisionCap4 = svc.save({
    content:
      "Cap parallel agents at 4 per workspace to avoid saturating CPU and file descriptor limits",
    memoryType: MemoryType.Decision,
  });

  // ── Events (6) ────────────────────────────────────────────────────────

  const eventMemoryLanded = svc.save({
    content:
      "Memory module landed with types, repository, service and passing tests",
    memoryType: MemoryType.Event,
  });

  const eventFTS5Fix = svc.save({
    content:
      "FTS5 content-sync triggers fixed to use delete-then-update pattern for merge operations",
    memoryType: MemoryType.Event,
    importance: 0.6,
  });

  const eventWorktreeShipped = svc.save({
    content:
      "Worktree manager shipped with jj integration for parallel agent execution",
    memoryType: MemoryType.Event,
    importance: 0.6,
  });

  const eventBrainMVP = svc.save({
    content:
      "Brain graph view shipped with interactive node selection and hover fading",
    memoryType: MemoryType.Event,
    importance: 0.5,
  });

  const eventSessionRehydrate = svc.save({
    content: "JSONL session hydration working end-to-end with tool call replay",
    memoryType: MemoryType.Event,
    importance: 0.5,
  });

  const eventPRReviewAlpha = svc.save({
    content:
      "PR review agent alpha tested internally with inline diff comments on real PRs",
    memoryType: MemoryType.Event,
    importance: 0.6,
  });

  // ── Observations (6) ──────────────────────────────────────────────────

  const obsNativeModules = svc.save({
    content:
      "better-sqlite3 native module version can mismatch between Electron Node and system Node. Rebuild with node-gyp when switching",
    memoryType: MemoryType.Observation,
  });

  const obsAgentPermissions = svc.save({
    content:
      "Agent failures cluster around file permission errors in worktrees when the parent repo has restrictive umask settings",
    memoryType: MemoryType.Observation,
  });

  const obsFtsTriggers = svc.save({
    content:
      "FTS5 content-sync triggers automatically keep the search index in sync with the memories table on insert, update and delete",
    memoryType: MemoryType.Observation,
  });

  const obsAbortOrder = svc.save({
    content:
      "When tearing down async ops with AbortController, abort the controller before awaiting cleanup to avoid deadlocks",
    memoryType: MemoryType.Observation,
  });

  const obsStorageLimit = svc.save({
    content:
      "Session data exceeds localStorage 5MB limit after long-running agents. IndexedDB migration needed",
    memoryType: MemoryType.Observation,
  });

  const obsPRLatency = svc.save({
    content:
      "PR reviews take 3x longer without inline diff context because the agent re-reads the entire file each time",
    memoryType: MemoryType.Observation,
  });

  // ── Todos (8) ─────────────────────────────────────────────────────────

  const todoBrainWire = svc.save({
    content: "Wire brain graph view to real memory data via tRPC subscriptions",
    memoryType: MemoryType.Todo,
  });

  const todoHybridSearch = svc.save({
    content:
      "Build hybrid search combining FTS5 text search and graph traversal with RRF merging",
    memoryType: MemoryType.Todo,
  });

  const todoBulletin = svc.save({
    content:
      "Build memory bulletin system that injects relevant context into agent system prompt at session start",
    memoryType: MemoryType.Todo,
  });

  const todoMaintenance = svc.save({
    content: "Schedule periodic decay and prune passes for memory maintenance",
    memoryType: MemoryType.Todo,
  });

  const todoMultiRepoUI = svc.save({
    content:
      "Build repo picker component for adding multiple repositories to a workspace",
    memoryType: MemoryType.Todo,
  });

  const todoSessionMigrate = svc.save({
    content:
      "Migrate session store from localStorage to IndexedDB to handle large agent sessions",
    memoryType: MemoryType.Todo,
  });

  const todoPRComments = svc.save({
    content:
      "Implement inline comment rendering in the diff view with threaded replies",
    memoryType: MemoryType.Todo,
  });

  const todoAgentMetrics = svc.save({
    content:
      "Add agent execution metrics (token usage, duration, tool call counts) to the task detail panel",
    memoryType: MemoryType.Todo,
  });

  // ── Associations ───────────────────────────────────────────────────────

  // Identity cluster
  svc.link(identity.id, {
    targetId: identityStack.id,
    relationType: RelationType.RelatedTo,
    weight: 0.9,
  });

  svc.link(identity.id, {
    targetId: identityUser.id,
    relationType: RelationType.RelatedTo,
    weight: 0.8,
  });

  svc.link(identity.id, {
    targetId: identityRole.id,
    relationType: RelationType.RelatedTo,
    weight: 0.85,
  });

  svc.link(identityRole.id, {
    targetId: identityContext.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(identityUser.id, {
    targetId: identityStyle.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(factClaudeSDK.id, {
    targetId: identity.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  // Goal hierarchy (todo --part_of--> goal, decision --result_of--> goal)
  svc.link(todoPRComments.id, {
    targetId: goalShipPR.id,
    relationType: RelationType.PartOf,
    weight: 0.8,
  });

  svc.link(goalShipPR.id, {
    targetId: obsPRLatency.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(decisionWorktrees.id, {
    targetId: goalParallelTasks.id,
    relationType: RelationType.ResultOf,
    weight: 0.9,
  });

  svc.link(decisionCap4.id, {
    targetId: goalParallelTasks.id,
    relationType: RelationType.ResultOf,
    weight: 0.7,
  });

  svc.link(todoHybridSearch.id, {
    targetId: goalMemorySystem.id,
    relationType: RelationType.PartOf,
    weight: 0.8,
  });

  svc.link(todoBulletin.id, {
    targetId: goalMemorySystem.id,
    relationType: RelationType.PartOf,
    weight: 0.7,
  });

  svc.link(todoMaintenance.id, {
    targetId: goalMemorySystem.id,
    relationType: RelationType.PartOf,
    weight: 0.7,
  });

  svc.link(todoBrainWire.id, {
    targetId: goalBrainView.id,
    relationType: RelationType.PartOf,
    weight: 0.9,
  });

  svc.link(decisionSigma.id, {
    targetId: goalBrainView.id,
    relationType: RelationType.ResultOf,
    weight: 0.8,
  });

  svc.link(todoMultiRepoUI.id, {
    targetId: goalMultiRepo.id,
    relationType: RelationType.PartOf,
    weight: 0.8,
  });

  svc.link(todoSessionMigrate.id, {
    targetId: goalSessionRestore.id,
    relationType: RelationType.PartOf,
    weight: 0.7,
  });

  svc.link(goalSessionRestore.id, {
    targetId: factSessionLogs.id,
    relationType: RelationType.RelatedTo,
    weight: 0.8,
  });

  // Monorepo fact cluster
  svc.link(factMonorepo.id, {
    targetId: factDrizzle.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(factMonorepo.id, {
    targetId: factDI.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(factMonorepo.id, {
    targetId: factTRPC.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(factMonorepo.id, {
    targetId: factShared.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  // Memory DB cluster
  svc.link(factDrizzle.id, {
    targetId: factMemoryDb.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(factMemoryDb.id, {
    targetId: factFts.id,
    relationType: RelationType.RelatedTo,
    weight: 0.8,
  });

  svc.link(factMemoryDb.id, {
    targetId: decisionRawSqlite.id,
    relationType: RelationType.ResultOf,
    weight: 0.9,
  });

  // Renderer facts
  svc.link(factZustand.id, {
    targetId: factTRPC.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(factSigma.id, {
    targetId: decisionSigma.id,
    relationType: RelationType.ResultOf,
    weight: 0.9,
  });

  svc.link(factWorktrees.id, {
    targetId: decisionWorktrees.id,
    relationType: RelationType.ResultOf,
    weight: 0.9,
  });

  svc.link(factSessionLogs.id, {
    targetId: eventSessionRehydrate.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  // Decision links
  svc.link(decisionRawSqlite.id, {
    targetId: factDrizzle.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(decisionRepoService.id, {
    targetId: decisionRawSqlite.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(decisionWorktrees.id, {
    targetId: eventWorktreeShipped.id,
    relationType: RelationType.ResultOf,
    weight: 0.8,
  });

  svc.link(decisionTRPCSubs.id, {
    targetId: factTRPC.id,
    relationType: RelationType.RelatedTo,
    weight: 0.8,
  });

  svc.link(decisionCap4.id, {
    targetId: factWorktrees.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  // Event links
  svc.link(eventMemoryLanded.id, {
    targetId: goalMemorySystem.id,
    relationType: RelationType.ResultOf,
    weight: 0.9,
  });

  svc.link(eventMemoryLanded.id, {
    targetId: decisionRepoService.id,
    relationType: RelationType.ResultOf,
    weight: 0.7,
  });

  svc.link(eventFTS5Fix.id, {
    targetId: factFts.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(eventBrainMVP.id, {
    targetId: goalBrainView.id,
    relationType: RelationType.ResultOf,
    weight: 0.8,
  });

  svc.link(eventBrainMVP.id, {
    targetId: factSigma.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(eventPRReviewAlpha.id, {
    targetId: goalShipPR.id,
    relationType: RelationType.ResultOf,
    weight: 0.8,
  });

  svc.link(eventSessionRehydrate.id, {
    targetId: goalSessionRestore.id,
    relationType: RelationType.ResultOf,
    weight: 0.7,
  });

  // Observation links
  svc.link(obsNativeModules.id, {
    targetId: factMemoryDb.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(obsAgentPermissions.id, {
    targetId: decisionWorktrees.id,
    relationType: RelationType.RelatedTo,
    weight: 0.6,
  });

  svc.link(obsFtsTriggers.id, {
    targetId: factFts.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(obsAbortOrder.id, {
    targetId: decisionTRPCSubs.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(obsStorageLimit.id, {
    targetId: todoSessionMigrate.id,
    relationType: RelationType.CausedBy,
    weight: 0.9,
  });

  svc.link(obsPRLatency.id, {
    targetId: todoPRComments.id,
    relationType: RelationType.CausedBy,
    weight: 0.7,
  });

  // Preference links
  svc.link(prefBiome.id, {
    targetId: prefNoBarrel.id,
    relationType: RelationType.RelatedTo,
    weight: 0.4,
  });

  svc.link(prefPnpm.id, {
    targetId: factMonorepo.id,
    relationType: RelationType.RelatedTo,
    weight: 0.7,
  });

  svc.link(prefSimple.id, {
    targetId: decisionRawSqlite.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(prefPathAliases.id, {
    targetId: factZustand.id,
    relationType: RelationType.RelatedTo,
    weight: 0.4,
  });

  svc.link(prefAtomicCommits.id, {
    targetId: prefSimple.id,
    relationType: RelationType.RelatedTo,
    weight: 0.5,
  });

  svc.link(prefZod.id, {
    targetId: factTRPC.id,
    relationType: RelationType.RelatedTo,
    weight: 0.4,
  });

  // Todo cross-links
  svc.link(todoAgentMetrics.id, {
    targetId: goalParallelTasks.id,
    relationType: RelationType.PartOf,
    weight: 0.5,
  });

  return svc;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  const dataDir = process.argv[2] ?? "./memory-seed-data";
  const svc = seedMemories({ dataDir });
  const count = svc.count();
  svc.close();
  process.stdout.write(
    `Seeded ${count} memories into ${dataDir}/knowledge.db\n`,
  );
}
