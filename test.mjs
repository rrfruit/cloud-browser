import { launch, ensureBinary } from 'cloakbrowser';

await ensureBinary()

console.log('12223')

const browser = await launch();
const page = await browser.newPage();
await page.goto('https://protected-site.com');
await browser.close();