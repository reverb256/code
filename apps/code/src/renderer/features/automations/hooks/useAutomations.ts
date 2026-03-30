import { useAuthenticatedMutation } from "@hooks/useAuthenticatedMutation";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Automation } from "@shared/types/automations";
import { queryClient } from "@utils/queryClient";
import { useMemo } from "react";
import { computeNextRunAt } from "../utils/schedule";

interface AutomationApi {
  id: string;
  name: string;
  prompt: string;
  repository: string;
  github_integration?: number | null;
  schedule_time: string;
  timezone: string;
  template_id?: string | null;
  enabled: boolean;
  last_run_at?: string | null;
  last_run_status?: "success" | "failed" | "running" | null;
  last_task_id?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

interface SaveAutomationInput {
  name: string;
  prompt: string;
  repository: string;
  github_integration?: number | null;
  schedule_time: string;
  timezone: string;
  template_id?: string | null;
  enabled?: boolean;
}

const automationKeys = {
  all: ["automations"] as const,
  list: () => [...automationKeys.all, "list"] as const,
};

const AUTOMATION_LIST_POLL_INTERVAL_MS = 30_000;

function mapAutomation(api: AutomationApi): Automation {
  return {
    id: api.id,
    name: api.name,
    prompt: api.prompt,
    repoPath: api.repository,
    repository: api.repository,
    githubIntegrationId: api.github_integration ?? null,
    scheduleTime: api.schedule_time,
    timezone: api.timezone,
    enabled: api.enabled,
    templateId: api.template_id ?? null,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    nextRunAt: api.enabled
      ? computeNextRunAt(api.schedule_time, api.timezone)
      : null,
    lastRunAt: api.last_run_at ?? null,
    lastRunStatus: api.last_run_status ?? null,
    lastTaskId: api.last_task_id ?? null,
    lastError: api.last_error ?? null,
  };
}

export function useAutomations() {
  const query = useAuthenticatedQuery<Automation[]>(
    automationKeys.list(),
    async (client) => {
      const automations = await client.listTaskAutomations();
      return automations.map((automation) =>
        mapAutomation(automation as AutomationApi),
      );
    },
    { refetchInterval: AUTOMATION_LIST_POLL_INTERVAL_MS },
  );

  const automations = useMemo(() => query.data ?? [], [query.data]);

  return { ...query, automations };
}

export function useCreateAutomation() {
  return useAuthenticatedMutation(
    (client, input: SaveAutomationInput) => client.createTaskAutomation(input),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: automationKeys.list() });
      },
    },
  );
}

export function useUpdateAutomation() {
  return useAuthenticatedMutation(
    (
      client,
      variables: {
        automationId: string;
        updates: Partial<SaveAutomationInput>;
      },
    ) => client.updateTaskAutomation(variables.automationId, variables.updates),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: automationKeys.list() });
      },
    },
  );
}

export function useDeleteAutomation() {
  return useAuthenticatedMutation(
    (client, automationId: string) => client.deleteTaskAutomation(automationId),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: automationKeys.list() });
      },
    },
  );
}

export function useRunAutomationNow() {
  return useAuthenticatedMutation(
    (client, automationId: string) => client.runTaskAutomationNow(automationId),
    {
      onSuccess: () => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: automationKeys.list() }),
          queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        ]);
      },
    },
  );
}
