import { GitHubRepoPicker } from "@features/folder-picker/components/GitHubRepoPicker";
import { useRepositoryIntegration } from "@hooks/useIntegrations";
import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import {
  ClockCounterClockwise,
  FloppyDisk,
  Play,
  Plus,
  Robot,
  Trash,
} from "@phosphor-icons/react";
import {
  Badge,
  Box,
  Button,
  Flex,
  ScrollArea,
  Separator,
  Switch,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import type { Automation } from "@shared/types/automations";
import { useEffect, useMemo, useState } from "react";
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useRunAutomationNow,
  useUpdateAutomation,
} from "../hooks/useAutomations";
import { AUTOMATION_TEMPLATES } from "../templates";
import { formatAutomationDateTime, getLocalTimezone } from "../utils/schedule";

interface AutomationDraft {
  name: string;
  prompt: string;
  repository: string | null;
  githubIntegrationId: number | null;
  scheduleTime: string;
  templateId: string | null;
}

function toDraft(
  automation?: Automation | null,
  githubIntegrationId?: number | null,
): AutomationDraft {
  if (!automation) {
    return {
      name: "",
      prompt: "",
      repository: null,
      githubIntegrationId: githubIntegrationId ?? null,
      scheduleTime: "09:00",
      templateId: null,
    };
  }

  return {
    name: automation.name,
    prompt: automation.prompt,
    repository: automation.repository ?? automation.repoPath ?? null,
    githubIntegrationId:
      automation.githubIntegrationId ?? githubIntegrationId ?? null,
    scheduleTime: automation.scheduleTime,
    templateId: automation.templateId ?? null,
  };
}

function AutomationStatusBadge({ automation }: { automation: Automation }) {
  if (!automation.enabled) {
    return (
      <Badge size="1" variant="soft" color="gray">
        Paused
      </Badge>
    );
  }

  if (automation.lastRunStatus === "failed") {
    return (
      <Badge size="1" variant="soft" color="red">
        Failed
      </Badge>
    );
  }

  if (automation.lastRunStatus === "success") {
    return (
      <Badge size="1" variant="soft" color="green">
        Healthy
      </Badge>
    );
  }

  if (automation.lastRunStatus === "running") {
    return (
      <Badge size="1" variant="soft" color="blue">
        Running
      </Badge>
    );
  }

  return (
    <Badge size="1" variant="soft" color="blue">
      Active
    </Badge>
  );
}

export function AutomationsView() {
  const { automations, isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const runAutomationNow = useRunAutomationNow();
  const { githubIntegration, repositories, isLoadingRepos } =
    useRepositoryIntegration();

  const [selectedAutomationId, setSelectedAutomationId] = useState<
    string | null
  >(null);
  const [isCreating, setIsCreating] = useState(true);
  const [draft, setDraft] = useState<AutomationDraft>(() =>
    toDraft(null, githubIntegration?.id),
  );
  const [pendingRunAutomationId, setPendingRunAutomationId] = useState<
    string | null
  >(null);
  const [pendingToggleAutomationId, setPendingToggleAutomationId] = useState<
    string | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedAutomation = useMemo(
    () =>
      automations.find(
        (automation) => automation.id === selectedAutomationId,
      ) ?? null,
    [automations, selectedAutomationId],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (automations.length === 0) {
      setIsCreating(true);
      setSelectedAutomationId(null);
      return;
    }

    if (isCreating) {
      return;
    }

    if (!selectedAutomationId) {
      setSelectedAutomationId(automations[0]?.id ?? null);
      return;
    }

    const stillExists = automations.some(
      (automation) => automation.id === selectedAutomationId,
    );
    if (!stillExists) {
      setSelectedAutomationId(automations[0]?.id ?? null);
    }
  }, [automations, isCreating, isLoading, selectedAutomationId]);

  useEffect(() => {
    if (isCreating) {
      setDraft(toDraft(null, githubIntegration?.id));
      return;
    }

    if (selectedAutomation) {
      setDraft(toDraft(selectedAutomation, githubIntegration?.id));
    }
  }, [isCreating, selectedAutomation, githubIntegration?.id]);

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <ClockCounterClockwise size={12} className="shrink-0 text-gray-10" />
        <Text
          size="1"
          weight="medium"
          className="truncate whitespace-nowrap font-mono text-[12px]"
          title="Automations"
        >
          Automations
        </Text>
      </Flex>
    ),
    [],
  );

  useSetHeaderContent(headerContent);

  const timezone = getLocalTimezone();
  const enabledCount = automations.filter(
    (automation) => automation.enabled,
  ).length;
  const hasGitHubIntegration =
    Boolean(githubIntegration) && repositories.length > 0;

  const openCreate = () => {
    setFormError(null);
    setIsCreating(true);
    setSelectedAutomationId(null);
  };

  const openExisting = (automation: Automation) => {
    setFormError(null);
    setIsCreating(false);
    setSelectedAutomationId(automation.id);
  };

  const applyTemplate = (templateId: string) => {
    const template = AUTOMATION_TEMPLATES.find(
      (item) => item.id === templateId,
    );
    if (!template) {
      return;
    }

    setDraft((current) => ({
      ...current,
      name: current.name || template.name,
      prompt: template.prompt,
      templateId: template.id,
    }));
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.prompt.trim() || !draft.repository) {
      return;
    }

    setFormError(null);

    try {
      if (isCreating || !selectedAutomation) {
        const created = await createAutomation.mutateAsync({
          name: draft.name.trim(),
          prompt: draft.prompt.trim(),
          repository: draft.repository,
          github_integration: draft.githubIntegrationId,
          schedule_time: draft.scheduleTime,
          timezone,
          template_id: draft.templateId,
          enabled: true,
        });
        setIsCreating(false);
        setSelectedAutomationId(created.id);
        return;
      }

      await updateAutomation.mutateAsync({
        automationId: selectedAutomation.id,
        updates: {
          name: draft.name.trim(),
          prompt: draft.prompt.trim(),
          repository: draft.repository,
          github_integration: draft.githubIntegrationId,
          schedule_time: draft.scheduleTime,
          timezone,
          template_id: draft.templateId,
        },
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save automation.",
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedAutomation) {
      return;
    }

    await deleteAutomation.mutateAsync(selectedAutomation.id);
    openCreate();
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!selectedAutomation) {
      return;
    }

    setPendingToggleAutomationId(selectedAutomation.id);
    setFormError(null);
    try {
      await updateAutomation.mutateAsync({
        automationId: selectedAutomation.id,
        updates: { enabled },
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to update automation state.",
      );
    } finally {
      setPendingToggleAutomationId(null);
    }
  };

  const handleRunNow = async () => {
    if (!selectedAutomation) {
      return;
    }

    setPendingRunAutomationId(selectedAutomation.id);
    setFormError(null);
    try {
      await runAutomationNow.mutateAsync(selectedAutomation.id);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to run automation.",
      );
    } finally {
      setPendingRunAutomationId(null);
    }
  };

  const isSaving = createAutomation.isPending || updateAutomation.isPending;
  const isDeleting = deleteAutomation.isPending;

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Flex
        align="center"
        gap="3"
        px="3"
        py="2"
        className="shrink-0 border-gray-6 border-b"
      >
        <Text size="1" className="font-mono text-[11px] text-gray-10">
          {automations.length} automation{automations.length === 1 ? "" : "s"}
        </Text>
        <Text size="1" className="font-mono text-[11px] text-gray-10">
          {enabledCount} enabled
        </Text>
        <div className="flex-1" />
        <Button size="1" variant="soft" onClick={openCreate}>
          <Plus size={12} />
          New automation
        </Button>
      </Flex>

      <Flex style={{ minHeight: 0 }} className="flex-1">
        <Box width="360px" className="border-gray-6 border-r">
          <ScrollArea type="auto" style={{ height: "100%" }}>
            <Flex direction="column" gap="2" p="3">
              {isLoading ? (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  gap="3"
                  className="rounded-lg border border-gray-6 border-dashed p-6"
                >
                  <Text size="2" className="font-mono text-[12px] text-gray-10">
                    Loading automations...
                  </Text>
                </Flex>
              ) : automations.length === 0 ? (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  gap="3"
                  className="rounded-lg border border-gray-6 border-dashed p-6"
                >
                  <Robot size={28} className="text-gray-8" />
                  <Text size="2" className="font-mono text-[12px] text-gray-10">
                    No automations yet
                  </Text>
                </Flex>
              ) : (
                automations.map((automation) => {
                  const isSelected =
                    !isCreating && selectedAutomation?.id === automation.id;

                  return (
                    <button
                      key={automation.id}
                      type="button"
                      onClick={() => openExisting(automation)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-accent-8 bg-accent-2"
                          : "border-gray-5 bg-gray-1 hover:border-gray-7 hover:bg-gray-2"
                      }`}
                    >
                      <Flex direction="column" gap="2">
                        <Flex align="center" justify="between" gap="2">
                          <Text
                            size="2"
                            weight="medium"
                            className="min-w-0 flex-1 truncate font-mono text-[12px]"
                          >
                            {automation.name}
                          </Text>
                          <AutomationStatusBadge automation={automation} />
                        </Flex>
                        <Text
                          size="1"
                          className="font-mono text-[11px] text-gray-10"
                        >
                          Next run{" "}
                          {automation.enabled
                            ? formatAutomationDateTime(
                                automation.nextRunAt,
                                automation.timezone,
                              )
                            : "paused"}
                        </Text>
                        <Text
                          size="1"
                          className="truncate font-mono text-[11px] text-gray-10"
                        >
                          {automation.repository ?? automation.repoPath}
                        </Text>
                      </Flex>
                    </button>
                  );
                })
              )}
            </Flex>
          </ScrollArea>
        </Box>

        <Box flexGrow="1" style={{ minWidth: 0 }}>
          <ScrollArea type="auto" style={{ height: "100%" }}>
            <Flex direction="column" gap="5" p="4" style={{ maxWidth: 900 }}>
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  {isCreating
                    ? "New automation"
                    : (selectedAutomation?.name ?? "Automation")}
                </Text>
                <Text size="1" className="font-mono text-[11px] text-gray-10">
                  Runs in the cloud sandbox on schedule, even while Twig is
                  closed.
                </Text>
              </Flex>

              <Flex direction="column" gap="3">
                <Text
                  size="1"
                  weight="medium"
                  className="font-mono text-[11px]"
                >
                  Template library
                </Text>
                <Flex gap="3" wrap="wrap">
                  {AUTOMATION_TEMPLATES.map((template) => (
                    <Box
                      key={template.id}
                      className="min-w-[220px] flex-1 rounded-lg border border-gray-5 bg-gray-1 p-3"
                    >
                      <Flex direction="column" gap="2">
                        <Flex align="center" justify="between" gap="2">
                          <Text size="2" weight="medium">
                            {template.name}
                          </Text>
                          <Badge size="1" variant="soft">
                            {template.category}
                          </Badge>
                        </Flex>
                        <Text size="1" className="text-gray-10">
                          {template.description}
                        </Text>
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => applyTemplate(template.id)}
                        >
                          Use template
                        </Button>
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </Flex>

              <Separator size="4" />

              <Flex direction="column" gap="4">
                <Flex direction="column" gap="2">
                  <Text
                    size="1"
                    weight="medium"
                    className="font-mono text-[11px]"
                  >
                    Name
                  </Text>
                  <TextField.Root
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Morning repo check"
                  />
                </Flex>

                <Flex direction="column" gap="2">
                  <Text
                    size="1"
                    weight="medium"
                    className="font-mono text-[11px]"
                  >
                    Prompt
                  </Text>
                  <TextArea
                    value={draft.prompt}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        prompt: event.target.value,
                      }))
                    }
                    placeholder="Tell the agent what to review and summarize."
                    rows={10}
                  />
                </Flex>

                <Flex direction="column" gap="2">
                  <Text
                    size="1"
                    weight="medium"
                    className="font-mono text-[11px]"
                  >
                    GitHub repository
                  </Text>
                  {hasGitHubIntegration ? (
                    <GitHubRepoPicker
                      value={draft.repository}
                      onChange={(repository) =>
                        setDraft((current) => ({
                          ...current,
                          repository,
                          githubIntegrationId: githubIntegration?.id ?? null,
                        }))
                      }
                      repositories={repositories}
                      isLoading={isLoadingRepos}
                      placeholder="Select repository..."
                      size="2"
                    />
                  ) : (
                    <TextField.Root
                      value={draft.repository ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          repository: event.target.value.trim() || null,
                          githubIntegrationId: null,
                        }))
                      }
                      placeholder="posthog/posthog"
                    />
                  )}
                  <Text size="1" className="font-mono text-[11px] text-gray-10">
                    {hasGitHubIntegration
                      ? "Each automation runs against a single GitHub repository in the cloud sandbox."
                      : "No GitHub integration is connected. You can still enter org/repo for local testing, but the sandbox will not clone the repository until GitHub is connected."}
                  </Text>
                </Flex>

                <Flex gap="4" wrap="wrap">
                  <Flex direction="column" gap="2">
                    <Text
                      size="1"
                      weight="medium"
                      className="font-mono text-[11px]"
                    >
                      Daily time
                    </Text>
                    <TextField.Root
                      type="time"
                      value={draft.scheduleTime}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          scheduleTime: event.target.value,
                        }))
                      }
                    />
                  </Flex>

                  <Flex direction="column" gap="2">
                    <Text
                      size="1"
                      weight="medium"
                      className="font-mono text-[11px]"
                    >
                      Timezone
                    </Text>
                    <Box className="rounded border border-gray-6 bg-gray-2 px-3 py-2">
                      <Text
                        size="1"
                        className="font-mono text-[11px] text-gray-10"
                      >
                        {timezone}
                      </Text>
                    </Box>
                  </Flex>
                </Flex>

                {!isCreating && selectedAutomation ? (
                  <Flex direction="column" gap="2">
                    <Text
                      size="1"
                      weight="medium"
                      className="font-mono text-[11px]"
                    >
                      Run status
                    </Text>
                    <Flex direction="column" gap="1">
                      <Text
                        size="1"
                        className="font-mono text-[11px] text-gray-10"
                      >
                        Next run:{" "}
                        {selectedAutomation.enabled
                          ? formatAutomationDateTime(
                              selectedAutomation.nextRunAt,
                              selectedAutomation.timezone,
                            )
                          : "Paused"}
                      </Text>
                      <Text
                        size="1"
                        className="font-mono text-[11px] text-gray-10"
                      >
                        Last run:{" "}
                        {formatAutomationDateTime(
                          selectedAutomation.lastRunAt,
                          selectedAutomation.timezone,
                        )}
                      </Text>
                      {selectedAutomation.lastError ? (
                        <Text
                          size="1"
                          className="font-mono text-[11px] text-red-10"
                        >
                          {selectedAutomation.lastError}
                        </Text>
                      ) : null}
                    </Flex>
                  </Flex>
                ) : null}
              </Flex>

              {formError ? (
                <Box className="rounded-lg border border-red-6 bg-red-2 px-3 py-2">
                  <Text size="1" className="font-mono text-[11px] text-red-11">
                    {formError}
                  </Text>
                </Box>
              ) : null}

              <Flex align="center" gap="3" wrap="wrap">
                {!isCreating && selectedAutomation ? (
                  <>
                    <Switch
                      checked={selectedAutomation.enabled}
                      disabled={
                        pendingToggleAutomationId === selectedAutomation.id
                      }
                      onCheckedChange={(enabled) =>
                        void handleToggleEnabled(enabled)
                      }
                    />
                    <Text
                      size="1"
                      className="font-mono text-[11px] text-gray-10"
                    >
                      {selectedAutomation.enabled ? "Enabled" : "Paused"}
                    </Text>
                  </>
                ) : null}
                <div className="flex-1" />
                {!isCreating && selectedAutomation ? (
                  <Button
                    color="gray"
                    variant="soft"
                    disabled={pendingRunAutomationId === selectedAutomation.id}
                    onClick={() => void handleRunNow()}
                  >
                    <Play size={12} />
                    Run now
                  </Button>
                ) : null}
                {!isCreating && selectedAutomation ? (
                  <Button
                    color="red"
                    variant="soft"
                    disabled={isDeleting}
                    onClick={() => void handleDelete()}
                  >
                    <Trash size={12} />
                    Delete
                  </Button>
                ) : null}
                <Button
                  onClick={() => void handleSave()}
                  disabled={
                    !draft.name.trim() ||
                    !draft.prompt.trim() ||
                    !draft.repository ||
                    isSaving
                  }
                >
                  <FloppyDisk size={12} />
                  {isCreating ? "Create automation" : "Save changes"}
                </Button>
              </Flex>
            </Flex>
          </ScrollArea>
        </Box>
      </Flex>
    </Flex>
  );
}
