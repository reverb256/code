import type { Task } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock queryClient before importing the module under test
vi.mock("@utils/queryClient", () => ({
  queryClient: {
    getQueryData: vi.fn(),
    setQueriesData: vi.fn(),
  },
}));

import { queryClient } from "@utils/queryClient";
import { shouldApplyAutoTitle } from "./shouldApplyAutoTitle";

describe("shouldApplyAutoTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when title_manually_set is false", () => {
    const cachedTasks: Task[] = [
      {
        id: "task-1",
        task_number: 1,
        slug: "task-1",
        title: "Auto title",
        origin_product: "user_created",
        description: "",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
        title_manually_set: false,
      },
    ];

    vi.mocked(queryClient.getQueryData).mockReturnValue(cachedTasks);

    expect(shouldApplyAutoTitle("task-1")).toBe(true);
  });

  it("returns false when title_manually_set is true", () => {
    const cachedTasks: Task[] = [
      {
        id: "task-1",
        task_number: 1,
        slug: "task-1",
        title: "My custom title",
        origin_product: "user_created",
        description: "",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
        title_manually_set: true,
      },
    ];

    vi.mocked(queryClient.getQueryData).mockReturnValue(cachedTasks);

    expect(shouldApplyAutoTitle("task-1")).toBe(false);
  });

  it("returns true when task is not found in cache", () => {
    const cachedTasks: Task[] = [
      {
        id: "task-2",
        task_number: 2,
        slug: "task-2",
        title: "Other task",
        origin_product: "user_created",
        description: "",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
    ];

    vi.mocked(queryClient.getQueryData).mockReturnValue(cachedTasks);

    expect(shouldApplyAutoTitle("task-1")).toBe(true);
  });

  it("returns true when cache is empty", () => {
    vi.mocked(queryClient.getQueryData).mockReturnValue(undefined);

    expect(shouldApplyAutoTitle("task-1")).toBe(true);
  });

  it("detects race condition: user renames during async title generation", async () => {
    const taskId = "task-1";
    const manualTitle = "My custom title";

    // Simulate: at start of generation, title_manually_set is false
    const initialTasks: Task[] = [
      {
        id: taskId,
        task_number: 1,
        slug: "task-1",
        title: "Initial title",
        origin_product: "user_created",
        description: "",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
        title_manually_set: false,
      },
    ];

    // Simulate: after async generation, user has renamed (title_manually_set: true)
    const renamedTasks: Task[] = [
      {
        ...initialTasks[0],
        title: manualTitle,
        title_manually_set: true,
      },
    ];

    // First call (before async): allows generation
    vi.mocked(queryClient.getQueryData).mockReturnValueOnce(initialTasks);
    expect(shouldApplyAutoTitle(taskId)).toBe(true);

    // Second call (after async): should block - user renamed during generation
    vi.mocked(queryClient.getQueryData).mockReturnValueOnce(renamedTasks);
    expect(shouldApplyAutoTitle(taskId)).toBe(false);
  });
});
