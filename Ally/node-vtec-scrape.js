const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const downloadPath = path.resolve("./downloads");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();

  // Allow downloads
  await page._client().send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath
  });

  console.log("Opening Vanguard page...");
  await page.goto(
    "https://advisors.vanguard.com/investments/products/vtec/vanguard-california-tax-exempt-bond-etf#priceanddistributions",
    { waitUntil: "networkidle2" }
  );

  // Scroll to the distributions section
  await page.evaluate(() => {
    const el = document.querySelector("#priceanddistributions");
    if (el) el.scrollIntoView();
  });

  console.log("Waiting for distributions table to load...");

  // Wait for the distributions table to appear
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll("span"))
      .some(s => s.textContent.trim() === "Export distribution data");
  }, { timeout: 15000 });

  console.log("Locating 'Export distribution data' button...");

  // Find the button by scanning all <span> elements
  const exportButtonHandle = await page.evaluateHandle(() => {
    const spans = Array.from(document.querySelectorAll("span"));
    for (const span of spans) {
      if (span.textContent.trim() === "Export distribution data") {
        return span.closest("button");
      }
    }
    return null;
  });

  const exportButton = exportButtonHandle.asElement();

  if (!exportButton) {
    console.error("Could not find the 'Export distribution data' button.");
    await browser.close();
    return;
  }

  console.log("Clicking export button...");
  await exportButton.click();

  console.log("Waiting for CSV download...");
  await page.waitForTimeout(6000);

  console.log("Download complete. Saved to:", downloadPath);

  await browser.close();
})();