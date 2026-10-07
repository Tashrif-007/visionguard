// Renders a .docx in headless Chrome with docx-preview and saves one PNG per page (needs network for the CDN scripts).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const [, , docx, outDir, from = '1', to = '999'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 1400, deviceScaleFactor: 1 } });
  const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0;background:#888"><div id="c"></div></body></html>');
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js' });
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js' });
  const b64 = fs.readFileSync(docx).toString('base64');
  await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await docx.renderAsync(bin, document.getElementById('c'), null, { inWrapper: false, ignoreWidth: false, ignoreHeight: false, breakPages: true, renderHeaders: false, renderFooters: false });
  }, b64);
  await new Promise((r) => setTimeout(r, 3000));
  const pages = await page.$$('section.docx');
  console.log('pages', pages.length);
  for (let i = +from - 1; i < Math.min(pages.length, +to); i++) {
    await pages[i].screenshot({ path: path.join(outDir, `p${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
})();
