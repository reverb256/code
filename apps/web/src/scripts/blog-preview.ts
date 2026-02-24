const rows = document.querySelectorAll(".blog-row");
const previews = document.querySelectorAll(".blog-preview");
const container = document.querySelector(".blog-preview-container");

rows.forEach((row) => {
  row.addEventListener("mouseenter", () => {
    const index = row.getAttribute("data-row-index");
    let hasImage = false;
    previews.forEach((preview) => {
      const previewIndex = preview.getAttribute("data-preview-index");
      const isMatch = previewIndex === index;
      preview.classList.toggle("active", isMatch);
      if (isMatch && preview.querySelector("img")) {
        hasImage = true;
      }
    });
    container?.classList.toggle("has-preview", hasImage);
  });

  row.addEventListener("mouseleave", () => {
    previews.forEach((preview) => {
      preview.classList.remove("active");
    });
    container?.classList.remove("has-preview");
  });
});
