/**
 * Register playwright-extra plugins on this instance before any launch, e.g.:
 *   firefox.use(SomePlugin())
 * Avoid puppeteer-extra-plugin-stealth for Firefox — it is optimized for Chromium.
 */
import { firefox } from "playwright-extra";

export { firefox };
