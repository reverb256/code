const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  const which = process.argv[2] || "after"; // 'before' or 'after'
  const out = `/tmp/actionselector-${which}-zoomed.png`;

  await page.goto(
    "http://localhost:6006/?path=/story/actionselector--single-select",
    { timeout: 30000 },
  );
  await page.waitForTimeout(3000);

  // Find the storybook preview iframe and zoom into the component
  const frame = page.frameLocator("iframe#storybook-preview-iframe");
  const component = frame.locator("#root");

  await component.screenshot({ path: out });

  console.log(`Screenshot saved to ${out}`);
  await browser.close();
})();
