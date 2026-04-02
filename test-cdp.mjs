import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://localhost:9223',
});

const page = await browser.newPage();
await page.goto('https://baidu.com');
await new Promise(resolve => setTimeout(resolve, 5_000));
await browser.close();