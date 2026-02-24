const form = document.querySelector(".waitlist-form") as HTMLElement;
if (!form) throw new Error("Waitlist form not found");

const fields = form.querySelectorAll(
  ".waitlist-field",
) as NodeListOf<HTMLElement>;
const labelEl = form.querySelector(".waitlist-label") as HTMLElement;
const stepEl = form.querySelector(".waitlist-step") as HTMLElement;
const prevBtn = form.querySelector(".waitlist-btn-prev") as HTMLButtonElement;
const nextBtn = form.querySelector(".waitlist-btn-next") as HTMLButtonElement;
const submitBtn = form.querySelector(
  ".waitlist-btn-submit",
) as HTMLButtonElement;
const nav = form.querySelector(".waitlist-nav") as HTMLElement;
const toggleBtns = form.querySelectorAll(
  ".waitlist-toggle-btn",
) as NodeListOf<HTMLButtonElement>;
const successEmailEl = form.querySelector(
  ".waitlist-success-email",
) as HTMLElement;

const labels = [
  "EMAIL",
  "TEAM SIZE",
  "POSTHOG USER",
  "AI BUDGET PER DEV (USD)",
] as const;
const totalSteps = fields.length;
let currentStep = 0;

function getInput(step: number): HTMLInputElement {
  const field = fields[step];
  if (!field) throw new Error(`Field at step ${step} not found`);
  return field.querySelector("input") as HTMLInputElement;
}

function updateUI() {
  fields.forEach((field, i) => {
    field.classList.toggle("active", i === currentStep);
  });

  form.style.setProperty(
    "--progress",
    `${((currentStep + 1) / totalSteps) * 100}%`,
  );
  labelEl.textContent = labels[currentStep] ?? "";
  stepEl.textContent = `Step ${currentStep + 1} of ${totalSteps}`;
  prevBtn.disabled = currentStep === 0;

  if (currentStep === 0) {
    nav.classList.remove("show");
    submitBtn.classList.remove("hide");
  } else {
    nav.classList.add("show");
    submitBtn.classList.add("hide");
  }

  nextBtn.textContent =
    currentStep === totalSteps - 1 ? "JOIN THE WAITLIST" : "NEXT >";

  const input = getInput(currentStep);
  if (input.type !== "hidden") {
    input.focus();
  }
}

function goNext() {
  const input = getInput(currentStep);

  if (!input.value.trim()) {
    if (input.type !== "hidden") {
      input.focus();
    }
    return;
  }

  if (currentStep < totalSteps - 1) {
    currentStep++;
    updateUI();
  } else {
    submitForm();
  }
}

function goPrev() {
  if (currentStep > 0) {
    currentStep--;
    updateUI();
  }
}

function submitForm() {
  const formData: Record<string, string> = {};
  fields.forEach((field) => {
    const input = field.querySelector("input") as HTMLInputElement;
    formData[input.name] = input.value;
  });

  const email = formData.email ?? "";
  const teamSize = formData["team-size"] ?? "0";
  const posthogUser = formData["posthog-user"] ?? "false";
  const aiBudget = formData["ai-budget"] ?? "0";

  const ph = window.posthog;
  if (ph) {
    ph.identify(email, { email });
    ph.capture("twig_waitlist_signup", {
      team_size: parseInt(teamSize, 10),
      is_posthog_user: posthogUser === "true",
      ai_budget_usd: parseInt(aiBudget, 10),
    });
    ph.updateEarlyAccessFeatureEnrollment("twig-early-access", true);
  }

  localStorage.setItem("twig-waitlist-email", email);
  showSubmitted(email);
}

function showSubmitted(email: string) {
  if (successEmailEl) {
    successEmailEl.textContent = email;
  }
  form.classList.add("submitted");
}

function checkExistingEnrollment() {
  const ph = window.posthog;
  const savedEmail = localStorage.getItem("twig-waitlist-email");

  if (ph && savedEmail) {
    const isEnrolled = ph.isFeatureEnabled("twig-early-access");
    if (isEnrolled) {
      showSubmitted(savedEmail);
      return true;
    }
  }
  return false;
}

prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);
submitBtn.addEventListener("click", goNext);

fields.forEach((field) => {
  const input = field.querySelector("input") as HTMLInputElement;
  if (input.type !== "hidden") {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        goNext();
      }
    });
  }
});

toggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const toggle = btn.closest(".waitlist-toggle") as HTMLElement;
    const hiddenInput = toggle.querySelector(
      'input[type="hidden"]',
    ) as HTMLInputElement;
    const allBtns = toggle.querySelectorAll(
      ".waitlist-toggle-btn",
    ) as NodeListOf<HTMLButtonElement>;

    allBtns.forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    hiddenInput.value = btn.dataset.value ?? "";
  });
});

const ph = window.posthog;
if (ph?.onFeatureFlags) {
  ph.onFeatureFlags(() => {
    if (!checkExistingEnrollment()) {
      updateUI();
    }
  });
} else {
  updateUI();
}
