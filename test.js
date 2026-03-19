const puppeteer = require("puppeteer");

(async () => {  
  const browser = await puppeteer.launch({
    bindAddress: "0.0.0.0",
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0"
    ]
  });
  const page = await browser.newPage();
  await page.goto("https://example.com/", { waitUntil: "networkidle2" });
  await page.screenshot({ path: "test/example.png" });
  await browser.close();
})();