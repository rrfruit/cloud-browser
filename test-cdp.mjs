import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP({
  wsEndpoint: 'ws://localhost:5802',
});

const page = await browser.newPage();
await page.goto('https://baidu.com');
await new Promise(resolve => setTimeout(resolve, 5_000));
await browser.close();