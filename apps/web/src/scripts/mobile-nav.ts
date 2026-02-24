const toggle = document.querySelector(".nav-toggle");
const popover = document.querySelector(".nav-popover");
const closeBtn = document.querySelector(".nav-close");

function closePopover() {
  toggle?.setAttribute("aria-expanded", "false");
  popover?.classList.remove("open");
}

toggle?.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  popover?.classList.toggle("open");
});

closeBtn?.addEventListener("click", closePopover);
