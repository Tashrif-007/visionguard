// Renders the Mermaid sources in diagrams.js to PNG (needs network access for the mermaid CDN script).
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const defs = require(process.env.DEFS || './diagrams.js');
const OUT = path.join(__dirname, '..', 'assets', process.env.OUTDIR || 'diagrams');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="out"></div></body></html>');
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js' });
  await page.evaluate((compact, seqW, seqM) => mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', themeVariables: { fontSize: compact ? '19px' : '15px' }, flowchart: { htmlLabels: true, useMaxWidth: false }, sequence: compact ? { useMaxWidth: false, width: seqW, height: 46, actorMargin: seqM, boxMargin: 6, messageMargin: 28, wrap: true, messageFontSize: 18, noteFontSize: 16, actorFontSize: 17 } : { useMaxWidth: false, width: 130, actorMargin: 25, wrap: true, messageFontSize: 14, noteFontSize: 13 }, state: { useMaxWidth: false }, class: { useMaxWidth: false }, er: { useMaxWidth: false } }), !!process.env.COMPACT, +(process.env.SEQW || 120), +(process.env.SEQM || 14));
  const only = process.argv[2];
  for (const [name, src] of Object.entries(defs)) {
    if (only && only !== name) continue;
    try {
      await page.evaluate(async (n, s) => { const { svg } = await mermaid.render('g_' + n, s); document.getElementById('out').innerHTML = '<div id="wrap" style="display:inline-block;padding:16px;background:#fff">' + svg + '</div>'; }, name, src);
      const el = await page.$('#wrap');
      await el.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log('ok', name);
    } catch (e) { console.log('FAIL', name, String(e).slice(0, 300)); process.exitCode = 1; }
  }
  await browser.close();
})();
