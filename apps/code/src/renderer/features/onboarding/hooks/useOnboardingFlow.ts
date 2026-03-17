import { useFeatureFlag } from "@hooks/useFeatureFlag";
import { trpcClient } from "@renderer/trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ONBOARDING_STEPS, type OnboardingStep } from "../types";

export interface DetectedRepo {
  organization: string;
  repository: string;
  fullName: string;
  remote?: string;
  branch?: string;
}

export function useOnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const directionRef = useRef<1 | -1>(1);
  const billingEnabled = useFeatureFlag("twig-billing", false);

  // Repo selection state — set on the git integration step, used by later steps
  const [selectedDirectory, setSelectedDirectory] = useState("");
  const [detectedRepo, setDetectedRepo] = useState<DetectedRepo | null>(null);
  const [isDetectingRepo, setIsDetectingRepo] = useState(false);

  const handleDirectoryChange = useCallback(async (path: string) => {
    setSelectedDirectory(path);
    setDetectedRepo(null);
    if (!path) return;

    setIsDetectingRepo(true);
    try {
      const result = await trpcClient.git.detectRepo.query({
        directoryPath: path,
      });
      if (result) {
        setDetectedRepo({
          organization: result.organization,
          repository: result.repository,
          fullName: `${result.organization}/${result.repository}`,
          remote: result.remote ?? undefined,
          branch: result.branch ?? undefined,
        });
      }
    } catch {
      // Not a git repo or no remote — that's fine
    } finally {
      setIsDetectingRepo(false);
    }
  }, []);

  const activeSteps = useMemo(() => {
    let steps = ONBOARDING_STEPS;
    if (!billingEnabled) {
      steps = steps.filter(
        (step) => step !== "billing" && step !== "org-billing",
      );
    }
    return steps;
  }, [billingEnabled]);

  // Reset to first step if current step is no longer in active steps
  useEffect(() => {
    if (!activeSteps.includes(currentStep)) {
      setCurrentStep(activeSteps[0]);
    }
  }, [activeSteps, currentStep]);

  const currentIndex = activeSteps.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === activeSteps.length - 1;

  const next = () => {
    if (!isLastStep) {
      directionRef.current = 1;
      setCurrentStep(activeSteps[currentIndex + 1]);
    }
  };

  const back = () => {
    if (!isFirstStep) {
      directionRef.current = -1;
      setCurrentStep(activeSteps[currentIndex - 1]);
    }
  };

  const goTo = (step: OnboardingStep) => {
    const targetIndex = activeSteps.indexOf(step);
    directionRef.current = targetIndex >= currentIndex ? 1 : -1;
    setCurrentStep(step);
  };

  return {
    currentStep,
    currentIndex,
    totalSteps: activeSteps.length,
    activeSteps,
    isFirstStep,
    isLastStep,
    direction: directionRef.current,
    next,
    back,
    goTo,
    // Repo selection
    selectedDirectory,
    detectedRepo,
    isDetectingRepo,
    handleDirectoryChange,
  };
}
