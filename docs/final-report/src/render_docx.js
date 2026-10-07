const fs = require('fs');
const path = require('path');
const D = require('docx');
const { build } = require('./model.js');
const M = build();
const { META, FRONT } = M;

const FONT = 'Times New Roman';
const MONO = 'Consolas';
const CONTENT_W = 9026; // A4 with 1 inch margins, DXA
const PX_W = 600;       // content width in px at 96 dpi
const PX_H = 640;       // max figure height

const runsFrom = (text, base = {}) =>
  M.resolve(text).map((t) => new D.TextRun({ text: t.s, font: t.c ? MONO : FONT, bold: t.b || base.bold, italics: base.italics, size: t.c ? (base.size ? base.size - 2 : 20) : base.size || 23, color: base.color }));

const para = (text, o = {}) => new D.Paragraph({ children: runsFrom(text, o), spacing: { after: o.after ?? 120, line: o.line ?? 300 }, alignment: o.align || D.AlignmentType.JUSTIFIED, keepNext: o.keepNext, indent: o.indent });

const numbering = { config: [{ reference: 'bullets', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] };
let olCount = 0;

function listParas(b) {
  if (b.t === 'ul') return b.items.map((it) => new D.Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runsFrom(it), spacing: { after: 70, line: 290 }, alignment: D.AlignmentType.LEFT }));
  olCount += 1;
  const ref = `ol${olCount}`;
  numbering.config.push({ reference: ref, levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: '%1.', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 340 } } } }] });
  return b.items.map((it) => new D.Paragraph({ numbering: { reference: ref, level: 0 }, children: runsFrom(it), spacing: { after: 70, line: 290 }, alignment: D.AlignmentType.LEFT }));
}

function headingPara(b) {
  const level = { h1: D.HeadingLevel.HEADING_1, h2: D.HeadingLevel.HEADING_2, h3: D.HeadingLevel.HEADING_3 }[b.t];
  const label = b.t === 'h1' && b.num ? `Chapter ${b.num}. ${b.text}` : b.num ? `${b.num}  ${b.text}` : b.text;
  return new D.Paragraph({ heading: level, pageBreakBefore: b.t === 'h1', children: [new D.TextRun({ text: label })], keepNext: true });
}

const border = { style: D.BorderStyle.SINGLE, size: 4, color: '9AA0A6' };
const borders = { top: border, bottom: border, left: border, right: border };

function tableEl(b) {
  const total = b.widths.reduce((a, c) => a + c, 0);
  const cw = b.widths.map((w) => Math.round((w / total) * CONTENT_W));
  cw[cw.length - 1] += CONTENT_W - cw.reduce((a, c) => a + c, 0);
  const sz = b.small ? 16 : 19;
  const cell = (text, i, header) =>
    new D.TableCell({
      width: { size: cw[i], type: D.WidthType.DXA }, borders,
      shading: header ? { fill: 'DCE3EC', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [new D.Paragraph({ children: runsFrom(String(text), { bold: header, size: sz }), spacing: { after: 0, line: 250 }, alignment: D.AlignmentType.LEFT })],
    });
  const rows = [new D.TableRow({ tableHeader: true, cantSplit: true, children: b.cols.map((c, i) => cell(c, i, true)) })]
    .concat(b.rows.map((r) => new D.TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })));
  return [
    new D.Paragraph({ keepNext: true, spacing: { before: 160, after: 80 }, alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: `Table ${b.n}: ${b.caption}`, font: FONT, bold: true, size: 20 })] }),
    new D.Table({ width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: cw, rows }),
    new D.Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

function figEl(b) {
  let w = (PX_W * b.width) / 100;
  let h = (w * b.h) / b.w;
  if (h > PX_H) { w = (w * PX_H) / h; h = PX_H; }
  return [
    new D.Paragraph({ alignment: D.AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [new D.ImageRun({ type: 'png', data: fs.readFileSync(b.abs), transformation: { width: Math.round(w), height: Math.round(h) }, altText: { title: b.caption, description: b.caption, name: b.key } })] }),
    new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 200 }, children: [new D.TextRun({ text: `Figure ${b.n}: ${b.caption}`, font: FONT, italics: true, size: 20 })] }),
  ];
}

function figRowEl(b) {
  const n = b.items.length;
  const cw = Math.floor(CONTENT_W / 2);
  const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nb = { top: none, bottom: none, left: none, right: none };
  const cellFor = (f) => {
    let w = (PX_W / 2 - 10) * (f.width / 100), h = (w * f.h) / f.w;
    if (h > 330) { w = (w * 330) / h; h = 330; }
    return new D.TableCell({ width: { size: cw, type: D.WidthType.DXA }, borders: nb, margins: { top: 40, bottom: 40, left: 60, right: 60 }, verticalAlign: D.VerticalAlign.TOP, children: [
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, keepNext: true, spacing: { after: 40 }, children: [new D.ImageRun({ type: 'png', data: fs.readFileSync(f.abs), transformation: { width: Math.round(w), height: Math.round(h) }, altText: { title: f.caption, description: f.caption, name: f.key } })] }),
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 60 }, children: [new D.TextRun({ text: `Figure ${f.n}: ${f.caption}`, font: FONT, italics: true, size: 18 })] }),
    ] });
  };
  const cells = b.items.map(cellFor);
  if (n === 1) cells.push(new D.TableCell({ width: { size: cw, type: D.WidthType.DXA }, borders: nb, children: [new D.Paragraph({ children: [] })] }));
  return [new D.Table({ width: { size: cw * 2, type: D.WidthType.DXA }, columnWidths: [cw, cw], alignment: D.AlignmentType.CENTER, rows: [new D.TableRow({ cantSplit: true, children: cells })] }), new D.Paragraph({ spacing: { after: 100 }, children: [] })];
}

function codeEl(b) {
  return b.text.split('\n').map((line, i, arr) => new D.Paragraph({
    shading: { fill: 'F3F4F6', type: D.ShadingType.CLEAR, color: 'auto' },
    spacing: { after: i === arr.length - 1 ? 160 : 0, line: 240 },
    keepLines: true,
    border: i === 0 ? { top: border } : i === arr.length - 1 ? { bottom: border } : undefined,
    children: [new D.TextRun({ text: line.length ? line : ' ', font: MONO, size: 17 })],
  }));
}

function noteEl(b) {
  return new D.Paragraph({
    shading: { fill: 'FFF7E0', type: D.ShadingType.CLEAR, color: 'auto' },
    border: { left: { style: D.BorderStyle.SINGLE, size: 18, color: 'E0A800', space: 6 } },
    spacing: { before: 80, after: 160, line: 280 }, indent: { left: 140 },
    children: [new D.TextRun({ text: 'Note: ', bold: true, font: FONT, size: 21 }), ...runsFrom(b.text, { size: 21 })],
  });
}

// ---- body ------------------------------------------------------------------
const body = [];
for (const b of M.blocks) {
  if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') body.push(headingPara(b));
  else if (b.t === 'p') body.push(para(b.text));
  else if (b.t === 'ul' || b.t === 'ol') body.push(...listParas(b));
  else if (b.t === 'table') body.push(...tableEl(b));
  else if (b.t === 'fig') body.push(...figEl(b));
  else if (b.t === 'figrow') body.push(...figRowEl(b));
  else if (b.t === 'code') body.push(...codeEl(b));
  else if (b.t === 'note') body.push(noteEl(b));
}

// ---- front matter ----------------------------------------------------------
const C = D.AlignmentType.CENTER;
const center = (text, size, o = {}) => new D.Paragraph({ alignment: C, spacing: { before: o.before || 0, after: o.after ?? 120 }, children: [new D.TextRun({ text, font: FONT, size, bold: o.bold, italics: o.italics, color: o.color })] });
const frontH = (text) => new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new D.TextRun({ text })] });

const cover = [
  center('', 24, { after: 600 }),
  center(META.institute, 28, { bold: true }),
  center(META.university, 28, { bold: true, after: 700 }),
  center(META.title, 40, { bold: true, after: 400, color: '1F3864' }),
  center('Final Report', 34, { bold: true, after: 120 }),
  center(META.course, 26, { after: 900 }),
  center('Submitted By', 24, { bold: true, after: 60 }),
  center(`${META.author} | ${META.roll}`, 26, { after: 500 }),
  center('Supervised By', 24, { bold: true, after: 60 }),
  center(`${META.supervisor}, ${META.supervisorTitle}`, 26, { after: 60 }),
  center(`${META.institute}, ${META.university}`, 24, { after: 500 }),
  center(`Submitted On: ${META.date}`, 24, { after: 200 }),
  center(`Repository: ${META.repo}`, 22, { italics: true }),
];

const front = [
  frontH('Letter of Transmittal'),
  para(FRONT.letterDate, { align: D.AlignmentType.LEFT }),
  ...FRONT.letterTo.map((l) => para(l, { align: D.AlignmentType.LEFT, after: 0 })),
  para('', { after: 120 }),
  para(`**Subject:** ${FRONT.letterSubject}`, { align: D.AlignmentType.LEFT }),
  para('Sir,', { align: D.AlignmentType.LEFT }),
  ...FRONT.letterBody.map((t) => para(t)),
  para('Sincerely,', { align: D.AlignmentType.LEFT, after: 400 }),
  para(`${META.author}`, { align: D.AlignmentType.LEFT, after: 0 }),
  para(`BSSE ${META.roll.replace('BSSE-', '')}`, { align: D.AlignmentType.LEFT, after: 0 }),
  para(`${META.institute}, ${META.university}`, { align: D.AlignmentType.LEFT, after: 600 }),
  para('Supervisor’s Signature', { align: D.AlignmentType.LEFT }),
  frontH('Acknowledgement'),
  para(FRONT.acknowledgement),
  frontH('Abstract'),
  ...FRONT.abstract.map((t) => para(t)),
  frontH('Table of Contents'),
  new D.TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new D.Paragraph({ children: [new D.TextRun({ text: 'If the page numbers are missing, right-click the table and choose Update Field.', italics: true, size: 18, font: FONT })], spacing: { before: 120 } }),
  frontH('List of Figures'),
  ...M.allFigs.map((b) => new D.Paragraph({ spacing: { after: 40 }, children: [new D.TextRun({ text: `Figure ${b.n}: ${b.caption}`, font: FONT, size: 20 })] })),
  frontH('List of Tables'),
  ...M.blocks.filter((b) => b.t === 'table').map((b) => new D.Paragraph({ spacing: { after: 40 }, children: [new D.TextRun({ text: `Table ${b.n}: ${b.caption}`, font: FONT, size: 20 })] })),
];

const footer = () => new D.Footer({ children: [new D.Paragraph({ alignment: C, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const header = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: '9AA0A6', space: 2 } }, children: [new D.TextRun({ text: META.short, font: FONT, size: 18, color: '555555' })] })] });
const page = (fmt, start) => ({ page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 }, pageNumbers: { start, formatType: fmt } } });

const doc = new D.Document({
  creator: META.author, title: META.title, description: 'VisionGuard AI final report',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 23 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 120, after: 280 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: '2E4A7D' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering,
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } }, children: cover },
    { properties: page(D.NumberFormat.LOWER_ROMAN, 1), headers: { default: header }, footers: { default: footer() }, children: front },
    { properties: page(D.NumberFormat.DECIMAL, 1), headers: { default: header }, footers: { default: footer() }, children: body },
  ],
});

D.Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || path.join(M.ROOT, 'out', 'VisionGuard_Final_Report.docx');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log('wrote', out, (buf.length / 1e6).toFixed(1), 'MB');
});
