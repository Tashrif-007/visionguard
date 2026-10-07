// HTML -> PDF through headless Chrome. Cover, front matter (roman numerals) and body (arabic) are
// rendered separately and merged with pdfunite; the body is rendered first so the table of contents
// and the lists of figures and tables can carry real page numbers.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { build } = require('./model.js');
const M = build();
const { META, FRONT } = M;
const OUT = path.join(M.ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inl = (text) => M.resolve(text).map((t) => (t.c ? `<code>${esc(t.s)}</code>` : t.b ? `<b>${esc(t.s)}</b>` : esc(t.s))).join('');

const CSS = `
@page { size: A4; margin: 22mm 20mm 22mm 20mm; }
html { font-family: 'Liberation Serif','Times New Roman',serif; font-size: 11pt; line-height: 1.33; color: #111; }
body { margin: 0; }
h1 { font-size: 21pt; color: #1F3864; margin: 0 0 14pt; page-break-before: always; page-break-after: avoid; }
h1.first { page-break-before: auto; }
h2 { font-size: 15pt; color: #1F3864; margin: 18pt 0 7pt; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #2E4A7D; margin: 13pt 0 5pt; page-break-after: avoid; }
p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
ul, ol { margin: 0 0 8pt; padding-left: 20pt; } li { margin-bottom: 3pt; text-align: left; }
code { font-family: 'Liberation Mono','DejaVu Sans Mono',monospace; font-size: 9.6pt; background: #f1f3f5; padding: 0 2px; border-radius: 2px; overflow-wrap: anywhere; }
pre { font-family: 'Liberation Mono','DejaVu Sans Mono',monospace; font-size: 8.8pt; line-height: 1.3; background: #f3f4f6; border: 1px solid #c9ced6; padding: 7pt 9pt; margin: 4pt 0 10pt; white-space: pre-wrap; page-break-inside: avoid; }
.note { background: #fff7e0; border-left: 4px solid #e0a800; padding: 6pt 9pt; margin: 6pt 0 10pt; font-size: 10.5pt; page-break-inside: avoid; }
figure { margin: 8pt 0 12pt; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; max-height: 215mm; object-fit: contain; }
figcaption { font-size: 10pt; font-style: italic; margin-top: 4pt; }
.figrow { display: flex; gap: 10px; justify-content: center; align-items: flex-start; page-break-inside: avoid; margin: 6pt 0 10pt; }
.figrow figure { flex: 1 1 0; margin: 0; min-width: 0; }
.figrow figure img { max-height: 95mm; max-width: 100%; width: auto; }
.figrow figcaption { font-size: 8.8pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 12pt; font-size: 9.6pt; line-height: 1.28; }
table.small { font-size: 8.2pt; }
th, td { border: 1px solid #9aa0a6; padding: 3pt 4pt; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
th { background: #dce3ec; }
tr { page-break-inside: avoid; }
.tcap { text-align: center; font-weight: bold; font-size: 10pt; margin: 10pt 0 4pt; page-break-after: avoid; }
.toc div { display: flex; align-items: baseline; font-size: 10.8pt; line-height: 1.5; }
.toc .d, .lof .d { flex: 1 1 auto; border-bottom: 1px dotted #888; margin: 0 4px; transform: translateY(-3px); }
.toc .c { font-weight: bold; margin-top: 5pt; } .toc .s { padding-left: 16pt; }
.lof div { display: flex; font-size: 9pt; line-height: 1.32; }
.cover, .cover p, .cover h1 { text-align: center; }
.cover h1 { page-break-before: auto; font-size: 25pt; margin: 40mm 0 10mm; line-height: 1.25; }
.cover .inst { font-size: 15pt; font-weight: bold; margin: 0; }
.cover .mid { font-size: 14pt; margin: 4pt 0; } .cover .lab { font-weight: bold; margin-top: 16mm; font-size: 13pt; }
`;

const bodyHtml = () => {
  const out = [];
  let first = true;
  for (const b of M.blocks) {
    if (b.t === 'h1') {
      out.push(`<h1 class="${first ? 'first' : ''}">${esc(b.num ? `Chapter ${b.num}. ${b.text}` : b.text)}</h1>`); first = false;
    } else if (b.t === 'h2') out.push(`<h2>${b.num ? esc(b.num) + '&nbsp;&nbsp;' : ''}${esc(b.text)}</h2>`);
    else if (b.t === 'h3') out.push(`<h3>${b.num ? esc(b.num) + '&nbsp;&nbsp;' : ''}${esc(b.text)}</h3>`);
    else if (b.t === 'p') out.push(`<p>${inl(b.text)}</p>`);
    else if (b.t === 'ul') out.push(`<ul>${b.items.map((i) => `<li>${inl(i)}</li>`).join('')}</ul>`);
    else if (b.t === 'ol') out.push(`<ol>${b.items.map((i) => `<li>${inl(i)}</li>`).join('')}</ol>`);
    else if (b.t === 'code') out.push(`<pre>${esc(b.text)}</pre>`);
    else if (b.t === 'note') out.push(`<div class="note"><b>Note:</b> ${inl(b.text)}</div>`);
    else if (b.t === 'figrow') out.push(`<div class="figrow">${b.items.map((f) => `<figure><img src="file://${f.abs}" style="max-width:${f.width}%"><figcaption>Figure ${f.n}: ${esc(f.caption)}</figcaption></figure>`).join('')}</div>`);
    else if (b.t === 'fig') out.push(`<figure><img src="file://${b.abs}" style="width:${b.width}%"><figcaption>Figure ${b.n}: ${esc(b.caption)}</figcaption></figure>`);
    else if (b.t === 'table') {
      const tot = b.widths.reduce((a, c) => a + c, 0);
      out.push(`<div class="tcap">Table ${b.n}: ${esc(b.caption)}</div><table class="${b.small ? 'small' : ''}"><colgroup>${b.widths.map((w) => `<col style="width:${((w / tot) * 100).toFixed(2)}%">`).join('')}</colgroup><thead><tr>${b.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inl(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }
  }
  return out.join('\n');
};

const wrap = (inner, pageCss) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${pageCss}</style></head><body>${inner}</body></html>`;
const runningHeader = `@page { @top-right { content: "${META.short}"; font-size: 8.5pt; color: #666; font-family: 'Liberation Serif',serif; } }`;
const pageNum = (fmt) => `@page { @bottom-center { content: counter(page, ${fmt}); font-size: 9.5pt; font-family: 'Liberation Serif',serif; } }`;

function coverHtml() {
  return wrap(`<div class="cover">
<p class="inst">${META.institute}</p><p class="inst">${META.university}</p>
<h1>${esc(META.title)}</h1>
<p class="mid" style="font-size:19pt;font-weight:bold">Final Report</p>
<p class="mid">${META.course}</p>
<p class="lab">Submitted By</p><p class="mid">${META.author} | ${META.roll}</p>
<p class="lab">Supervised By</p><p class="mid">${META.supervisor}, ${META.supervisorTitle}</p><p class="mid">${META.institute}, ${META.university}</p>
<p class="lab">Submitted On: ${META.date}</p>
<p class="mid" style="font-size:11.5pt;font-style:italic;margin-top:10mm">Repository: ${META.repo}</p></div>`, '');
}

function frontHtml(pages) {
  const toc = [];
  for (const b of M.blocks) {
    if (b.t === 'h1') toc.push(`<div class="c"><span>${esc(b.num ? `Chapter ${b.num}. ${b.text}` : b.text)}</span><span class="d"></span><span>${pages.get('h:' + b.text) ?? ''}</span></div>`);
    else if (b.t === 'h2') toc.push(`<div class="s"><span>${esc((b.num ? b.num + '  ' : '') + b.text)}</span><span class="d"></span><span>${pages.get('h:' + (b.num ? b.num + ' ' : '') + b.text) ?? ''}</span></div>`);
  }
  const list = (items, label, kind) => items.map((b) => `<div><span>${label} ${b.n}: ${esc(b.caption)}</span><span class="d"></span><span>${pages.get(`${kind}:${b.n}`) ?? ''}</span></div>`).join('');
  return wrap(`
<h1 class="first">Letter of Transmittal</h1>
<p>${FRONT.letterDate}</p><p>${FRONT.letterTo.map(esc).join('<br>')}</p>
<p><b>Subject:</b> ${esc(FRONT.letterSubject)}</p><p>Sir,</p>${FRONT.letterBody.map((t) => `<p>${esc(t)}</p>`).join('')}
<p style="margin-top:14pt">Sincerely,</p><p style="margin-top:28pt">${META.author}<br>BSSE ${META.roll.replace('BSSE-', '')}<br>${META.institute}, ${META.university}</p>
<p style="margin-top:34pt">Supervisor&rsquo;s Signature</p>
<h1>Acknowledgement</h1><p>${esc(FRONT.acknowledgement)}</p>
<h1>Abstract</h1>${FRONT.abstract.map((t) => `<p>${esc(t)}</p>`).join('')}
<h1>Table of Contents</h1><div class="toc">${toc.join('')}</div>
<h1>List of Figures</h1><div class="lof">${list(M.allFigs, 'Figure', 'fig')}</div>
<h2 style="margin-top:14pt;font-size:17pt">List of Tables</h2><div class="lof">${list(M.blocks.filter((b) => b.t === 'table'), 'Table', 'table')}</div>`, runningHeader + pageNum('lower-roman'));
}

async function pdf(browser, html, file) {
  const htmlFile = file.replace('.pdf', '.html');
  fs.writeFileSync(htmlFile, html);
  const page = await browser.newPage();
  await page.goto('file://' + htmlFile, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
function locate(bodyPdf) {
  const n = parseInt(execSync(`pdfinfo "${bodyPdf}" | grep Pages`).toString().trim().split(/\s+/).pop(), 10);
  const texts = [];
  for (let i = 1; i <= n; i++) texts.push(norm(execSync(`pdftotext -f ${i} -l ${i} -layout "${bodyPdf}" -`).toString()));
  const pages = new Map();
  let cursor = 0;
  const find = (needle, from) => { for (let i = from; i < n; i++) if (texts[i].includes(norm(needle))) return i; return -1; };
  for (const b of M.blocks) {
    if (b.t === 'h1') { const lab = b.num ? `Chapter ${b.num}. ${b.text}` : b.text; const i = find(lab, cursor); if (i >= 0) { pages.set('h:' + b.text, i + 1); cursor = i; } }
    else if (b.t === 'h2') { const lab = (b.num ? b.num + ' ' : '') + b.text; const i = find(lab, cursor); if (i >= 0) { pages.set('h:' + lab, i + 1); cursor = i; } }
    if (b.t === 'table') { const i = find(`Table ${b.n}: ${b.caption}`, 0); if (i >= 0) pages.set(`table:${b.n}`, i + 1); }
  }
  for (const b of M.allFigs) { const i = find(`Figure ${b.n}: ${b.caption}`, 0); if (i >= 0) pages.set(`fig:${b.n}`, i + 1); }
  return { pages, n };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const bodyPdf = path.join(OUT, 'body.pdf');
  await pdf(browser, wrap(bodyHtml(), runningHeader + pageNum('decimal')), bodyPdf);
  const { pages, n } = locate(bodyPdf);
  console.log('body pages', n, 'located entries', pages.size);
  await pdf(browser, coverHtml(), path.join(OUT, 'cover.pdf'));
  await pdf(browser, frontHtml(pages), path.join(OUT, 'front.pdf'));
  await browser.close();
  const final = process.argv[2] || path.join(OUT, 'VisionGuard_Final_Report.pdf');
  execSync(`pdfunite "${OUT}/cover.pdf" "${OUT}/front.pdf" "${bodyPdf}" "${final}"`);
  console.log(execSync(`pdfinfo "${final}" | grep -E "Pages|Page size"`).toString());
})().catch((e) => { console.error(e); process.exit(1); });
