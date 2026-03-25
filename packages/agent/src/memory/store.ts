/**
 * SQLite-backed memory store.
 *
 * Provides CRUD operations on memories and associations, full-text search
 * via FTS5, and scored retrieval combining relevance, importance, recency,
 * and access frequency.
 */

import { randomUUID } from "node:crypto";
// better-sqlite3 is a CJS module; use createRequire for ESM compat
import { createRequire } from "node:module";
import { Logger } from "../utils/logger";
import type {
  Association,
  Memory,
  MemoryType,
  RecallOptions,
  RelationType,
  ScoredMemory,
} from "./types";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

// ── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_accessed_at TEXT DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 0,
  source TEXT,
  forgotten INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_forgotten ON memories(forgotten);

CREATE TABLE IF NOT EXISTS associations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  weight REAL DEFAULT 0.5,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE,
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_associations_source ON associations(source_id);
CREATE INDEX IF NOT EXISTS idx_associations_target ON associations(target_id);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  memory_id UNINDEXED,
  content,
  tokenize='porter unicode61'
);
`;

// ── Row Mappings ────────────────────────────────────────────────────────────

interface MemoryRow {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  access_count: number;
  source: string | null;
  forgotten: number;
}

interface AssociationRow {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  created_at: string;
}

interface FtsMatchRow extends MemoryRow {
  rank: number;
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    content: row.content,
    memoryType: row.memory_type as MemoryType,
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
    source: row.source,
    forgotten: row.forgotten === 1,
  };
}

function rowToAssociation(row: AssociationRow): Association {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    relationType: row.relation_type as RelationType,
    weight: row.weight,
    createdAt: row.created_at,
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  relevance: 0.4,
  importance: 0.3,
  recency: 0.2,
  frequency: 0.1,
};

/** Decay: 1.0 for today, approaches 0 over ~30 days */
function recencyScore(lastAccessedAt: string): number {
  const ageMs = Date.now() - new Date(lastAccessedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / 15); // half-life ~10 days
}

/** Normalize access count using log scale */
function frequencyScore(accessCount: number): number {
  return Math.min(1, Math.log2(accessCount + 1) / 5);
}

function computeScore(memory: Memory, ftsRank?: number): number {
  // FTS rank: lower (more negative) = better match. Normalize to 0–1.
  // When there's no FTS query, relevance defaults to 0.5.
  const relevance =
    ftsRank !== undefined ? Math.min(1, 1 / (1 + Math.abs(ftsRank))) : 0.5;

  return (
    relevance * SCORE_WEIGHTS.relevance +
    memory.importance * SCORE_WEIGHTS.importance +
    recencyScore(memory.lastAccessedAt) * SCORE_WEIGHTS.recency +
    frequencyScore(memory.accessCount) * SCORE_WEIGHTS.frequency
  );
}

// ── Store ───────────────────────────────────────────────────────────────────

export class MemoryStore {
  private db: import("better-sqlite3").Database;
  private logger: Logger;

  constructor(dbPath: string, logger?: Logger) {
    this.logger =
      logger ?? new Logger({ debug: true, prefix: "[MemoryStore]" });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
    this.logger.debug("Database opened", { dbPath });
  }

  // ── Memories CRUD ───────────────────────────────────────────────────────

  insert(
    memory: Omit<
      Memory,
      "createdAt" | "updatedAt" | "lastAccessedAt" | "accessCount" | "forgotten"
    >,
  ): Memory {
    const id = memory.id || randomUUID();
    const now = new Date().toISOString();

    const insertMemory = this.db.prepare(`
      INSERT INTO memories (id, content, memory_type, importance, source, created_at, updated_at, last_accessed_at, access_count, forgotten)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);

    const insertFts = this.db.prepare(`
      INSERT INTO memories_fts (memory_id, content) VALUES (?, ?)
    `);

    const run = this.db.transaction(() => {
      insertMemory.run(
        id,
        memory.content,
        memory.memoryType,
        memory.importance,
        memory.source ?? null,
        now,
        now,
        now,
      );
      insertFts.run(id, memory.content);
    });
    run();

    this.logger.debug("INSERT memory", {
      id,
      type: memory.memoryType,
      importance: memory.importance,
      source: memory.source,
      content: memory.content.slice(0, 100),
    });

    return {
      id,
      content: memory.content,
      memoryType: memory.memoryType,
      importance: memory.importance,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      source: memory.source ?? null,
      forgotten: false,
    };
  }

  get(id: string): Memory | null {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get(id) as MemoryRow | undefined;
    this.logger.debug("GET memory", { id, found: !!row });
    return row ? rowToMemory(row) : null;
  }

  update(
    id: string,
    updates: Partial<
      Pick<Memory, "content" | "importance" | "memoryType" | "forgotten">
    >,
  ): void {
    const now = new Date().toISOString();
    const sets: string[] = ["updated_at = ?"];
    const params: unknown[] = [now];

    if (updates.content !== undefined) {
      sets.push("content = ?");
      params.push(updates.content);
    }
    if (updates.importance !== undefined) {
      sets.push("importance = ?");
      params.push(updates.importance);
    }
    if (updates.memoryType !== undefined) {
      sets.push("memory_type = ?");
      params.push(updates.memoryType);
    }
    if (updates.forgotten !== undefined) {
      sets.push("forgotten = ?");
      params.push(updates.forgotten ? 1 : 0);
    }

    params.push(id);

    const updateMemory = this.db.prepare(
      `UPDATE memories SET ${sets.join(", ")} WHERE id = ?`,
    );

    const run = this.db.transaction(() => {
      updateMemory.run(...params);

      // Sync FTS if content changed
      if (updates.content !== undefined) {
        this.db.prepare("DELETE FROM memories_fts WHERE memory_id = ?").run(id);
        this.db
          .prepare(
            "INSERT INTO memories_fts (memory_id, content) VALUES (?, ?)",
          )
          .run(id, updates.content);
      }
    });
    run();

    this.logger.debug("UPDATE memory", { id, fields: Object.keys(updates) });
  }

  forget(id: string): void {
    this.logger.debug("FORGET memory", { id });
    this.update(id, { forgotten: true });
  }

  markAccessed(id: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
      UPDATE memories SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?
    `)
      .run(now, id);
  }

  delete(id: string): void {
    this.logger.debug("DELETE memory", { id });
    const run = this.db.transaction(() => {
      this.db.prepare("DELETE FROM memories_fts WHERE memory_id = ?").run(id);
      this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    });
    run();
  }

  // ── Search & Recall ─────────────────────────────────────────────────────

  /**
   * Search memories using FTS5 full-text search, scored and ranked.
   * Returns memories ordered by composite score (relevance + importance + recency + frequency).
   */
  search(options: RecallOptions = {}): ScoredMemory[] {
    const {
      query,
      memoryTypes,
      limit = 20,
      minImportance = 0,
      includeForgotten = false,
    } = options;

    let rows: Array<MemoryRow & { rank?: number }>;

    if (query) {
      // FTS search with BM25 ranking
      const conditions: string[] = ["m.importance >= ?"];
      const params: unknown[] = [minImportance];

      if (!includeForgotten) {
        conditions.push("m.forgotten = 0");
      }
      if (memoryTypes && memoryTypes.length > 0) {
        conditions.push(
          `m.memory_type IN (${memoryTypes.map(() => "?").join(", ")})`,
        );
        params.push(...memoryTypes);
      }

      const whereClause =
        conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

      // Escape FTS5 special characters for safe querying
      const safeQuery = query
        .replace(/['"(){}[\]:^~*!@#$%&+=|\\/<>,-]/g, " ")
        .trim();
      if (!safeQuery) {
        return [];
      }

      rows = this.db
        .prepare(`
        SELECT m.*, fts.rank
        FROM memories_fts fts
        JOIN memories m ON m.id = fts.memory_id
        WHERE memories_fts MATCH ?
        ${whereClause}
        ORDER BY fts.rank
        LIMIT ?
      `)
        .all(safeQuery, ...params, limit) as Array<FtsMatchRow>;
    } else {
      // No query — return by importance/recency
      const conditions: string[] = ["importance >= ?"];
      const params: unknown[] = [minImportance];

      if (!includeForgotten) {
        conditions.push("forgotten = 0");
      }
      if (memoryTypes && memoryTypes.length > 0) {
        conditions.push(
          `memory_type IN (${memoryTypes.map(() => "?").join(", ")})`,
        );
        params.push(...memoryTypes);
      }

      rows = this.db
        .prepare(`
        SELECT * FROM memories
        WHERE ${conditions.join(" AND ")}
        ORDER BY importance DESC, last_accessed_at DESC
        LIMIT ?
      `)
        .all(...params, limit) as MemoryRow[];
    }

    // Score and sort
    const scored: ScoredMemory[] = rows.map((row) => {
      const memory = rowToMemory(row);
      const ftsRank = "rank" in row ? (row.rank as number) : undefined;
      return {
        ...memory,
        score: computeScore(memory, ftsRank),
        ftsRank,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    // Mark as accessed
    for (const m of scored) {
      this.markAccessed(m.id);
    }

    this.logger.debug("SEARCH memories", {
      query: query?.slice(0, 60),
      types: memoryTypes,
      results: scored.length,
      topScore: scored[0]?.score?.toFixed(3),
    });

    return scored;
  }

  /**
   * Retrieve memories within a token budget, ordered by score.
   * Stops adding memories once the budget is exhausted.
   */
  recallWithinBudget(
    options: RecallOptions & { tokenBudget: number },
  ): ScoredMemory[] {
    const allScored = this.search({ ...options, limit: options.limit ?? 50 });
    const result: ScoredMemory[] = [];
    let usedChars = 0;
    const charBudget = options.tokenBudget * 4; // ~4 chars per token

    for (const memory of allScored) {
      const memoryChars = memory.content.length + 30; // overhead for formatting
      if (usedChars + memoryChars > charBudget) break;
      result.push(memory);
      usedChars += memoryChars;
    }

    this.logger.debug("RECALL within budget", {
      tokenBudget: options.tokenBudget,
      candidateCount: allScored.length,
      selectedCount: result.length,
      usedChars,
    });

    return result;
  }

  /**
   * Find memories with similar content to detect duplicates.
   */
  findSimilar(content: string, limit = 5): ScoredMemory[] {
    // Extract key terms for FTS matching
    const terms = content
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 8)
      .join(" ");

    if (!terms) return [];

    return this.search({ query: terms, limit });
  }

  // ── Associations ────────────────────────────────────────────────────────

  addAssociation(
    sourceId: string,
    targetId: string,
    relationType: RelationType,
    weight = 0.5,
  ): Association {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(`
      INSERT OR REPLACE INTO associations (id, source_id, target_id, relation_type, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .run(id, sourceId, targetId, relationType, weight, now);

    this.logger.debug("ADD association", {
      sourceId: sourceId.slice(0, 8),
      targetId: targetId.slice(0, 8),
      relationType,
      weight,
    });

    return { id, sourceId, targetId, relationType, weight, createdAt: now };
  }

  getAssociations(memoryId: string): Association[] {
    const rows = this.db
      .prepare(`
      SELECT * FROM associations WHERE source_id = ? OR target_id = ?
    `)
      .all(memoryId, memoryId) as AssociationRow[];

    return rows.map(rowToAssociation);
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  stats(): {
    total: number;
    active: number;
    forgotten: number;
    byType: Record<string, number>;
  } {
    const total = (
      this.db.prepare("SELECT COUNT(*) as count FROM memories").get() as {
        count: number;
      }
    ).count;
    const active = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM memories WHERE forgotten = 0")
        .get() as { count: number }
    ).count;
    const forgotten = total - active;

    const typeRows = this.db
      .prepare(
        "SELECT memory_type, COUNT(*) as count FROM memories WHERE forgotten = 0 GROUP BY memory_type",
      )
      .all() as Array<{ memory_type: string; count: number }>;

    const byType: Record<string, number> = {};
    for (const row of typeRows) {
      byType[row.memory_type] = row.count;
    }

    return { total, active, forgotten, byType };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
