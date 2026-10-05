// Numbers and resolves the added chapters (docx_content.js) and writes build/blocks.json for append_docx.py.
// Numbering continues from the existing report: 6 chapters, 18 figures ("Fig 1".."Fig 18"), 4 tables.
const fs = require('fs');
const path = require('path');
const { inline } = require('./model.js');

const ROOT = path.resolve(__dirname, '..');
const FIRST_CHAPTER = 7, FIRST_FIG = 19, FIRST_TABLE = 5;

const blocks = require('./docx_content.js');
const figs = {}, tbls = {};
let chap = FIRST_CHAPTER - 1, sec = 0, sub = 0, nf = FIRST_FIG - 1, nt = FIRST_TABLE - 1;

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const addFig = (f) => {
  nf += 1; f.n = nf; figs[f.key] = nf;
  f.abs = path.join(ROOT, f.src);
  if (!fs.existsSync(f.abs)) throw new Error('missing figure ' + f.abs);
  Object.assign(f, pngSize(f.abs));
};
for (const b of blocks) {
  if (b.t === 'h1') { chap += 1; sec = 0; sub = 0; b.num = String(chap); b.bookmark = `h.vg_ch${chap}`; }
  else if (b.t === 'h2') { sec += 1; sub = 0; b.num = `${chap}.${sec}`; b.bookmark = `h.vg_s${chap}_${sec}`; }
  else if (b.t === 'h3') { sub += 1; b.num = `${chap}.${sec}.${sub}`; b.bookmark = `h.vg_ss${chap}_${sec}_${sub}`; }
  else if (b.t === 'fig') addFig(b);
  else if (b.t === 'figrow') b.items.forEach(addFig);
  else if (b.t === 'table') { nt += 1; b.n = nt; tbls[b.key] = nt; }
}
const resolve = (text) => inline(text).map((t) => {
  if (!t.ref) return t;
  const kind = t.ref.split(':')[0];
  const n = kind === 'fig' ? figs[t.ref] : tbls[t.ref];
  if (n === undefined) throw new Error('unresolved reference ' + t.ref);
  return { s: kind === 'fig' ? `Fig ${n}` : `Table ${n}` };
});
const out = blocks.map((b) => {
  const o = { ...b };
  if (b.t === 'p') o.runs = resolve(b.text);
  if (b.t === 'ul' || b.t === 'ol') o.itemRuns = b.items.map(resolve);
  if (b.t === 'table') { o.cols = b.cols.map((c) => resolve(String(c))); o.rows = b.rows.map((r) => r.map((c) => resolve(String(c)))); }
  if (b.t === 'h1' || b.t === 'h2' || b.t === 'h3') o.text = b.text;
  return o;
});
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'blocks.json'), JSON.stringify(out, null, 1));
console.log('blocks', out.length, 'chapters', chap - FIRST_CHAPTER + 1, 'figures', nf - FIRST_FIG + 1, 'tables', nt - FIRST_TABLE + 1);
