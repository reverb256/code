import type { StoredLogEntry } from "@posthog/ui";

export interface Task {
  id: string;
  task_number: number | null;
  slug: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by?: { id: number; email: string; first_name?: string } | null;
  origin_product: string;
  repository?: string | null;
  latest_run?: TaskRun;
}

export interface TaskRun {
  id: string;
  task: string;
  team: number;
  branch: string | null;
  stage?: string | null;
  environment?: "local" | "cloud";
  status: "started" | "in_progress" | "completed" | "failed" | "cancelled";
  log_url: string;
  error_message: string | null;
  output: Record<string, unknown> | null;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

async function apiFetch(
  apiHost: string,
  token: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const baseUrl = apiHost.endsWith("/") ? apiHost.slice(0, -1) : apiHost;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return response;
}

export class PostHogWebClient {
  private teamId: number | null = null;

  constructor(
    private token: string,
    private apiHost: string,
  ) {}

  private async getTeamId(): Promise<number> {
    if (this.teamId !== null) return this.teamId;
    const response = await apiFetch(
      this.apiHost,
      this.token,
      "/api/users/@me/",
    );
    if (!response.ok) throw new Error("Failed to fetch user");
    const data = await response.json();
    if (!data?.team?.id) throw new Error("No team found for user");
    this.teamId = data.team.id;
    return this.teamId!;
  }

  async getCurrentUser() {
    const response = await apiFetch(
      this.apiHost,
      this.token,
      "/api/users/@me/",
    );
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json();
  }

  async getTasks(): Promise<Task[]> {
    const teamId = await this.getTeamId();
    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/?limit=500`,
    );
    if (!response.ok) throw new Error("Failed to fetch tasks");
    const data = await response.json();
    return data.results ?? [];
  }

  async getTask(taskId: string): Promise<Task> {
    const teamId = await this.getTeamId();
    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/${taskId}/`,
    );
    if (!response.ok) throw new Error("Failed to fetch task");
    return response.json();
  }

  async getTaskRun(taskId: string, runId: string): Promise<TaskRun> {
    const teamId = await this.getTeamId();
    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/${taskId}/runs/${runId}/`,
    );
    if (!response.ok) throw new Error("Failed to fetch task run");
    return response.json();
  }

  async getTaskRunSessionLogs(
    taskId: string,
    runId: string,
    options?: { limit?: number; after?: string },
  ): Promise<StoredLogEntry[]> {
    const teamId = await this.getTeamId();
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit ?? 5000));
    if (options?.after) params.set("after", options.after);

    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/${taskId}/runs/${runId}/session_logs/?${params}`,
    );
    if (!response.ok) return [];
    return response.json();
  }

  async getTaskLogs(task: Task): Promise<StoredLogEntry[]> {
    const logUrl = task.latest_run?.log_url;
    if (!logUrl) return [];

    try {
      const response = await fetch(logUrl);
      if (!response.ok) return [];
      const content = await response.text();
      if (!content.trim()) return [];
      return content
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as StoredLogEntry);
    } catch {
      return [];
    }
  }

  async cancelTaskRun(taskId: string, runId: string): Promise<TaskRun> {
    const teamId = await this.getTeamId();
    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/${taskId}/runs/${runId}/`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      },
    );
    if (!response.ok) throw new Error("Failed to cancel task run");
    return response.json();
  }

  async sendMessage(
    taskId: string,
    runId: string,
    message: string,
  ): Promise<void> {
    const teamId = await this.getTeamId();
    const response = await apiFetch(
      this.apiHost,
      this.token,
      `/api/projects/${teamId}/tasks/${taskId}/runs/${runId}/append_log/`,
      {
        method: "POST",
        body: JSON.stringify({
          entries: [
            {
              type: "request",
              timestamp: new Date().toISOString(),
              notification: {
                id: Date.now(),
                method: "session/prompt",
                params: {
                  prompt: [{ type: "text", text: message }],
                },
              },
            },
          ],
        }),
      },
    );
    if (!response.ok) throw new Error("Failed to send message");
  }
}
