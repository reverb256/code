import { useSettingsStore } from "@features/settings/stores/settingsStore";
import { GitBranch, Spinner, Warning } from "@phosphor-icons/react";
import { Box, Button, Checkbox, Code, Flex, Text } from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback, useEffect, useState } from "react";

const log = logger.scope("branch-switch-guard");

type GuardState =
  | { type: "checking" }
  | { type: "idle" }
  | {
      type: "confirming";
      currentBranch: string;
      targetBranch: string;
    }
  | {
      type: "blocked";
      currentBranch: string;
    }
  | { type: "switching" }
  | { type: "error"; message: string };

interface BranchSwitchGuardProps {
  taskId: string;
  branchName: string | null;
  mode: string;
}

export function BranchSwitchGuard({
  taskId,
  branchName,
  mode,
}: BranchSwitchGuardProps) {
  const [state, setState] = useState<GuardState>({ type: "checking" });
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const autoSwitch = useSettingsStore((s) => s.autoSwitchBranchOnTaskFocus);
  const setAutoSwitch = useSettingsStore(
    (s) => s.setAutoSwitchBranchOnTaskFocus,
  );

  const doSwitch = useCallback(async () => {
    setState({ type: "switching" });
    try {
      const result = await trpcClient.workspace.switchToTask.mutate({ taskId });
      if (result.status === "ok") {
        setState({ type: "idle" });
        if (result.restoredWip) {
          toast.success("Restored your changes from last session");
        }
      } else if (result.status === "error") {
        setState({ type: "error", message: result.message });
      } else if (result.status === "blocked-dirty-unmanaged") {
        setState({ type: "blocked", currentBranch: result.currentBranch });
      }
    } catch (error) {
      log.error("Branch switch failed", { error });
      setState({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [taskId]);

  useEffect(() => {
    if (!branchName || mode !== "local") {
      setState({ type: "idle" });
      return;
    }

    if (autoSwitch) {
      doSwitch();
      return;
    }

    // Read-only check: does a switch need to happen?
    const check = async () => {
      try {
        const result = await trpcClient.workspace.checkSwitchNeeded.query({
          taskId,
        });
        if (!result.needsSwitch) {
          setState({ type: "idle" });
        } else {
          setState({
            type: "confirming",
            currentBranch: result.currentBranch ?? "unknown",
            targetBranch: result.targetBranch ?? branchName,
          });
        }
      } catch (error) {
        log.error("Branch switch check failed", { error });
        setState({ type: "idle" });
      }
    };

    check();
  }, [taskId, branchName, mode, autoSwitch, doSwitch]);

  const handleConfirm = useCallback(async () => {
    if (dontAskAgain) {
      setAutoSwitch(true);
    }
    await doSwitch();
  }, [dontAskAgain, setAutoSwitch, doSwitch]);

  const handleDismiss = useCallback(() => {
    setState({ type: "idle" });
  }, []);

  // Don't render anything when idle or checking
  if (state.type === "idle" || state.type === "checking") {
    return null;
  }

  return (
    <Flex
      align="center"
      justify="center"
      className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm"
    >
      <Box className="mx-4 max-w-md rounded-lg border border-gray-6 bg-gray-2 p-4 shadow-lg">
        {state.type === "confirming" && (
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <GitBranch size={16} className="text-gray-11" />
              <Text size="2" weight="medium" className="text-gray-12">
                Switch branch?
              </Text>
            </Flex>
            <Text size="2" className="text-gray-11">
              This will save your changes on <Code>{state.currentBranch}</Code>{" "}
              and checkout <Code>{state.targetBranch}</Code>
            </Text>
            <Flex align="center" justify="between">
              <Text as="label" size="1" className="text-gray-11">
                <Flex align="center" gap="2">
                  <Checkbox
                    size="1"
                    checked={dontAskAgain}
                    onCheckedChange={(checked) =>
                      setDontAskAgain(checked === true)
                    }
                  />
                  Always switch automatically
                </Flex>
              </Text>
              <Flex gap="2">
                <Button
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={handleDismiss}
                >
                  Cancel
                </Button>
                <Button size="1" variant="solid" onClick={handleConfirm}>
                  Switch
                </Button>
              </Flex>
            </Flex>
          </Flex>
        )}

        {state.type === "blocked" && (
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <Warning size={16} className="text-amber-9" />
              <Text size="2" weight="medium" className="text-gray-12">
                Cannot switch branch
              </Text>
            </Flex>
            <Text size="2" className="text-gray-11">
              You have uncommitted changes on <Code>{state.currentBranch}</Code>
              . Please commit or stash before switching tasks.
            </Text>
            <Flex justify="end">
              <Button
                size="1"
                variant="soft"
                color="gray"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </Flex>
          </Flex>
        )}

        {state.type === "switching" && (
          <Flex align="center" gap="2" justify="center" py="1">
            <Spinner size="2" />
            <Text size="2" className="text-gray-11">
              Switching branches...
            </Text>
          </Flex>
        )}

        {state.type === "error" && (
          <Flex direction="column" gap="3">
            <Flex align="center" gap="2">
              <Warning size={16} className="text-red-9" />
              <Text size="2" weight="medium" className="text-gray-12">
                Branch switch failed
              </Text>
            </Flex>
            <Text size="2" className="text-gray-11">
              {state.message}
            </Text>
            <Flex justify="end">
              <Button
                size="1"
                variant="soft"
                color="gray"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </Flex>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
