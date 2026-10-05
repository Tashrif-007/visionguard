const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // docs/final-report

const META = {
  title: 'VisionGuard: AI-Assisted Visibility Enhancement and Incident Retrieval for Smart CCTV Surveillance',
  short: 'VisionGuard AI: Final Report',
  course: 'SE-801: Software Project Lab III (Project: Final Defense)',
  author: 'Shahid-E-Kaiser Md. Tashrif',
  roll: 'BSSE-1448',
  supervisor: 'Dr. Sumon Ahmed',
  supervisorTitle: 'Associate Professor',
  institute: 'Institute of Information Technology',
  university: 'University of Dhaka',
  date: 'October 2026',
  repo: 'https://github.com/Tashrif-007/visionguard',
};

const unitMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'unit_results.json'), 'utf8'));
const accMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'acceptance_results.json'), 'utf8'));

const FRONT = {
  letterDate: 'October 2026',
  letterTo: ['BSSE 4th Year Exam Committee', 'Institute of Information Technology', 'University of Dhaka'],
  letterSubject: 'Final Report Submission, VisionGuard: AI-Assisted Visibility Enhancement and Incident Retrieval for Smart CCTV Surveillance',
  letterBody: [
    'I am submitting the final report for the Software Project Lab 3 project, "VisionGuard: AI-Assisted Visibility Enhancement and Incident Retrieval for Smart CCTV Surveillance". This report extends the earlier technical report with the software design document (component-level and interface design), the implementation, the testing documentation with executed test cases, the user manual and the repository details.',
    'While I have tried to do my best, I welcome your feedback for improvement. Thank you for your kind consideration.',
  ],
  acknowledgement: 'I would like to thank my supervisor, Dr. Sumon Ahmed, for the guidance and feedback provided throughout the development of VisionGuard AI. Their input on scoping the hybrid dehazing architecture and on keeping the system CPU-friendly and explainable has directly shaped the design decisions documented in this report.',
  abstract: [
    'VisionGuard AI is a lightweight, CPU-friendly CCTV surveillance platform that restores visibility in hazy or smoggy footage in real time. Rather than relying on an end-to-end deep learning model, it uses a hybrid approach: the Dark Channel Prior (DCP) produces a physics-based estimate of a scene\'s transmission map, and a small refinement CNN corrects that estimate before the clean image is reconstructed through the atmospheric scattering model. The system\'s central optimization is region-of-interest (ROI) processing: dehazing runs only on the portion of a frame flagged by motion detection, rather than on every pixel of every frame, which keeps the pipeline fast enough for real-time use on ordinary CPU hardware and suitable for edge deployment without a GPU.',
    'Beyond the dehazing pipeline itself, VisionGuard AI runs several webcam, IP camera and uploaded-video sources at once. Operators can restrict detection with per-camera include and exclude zones and weekly arming schedules, and each logged event keeps a snapshot, a short video clip, its ROI coordinates and the share of the frame it covers. Events can be reviewed on a timeline with an evidence inspector, searched in plain English through the Claude API, and summarised on an analytics dashboard. Access is restricted to admin-seeded operator accounts authenticated with JWTs, with no open self-registration.',
    `This final report adds to the earlier technical report the software design document (design classes, persistent data sources, behavioural models, deployment, refactoring decisions and interface design), implementation details, a testing chapter with ${unitMeta.total} unit tests and ${accMeta.length} API acceptance cases (${unitMeta.passed} and ${accMeta.filter((r) => r.passed).length} passed respectively), and a user manual.`,
  ],
};

// ---- inline markup -> tokens ------------------------------------------------
function inline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\{\{[^}]+\}\})/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ s: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ s: tok.slice(2, -2), b: true });
    else if (tok.startsWith('`')) out.push({ s: tok.slice(1, -1), c: true });
    else out.push({ ref: tok.slice(2, -2) });
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function build() {
  const blocks = [].concat(
    require('./content/ch1_5.js'),
    require('./content/ch6.js'),
    require('./content/ch7_8.js'),
    require('./content/ch9.js'),
    require('./content/ch10_12.js'),
  );
  const figs = {}, tbls = {};
  let chap = 0, sec = 0, sub = 0, nf = 0, nt = 0;
  const addFig = (f) => {
    nf += 1; f.n = nf; figs[f.key] = nf;
    f.abs = path.isAbsolute(f.src) ? f.src : path.join(ROOT, f.src);
    if (!fs.existsSync(f.abs)) throw new Error(`missing figure file ${f.abs}`);
    Object.assign(f, pngSize(f.abs));
  };
  for (const b of blocks) {
    if (b.t === 'h1') {
      if (b.numbered === false) b.num = '';
      else { chap += 1; sec = 0; sub = 0; b.num = String(chap); }
    } else if (b.t === 'h2') { sec += 1; sub = 0; b.num = `${chap}.${sec}`; }
    else if (b.t === 'h3') { sub += 1; b.num = `${chap}.${sec}.${sub}`; }
    else if (b.t === 'fig') addFig(b);
    else if (b.t === 'figrow') b.items.forEach(addFig);
    else if (b.t === 'table') { nt += 1; b.n = nt; tbls[b.key] = nt; }
  }
  // unnumbered chapters (references, appendices) get unnumbered subsections
  let unnumbered = false;
  for (const b of blocks) {
    if (b.t === 'h1') unnumbered = b.numbered === false;
    if (unnumbered && (b.t === 'h2' || b.t === 'h3')) b.num = '';
  }
  const resolve = (text) => inline(text).map((tok) => {
    if (!tok.ref) return tok;
    const [kind] = tok.ref.split(':');
    if (kind === 'fig') return { s: `Figure ${figs[tok.ref] ?? '??'}` };
    return { s: `Table ${tbls[tok.ref] ?? '??'}` };
  });
  const allFigs = [];
  for (const b of blocks) { if (b.t === 'fig') allFigs.push(b); if (b.t === 'figrow') allFigs.push(...b.items); }
  // sanity: every reference must resolve
  const bad = [];
  for (const b of blocks) {
    const s = JSON.stringify(b);
    for (const m of s.match(/\{\{[^}]+\}\}/g) || []) { const k = m.slice(2, -2); if (!(figs[k] || tbls[k])) bad.push(k); }
  }
  if (bad.length) throw new Error('unresolved references: ' + bad.join(', '));
  return { blocks, figs, tbls, resolve, META, FRONT, allFigs, ROOT };
}
module.exports = { build, inline, META, FRONT, ROOT };
