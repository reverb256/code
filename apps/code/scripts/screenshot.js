const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Wait for storybook to be ready
  await page.goto(
    "http://localhost:6006/?path=/story/actionselector--single-select",
  );
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({
    path: "/tmp/actionselector-after.png",
    fullPage: true,
  });

  console.log("Screenshot saved to /tmp/actionselector-after.png");

  await browser.close();
})();
